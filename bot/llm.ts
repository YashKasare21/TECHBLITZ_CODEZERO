import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

const provider = createOpenAICompatible({
  name: "clinic-llm",
  apiKey: process.env.LLM_API_KEY || "",
  baseURL: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
});

const model = provider(process.env.LLM_MODEL || "gpt-4o-mini");

const BookingIntentSchema = z.object({
  intent: z.enum([
    "book",
    "cancel",
    "reschedule",
    "confirm",
    "query",
    "unknown",
  ]),
  doctorName: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  symptoms: z.string().optional(),
  missingInfo: z.array(z.string()),
});

export type BookingIntent = z.infer<typeof BookingIntentSchema>;

export async function parseBookingIntent(
  messages: { role: string; content: string }[]
): Promise<BookingIntent> {
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: BookingIntentSchema }),
      messages: [
        {
          role: "system" as const,
          content: `You are a clinic appointment booking assistant. Extract appointment booking information from the user's message.
Available intents: book, cancel, reschedule, confirm, query, unknown.
If the user wants to book an appointment, extract doctor name, preferred date, preferred time, and symptoms.
List any missing required information (doctorName, preferredDate, preferredTime) in the missingInfo array.
For dates, use ISO format (YYYY-MM-DD). For times, use 24h format (HH:MM).
Today's date is ${new Date().toISOString().split("T")[0]}.`,
        },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    return (
      output || {
        intent: "unknown",
        missingInfo: [],
      }
    );
  } catch (error) {
    console.error("LLM parsing error:", error);
    return { intent: "unknown", missingInfo: [] };
  }
}

export async function generateResponse(prompt: string): Promise<string> {
  try {
    const { text } = await generateText({
      model,
      system:
        "You are a friendly clinic assistant. Keep responses brief, helpful, and conversational. Use emojis sparingly.",
      prompt,
    });
    return text;
  } catch (error) {
    console.error("LLM response error:", error);
    return "I'm having trouble processing your request. Please try again or contact the clinic directly.";
  }
}
