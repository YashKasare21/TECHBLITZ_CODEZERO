import 'dotenv/config';
import app from './app';
import { initBot, bot } from './bot';

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    await initBot();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const WEBHOOK_URL = process.env.WEBHOOK_URL;

    if (TELEGRAM_BOT_TOKEN) {
      if (WEBHOOK_URL && process.env.NODE_ENV === 'production') {
        await bot.api.setWebhook(`${WEBHOOK_URL}/api/bot/webhook`);
        console.log(`Webhook set to ${WEBHOOK_URL}/api/bot/webhook`);
      } else {
        bot.start();
        console.log('Bot started in polling mode');
      }
    }

    const gracefulShutdown = async () => {
      console.log('Shutting down gracefully...');
      if (TELEGRAM_BOT_TOKEN) {
        bot.stop();
      }
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();