// Vercel Serverless Function - API Handler
import express from 'express';

const app = express();

app.use(express.json());

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Telegram webhook endpoint
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const text = message.text;
    
    // For now, just acknowledge - you'll send WebApp link
    if (text === '/start') {
      // Telegram will handle this via bot commands
      return res.status(200).send('OK');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to Telegram
  }
});

// Export for Vercel
export default app;
