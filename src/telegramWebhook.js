import express from 'express';
import axios from 'axios';

const router = express.Router();

// Telegram bot commands
router.post('/telegram-webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(200).send('OK');
    }

    const chatId = message.chat.id;
    const text = message.text;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).send('Bot token not configured');
    }

    // Handle commands
    if (text === '/start') {
      await sendWelcomeMessage(chatId, botToken);
    } else if (text === '/dashboard') {
      await sendDashboardLink(chatId, botToken);
    } else if (text === '/help') {
      await sendHelpMessage(chatId, botToken);
    } else if (text === '/status') {
      await sendStatusMessage(chatId, botToken);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

async function sendWelcomeMessage(chatId, botToken) {
  const webAppUrl = process.env.VERCEL_URL ? 
    `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000';
  
  const message = `🐋 <b>Welcome to Hyperliquid Whale Tracker!</b>

Track whale liquidations and positions in real-time.

<b>🚀 Quick Start:</b>
• Click "Open Dashboard" below to view the live tracker
• Get instant alerts when whales get liquidated
• See liquidation heatmaps and risk clusters

<b>📊 Features:</b>
• 225+ whale wallets monitored
• Real-time liquidation alerts
• Interactive heatmap visualization
• Mobile-optimized interface

<b>🎯 Commands:</b>
/dashboard - Open the tracking dashboard
/status - Check monitoring status
/help - Show this help message

Click the button below to start tracking!`;

  const keyboard = {
    inline_keyboard: [
      [{
        text: '🚀 Open Dashboard',
        web_app: { url: `${webAppUrl}/telegram-app.html` }
      }],
      [{
        text: '📊 View Heatmap',
        web_app: { url: `${webAppUrl}/telegram-app.html#heatmap` }
      }]
    ]
  };

  await sendTelegramMessage(chatId, message, botToken, keyboard);
}

async function sendDashboardLink(chatId, botToken) {
  const webAppUrl = process.env.VERCEL_URL ? 
    `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000';

  const message = `🐋 <b>Open Whale Tracker Dashboard</b>

Click the button below to access the live whale tracking dashboard with:
• Real-time liquidation alerts
• Interactive heatmap
• Whale position monitoring
• Mobile-optimized interface`;

  const keyboard = {
    inline_keyboard: [
      [{
        text: '🚀 Open Dashboard',
        web_app: { url: `${webAppUrl}/telegram-app.html` }
      }]
    ]
  };

  await sendTelegramMessage(chatId, message, botToken, keyboard);
}

async function sendHelpMessage(chatId, botToken) {
  const message = `🐋 <b>Hyperliquid Whale Tracker - Help</b>

<b>🎯 What This Bot Does:</b>
• Tracks 225+ whale wallets on Hyperliquid
• Sends real-time liquidation alerts
• Shows liquidation heatmaps and risk clusters
• Monitors large position openings/closings

<b>📱 How to Use:</b>
• Use /dashboard to open the tracking interface
• The dashboard works perfectly on mobile
• Get instant notifications when liquidations happen
• View heatmaps to see where liquidations cluster

<b>🔔 Alert Types:</b>
• 🔥 <b>LIQUIDATION:</b> When a whale position gets liquidated
• 🐋 <b>WHALE_OPEN:</b> When a whale opens a large position
• ⚠️ <b>RISK:</b> When positions are near liquidation
• 🆕 <b>NEW_WHALE:</b> When new whale wallets are discovered

<b>📊 Dashboard Features:</b>
• Live liquidation heatmap
• Real-time whale activity feed
• Position monitoring
• Risk assessment

<b>🎮 Commands:</b>
/start - Welcome message
/dashboard - Open tracking dashboard
/status - Check monitoring status
/help - Show this help

<b>💡 Pro Tip:</b>
Bookmark the dashboard for quick access to whale tracking!`;

  await sendTelegramMessage(chatId, message, botToken);
}

async function sendStatusMessage(chatId, botToken) {
  // You can integrate with your monitoring system here
  const message = `🐋 <b>Whale Tracker Status</b>

<b>📊 Current Status:</b>
• ✅ System Online
• 🐋 225+ whales tracked
• 🔄 Real-time monitoring active
• 📱 Mobile dashboard available

<b>🚀 Quick Actions:</b>
Click below to open the dashboard and start tracking!`;

  const keyboard = {
    inline_keyboard: [
      [{
        text: '🚀 Open Dashboard',
        web_app: { url: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/telegram-app.html` }
      }]
    ]
  };

  await sendTelegramMessage(chatId, message, botToken, keyboard);
}

async function sendTelegramMessage(chatId, text, botToken, replyMarkup = null) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    await axios.post(url, payload);
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

export default router;
