import {
  ToolLoopAgent,
  stepCountIs,
  hasToolCall,
  wrapLanguageModel,
  type ModelMessage,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { prisma } from '../lib/prisma';
import { botTools } from '../bot/tools';

const provider = createOpenAICompatible({
  name: 'custom-llm',
  baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a helpful medical clinic assistant bot for patients. Your role is to help patients:

1. **Book appointments** - Help patients find available slots and book appointments with doctors
2. **View their appointments** - Show upcoming appointments
3. **Cancel appointments** - Help patients cancel their appointments
4. **Reschedule appointments** - Help patients change their appointment date/time

## Important Guidelines:

- Always be polite, professional, and empathetic
- Ask for clarification if you're unsure about something
- Confirm important actions (like booking or cancelling) before executing
- Present available time slots in a clear, easy-to-read format (use 12-hour format like "9:00 AM", "2:30 PM")
- When showing dates, use a friendly format like "Monday, January 15"
- If a patient asks about their appointments, you already have their patientId in context

## Available Actions:

1. **getDoctors** - List all doctors in the clinic
2. **getAvailableSlots** - Get available appointment slots for a doctor on a specific date
3. **bookAppointment** - Book an appointment for the patient
4. **getMyAppointments** - Show the patient's upcoming appointments
5. **cancelAppointment** - Cancel an existing appointment
6. **rescheduleAppointment** - Reschedule an appointment to a new time
7. **completeInteraction** - Call this when you have fully addressed the patient's request

## Workflow:

1. When booking: First call getDoctors to show options, then getAvailableSlots for the chosen doctor/date, then bookAppointment after confirming with patient
2. Always confirm before making changes (booking, cancelling, rescheduling)
3. When the patient's request is complete, call completeInteraction to signal you're done

## Response Style:

- Keep responses concise but helpful
- Use bullet points for lists of options
- Always confirm before making changes
- If something goes wrong, apologize and offer alternatives

Remember: You're representing a professional medical clinic, so maintain a warm but professional tone.`;

export interface ConversationContext {
  patientId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  telegramChatId: string;
  isVerified: boolean;
}

export interface ProcessResult {
  text: string;
  steps: number;
  completed: boolean;
  toolCalls: Array<{ toolName: string; input: unknown }>;
}

const createModel = () => {
  const baseModel = provider(process.env.LLM_MODEL || 'gpt-4o-mini');
  
  if (process.env.ENABLE_DEVTOOLS === 'true') {
    return wrapLanguageModel({
      model: baseModel,
      middleware: devToolsMiddleware(),
    });
  }
  
  return baseModel;
};

const createAgent = (contextPrompt: string) => {
  return new ToolLoopAgent({
    model: createModel(),
    instructions: SYSTEM_PROMPT + contextPrompt,
    tools: botTools,
    stopWhen: [
      stepCountIs(10),
      hasToolCall('completeInteraction'),
    ],
  });
};

export const getOrCreateConversation = async (telegramChatId: string, patientId: string | null) => {
  if (!patientId) {
    return null;
  }

  let conversation = await prisma.conversation.findFirst({
    where: { patientId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { patientId },
    });
  }

  return conversation;
};

export const getConversationHistory = async (conversationId: string, limit: number = 20): Promise<ModelMessage[]> => {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      role: true,
      content: true,
    },
  });

  return messages.reverse().map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
};

