import { Bot, session, Context, SessionFlavor, MiddlewareFn } from 'grammy';
import { prisma } from '../lib/prisma';
import { processPatientMessage, sendNotification } from '../services/llm.service';

interface SessionData {
  patientId: string | null;
  patientName: string | null;
  patientPhone: string | null;
  isVerified: boolean;
  awaitingPhone: boolean;
  awaitingOtp: boolean;
  otpCode: string | null;
}

type MyContext = Context & SessionFlavor<SessionData>;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let botInstance: Bot<MyContext> | null = null;

const initialSession = (): SessionData => ({
  patientId: null,
  patientName: null,
  patientPhone: null,
  isVerified: false,
  awaitingPhone: false,
  awaitingOtp: false,
  otpCode: null,
});

const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
};

function setupBot(bot: Bot<MyContext>) {
  bot.use(session({ initial: initialSession }) as MiddlewareFn<MyContext>);

  bot.command('start', async (ctx) => {
    const telegramChatId = ctx.chat?.id.toString();

    if (!telegramChatId) {
      await ctx.reply('Sorry, I couldn\'t identify your chat. Please try again.');
      return;
    }

    const existingPatient = await prisma.patient.findFirst({
      where: { telegramChatId },
    });

    if (existingPatient) {
      ctx.session.patientId = existingPatient.id;
      ctx.session.patientName = existingPatient.name;
      ctx.session.patientPhone = existingPatient.phone;
      ctx.session.isVerified = true;

      await ctx.reply(
        `Welcome back, ${existingPatient.name}! 👋\n\n` +
        `I'm your clinic assistant. I can help you:\n` +
        `• Book appointments\n` +
        `• View your upcoming appointments\n` +
        `• Cancel or reschedule appointments\n\n` +
        `How can I help you today?`
      );
      return;
    }

    await ctx.reply(
      `Welcome to our clinic! 🏥\n\n` +
      `I'm your clinic assistant bot. To get started, I'll need to verify your account.\n\n` +
      `Please enter your registered phone number:`,
    );

    ctx.session.awaitingPhone = true;
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `🤖 **Clinic Bot Help**\n\n` +
      `Here's what I can help you with:\n\n` +
      `📋 **Commands:**\n` +
      `/start - Start or verify your account\n` +
      `/help - Show this help message\n` +
      `/appointments - View your upcoming appointments\n` +
      `/book - Book a new appointment\n` +
      `/cancel - Cancel an appointment\n` +
      `/reschedule - Reschedule an appointment\n\n` +
      `💬 **Chat with me:**\n` +
      `You can also just type your question naturally.`
    );
  });

  bot.command('appointments', async (ctx) => {
    if (!ctx.session.isVerified || !ctx.session.patientId) {
      await ctx.reply('Please verify your account first using /start');
      return;
    }

    const response = await processPatientMessage(
      {
        patientId: ctx.session.patientId,
        patientName: ctx.session.patientName,
        patientPhone: ctx.session.patientPhone,
        telegramChatId: ctx.chat!.id.toString(),
        isVerified: ctx.session.isVerified,
      },
      'Show my upcoming appointments'
    );

    await ctx.reply(response);
  });

  bot.command('book', async (ctx) => {
    if (!ctx.session.isVerified || !ctx.session.patientId) {
      await ctx.reply('Please verify your account first using /start');
      return;
    }

    await ctx.reply(
      `I'll help you book an appointment. Tell me when you'd like to come in.\n\n` +
      `For example: "Book for tomorrow afternoon" or "Available slots for next Monday"`
    );
  });

  bot.command('cancel', async (ctx) => {
    if (!ctx.session.isVerified || !ctx.session.patientId) {
      await ctx.reply('Please verify your account first using /start');
      return;
    }

    const response = await processPatientMessage(
      {
        patientId: ctx.session.patientId,
        patientName: ctx.session.patientName,
        patientPhone: ctx.session.patientPhone,
        telegramChatId: ctx.chat!.id.toString(),
        isVerified: ctx.session.isVerified,
      },
      'I want to cancel my appointment'
    );

    await ctx.reply(response);
  });

  bot.command('reschedule', async (ctx) => {
    if (!ctx.session.isVerified || !ctx.session.patientId) {
      await ctx.reply('Please verify your account first using /start');
      return;
    }

    const response = await processPatientMessage(
      {
        patientId: ctx.session.patientId,
        patientName: ctx.session.patientName,
        patientPhone: ctx.session.patientPhone,
        telegramChatId: ctx.chat!.id.toString(),
        isVerified: ctx.session.isVerified,
      },
      'I want to reschedule my appointment'
    );

    await ctx.reply(response);
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const telegramChatId = ctx.chat?.id.toString();

    if (!telegramChatId) return;

    if (ctx.session.awaitingPhone) {
      const phone = formatPhoneNumber(text);

      if (phone.length < 10) {
        await ctx.reply('Please enter a valid phone number:');
        return;
      }

      const patient = await prisma.patient.findUnique({
        where: { phone },
      });

      if (!patient) {
        await ctx.reply(
          `I couldn't find an account with that phone number.\n\n` +
          `Please contact the clinic to register, or try a different number.`
        );
        return;
      }

      if (patient.telegramChatId && patient.telegramChatId !== telegramChatId) {
        await ctx.reply(
          `This phone number is already linked to another Telegram account.\n\n` +
          `Please contact the clinic to update your information.`
        );
        return;
      }

      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await prisma.telegramOTP.create({
        data: {
          patientId: patient.id,
          otpCode,
          expiresAt,
        },
      });

      console.log(`[DEV] OTP for ${patient.name}: ${otpCode}`);

      ctx.session.patientId = patient.id;
      ctx.session.patientName = patient.name;
      ctx.session.patientPhone = phone;
      ctx.session.otpCode = otpCode;
      ctx.session.awaitingPhone = false;
      ctx.session.awaitingOtp = true;

      await ctx.reply(
        `Found your account, ${patient.name}!\n\n` +
        `For development, your OTP is: ${otpCode}\n` +
        `Please enter this code to verify:`
      );
      return;
    }

    if (ctx.session.awaitingOtp) {
      const code = text.replace(/\D/g, '');

      if (code.length !== 6) {
        await ctx.reply('Please enter the 6-digit verification code:');
        return;
      }

      const otp = await prisma.telegramOTP.findFirst({
        where: {
          patientId: ctx.session.patientId!,
          otpCode: code,
          expiresAt: { gt: new Date() },
          used: false,
        },
      });

      if (!otp) {
        await ctx.reply('Invalid or expired code. Please try again or use /start to restart.');
        return;
      }

      await prisma.telegramOTP.update({
        where: { id: otp.id },
        data: { used: true },
      });

      await prisma.patient.update({
        where: { id: ctx.session.patientId! },
        data: {
          telegramChatId,
          telegramUsername: ctx.from?.username || null,
          phoneVerified: true,
        },
      });

      ctx.session.isVerified = true;
      ctx.session.awaitingOtp = false;
      ctx.session.otpCode = null;

      await ctx.reply(
        `✅ Verification successful!\n\n` +
        `Welcome, ${ctx.session.patientName}! Your account is now linked.\n\n` +
        `How can I assist you today?`
      );
      return;
    }

    if (!ctx.session.isVerified || !ctx.session.patientId) {
      await ctx.reply('Please verify your account first using /start');
      return;
    }

    const response = await processPatientMessage(
      {
        patientId: ctx.session.patientId,
        patientName: ctx.session.patientName,
        patientPhone: ctx.session.patientPhone,
        telegramChatId,
        isVerified: ctx.session.isVerified,
      },
      text
    );

    await ctx.reply(response);
  });
}

export function getBot(): Bot<MyContext> {
  if (!botInstance && TELEGRAM_BOT_TOKEN) {
    botInstance = new Bot<MyContext>(TELEGRAM_BOT_TOKEN);
    setupBot(botInstance);
  }
  return botInstance!;
}

export const bot = {
  get api() {
    return getBot().api;
  },
  start() {
    return getBot().start();
  },
  stop() {
    return getBot().stop();
  },
  handleUpdate(update: unknown) {
    return getBot().handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
  },
};

export const initBot = async () => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set. Bot will not start.');
    return;
  }

  try {
    const bot = getBot();
    const me = await bot.api.getMe();
    console.log(`Bot initialized: @${me.username}`);
  } catch (error) {
    console.error('Failed to initialize bot:', error);
  }
};

export const notifyPatient = async (patientId: string, message: string) => {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { telegramChatId: true },
  });

  if (!patient?.telegramChatId) {
    return false;
  }

  return sendNotification(patient.telegramChatId, message);
};

export default bot;
