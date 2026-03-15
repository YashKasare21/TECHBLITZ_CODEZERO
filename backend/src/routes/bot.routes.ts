import { Router, Request, Response } from 'express';
import { bot } from '../bot';

const router = Router();

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

router.get('/webhook/info', async (_req: Request, res: Response) => {
  try {
    const info = await bot.api.getWebhookInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get webhook info' });
  }
});

router.post('/webhook/set', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ success: false, error: 'Webhook URL is required' });
    return;
  }

  try {
    await bot.api.setWebhook(url);
    res.json({ success: true, message: 'Webhook set successfully' });
  } catch (error) {
    console.error('Failed to set webhook:', error);
    res.status(500).json({ success: false, error: 'Failed to set webhook' });
  }
});

router.delete('/webhook', async (_req: Request, res: Response) => {
  try {
    await bot.api.deleteWebhook();
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    res.status(500).json({ success: false, error: 'Failed to delete webhook' });
  }
});

export default router;