export const saveMessage = async (
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: unknown,
  toolResults?: unknown,
) => {
  const toolCallsData = toolCalls ? JSON.parse(JSON.stringify(toolCalls)) : null;
  const toolResultsData = toolResults ? JSON.parse(JSON.stringify(toolResults)) : null;

  await prisma.message.create({
    data: {
      conversationId,
      role,
      content,
      toolCalls: toolCallsData,
      toolResults: toolResultsData,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
};

export const processPatientMessage = async (
  context: ConversationContext,
  message: string,
): Promise<string> => {
  const { patientId, patientName, isVerified } = context;

  if (!isVerified || !patientId) {
    return `Welcome to our clinic! To use our booking services, please verify your account.

Please share your registered phone number so I can verify your account. If you're a new patient, I can help you register.`;
  }

  const conversation = await getOrCreateConversation(context.telegramChatId, patientId);

  if (!conversation) {
    return 'Sorry, there was an error processing your request. Please try again.';
  }

  const history = await getConversationHistory(conversation.id);

  const contextPrompt = `

## Current User Context:
- Patient ID: ${patientId}
- Patient Name: ${patientName}
- The user is verified and can perform all actions
- When they say "my appointments" or similar, use their patientId: ${patientId}
- When using bookAppointment, cancelAppointment, rescheduleAppointment, or getMyAppointments, use patientId: ${patientId}`;

  try {
    const agent = createAgent(contextPrompt);
    
    const messages: ModelMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    const result = await agent.generate({
      messages,
    });

    const toolCalls = result.steps
      .flatMap(step => step.toolCalls || [])
      .map(tc => ({ toolName: tc.toolName, input: tc.input }));

    await saveMessage(conversation.id, 'user', message);
    await saveMessage(conversation.id, 'assistant', result.text, toolCalls);

    return result.text;
  } catch (error) {
    console.error('LLM processing error:', error);
    return 'Sorry, I encountered an error processing your request. Please try again or contact the clinic directly.';
  }
};

export const processPatientMessageWithDetails = async (
  context: ConversationContext,
  message: string,
): Promise<ProcessResult> => {
  const { patientId, patientName, isVerified } = context;

  if (!isVerified || !patientId) {
    return {
      text: `Welcome to our clinic! To use our booking services, please verify your account.

Please share your registered phone number so I can verify your account.`,
      steps: 0,
      completed: false,
      toolCalls: [],
    };
  }

  const conversation = await getOrCreateConversation(context.telegramChatId, patientId);

  if (!conversation) {
    return {
      text: 'Sorry, there was an error processing your request. Please try again.',
      steps: 0,
      completed: false,
      toolCalls: [],
    };
  }

  const history = await getConversationHistory(conversation.id);

  const contextPrompt = `

## Current User Context:
- Patient ID: ${patientId}
- Patient Name: ${patientName}
- The user is verified and can perform all actions
- When they say "my appointments" or similar, use their patientId: ${patientId}
- When using bookAppointment, cancelAppointment, rescheduleAppointment, or getMyAppointments, use patientId: ${patientId}`;

  try {
    const agent = createAgent(contextPrompt);
    
    const messages: ModelMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    const result = await agent.generate({
      messages,
    });

    const toolCalls = result.steps
      .flatMap(step => step.toolCalls || [])
      .map(tc => ({ toolName: tc.toolName, input: tc.input }));

    const completed = toolCalls.some(tc => tc.toolName === 'completeInteraction');

    await saveMessage(conversation.id, 'user', message);
    await saveMessage(conversation.id, 'assistant', result.text, toolCalls);

    return {
      text: result.text,
      steps: result.steps.length,
      completed,
      toolCalls,
    };
  } catch (error) {
    console.error('LLM processing error:', error);
    return {
      text: 'Sorry, I encountered an error processing your request. Please try again.',
      steps: 0,
      completed: false,
      toolCalls: [],
    };
  }
};

export const streamPatientMessage = async function* (
  context: ConversationContext,
  message: string,
): AsyncGenerator<{ type: 'text' | 'tool_call' | 'done'; content: string; toolName?: string }> {
  const { patientId, patientName, isVerified } = context;

  if (!isVerified || !patientId) {
    yield { type: 'text', content: 'Please verify your account first using /start' };
    yield { type: 'done', content: '' };
    return;
  }

  const conversation = await getOrCreateConversation(context.telegramChatId, patientId);

  if (!conversation) {
    yield { type: 'text', content: 'Error processing request. Please try again.' };
    yield { type: 'done', content: '' };
    return;
  }

  const history = await getConversationHistory(conversation.id);

  const contextPrompt = `

## Current User Context:
- Patient ID: ${patientId}
- Patient Name: ${patientName}
- When using bookAppointment, cancelAppointment, rescheduleAppointment, or getMyAppointments, use patientId: ${patientId}`;

  try {
    const agent = createAgent(contextPrompt);
    
    const messages: ModelMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    const result = await agent.stream({
      messages,
    });

    let fullText = '';
    const toolCallsList: Array<{ toolName: string; input: unknown }> = [];

    for await (const chunk of result.textStream) {
      fullText += chunk;
      yield { type: 'text', content: chunk };
    }

    yield { type: 'done', content: fullText };

    const finalResult = await result;
    
    const toolCalls = finalResult.steps
      .flatMap(step => step.toolCalls || [])
      .map(tc => ({ toolName: tc.toolName, input: tc.input }));

    await saveMessage(conversation.id, 'user', message);
    await saveMessage(conversation.id, 'assistant', fullText, toolCalls);

  } catch (error) {
    console.error('LLM streaming error:', error);
    yield { type: 'text', content: 'Sorry, I encountered an error. Please try again.' };
    yield { type: 'done', content: '' };
  }
};

export const sendNotification = async (telegramChatId: string, message: string) => {
  try {
    const { bot } = await import('../bot');
    await bot.api.sendMessage(telegramChatId, message);
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
};

export const notifyAppointmentRescheduled = async (
  telegramChatId: string,
  patientName: string,
  doctorName: string,
  oldTime: string,
  newTime: string,
  reason?: string,
) => {
  const message = `📅 **Appointment Rescheduled**

Hello ${patientName},

Your appointment with Dr. ${doctorName} has been rescheduled.

**Previous time:** ${oldTime}
**New time:** ${newTime}
${reason ? `\n**Reason:** ${reason}` : ''}

If this doesn't work for you, reply here to reschedule or cancel.

Thank you for your understanding!`;

  return sendNotification(telegramChatId, message);
};

export const notifyAppointmentReminder = async (
  telegramChatId: string,
  patientName: string,
  doctorName: string,
  dateTime: string,
) => {
  const message = `🔔 **Appointment Reminder**

Hello ${patientName},

This is a reminder for your upcoming appointment:

**Doctor:** Dr. ${doctorName}
**Date & Time:** ${dateTime}

Please arrive 10 minutes early. If you need to reschedule or cancel, reply here.

See you soon!`;

  return sendNotification(telegramChatId, message);
};
