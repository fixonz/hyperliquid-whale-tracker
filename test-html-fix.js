import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function formatTelegramLink(address, displayText) {
  // Escape HTML special characters in the display text
  const escapedText = displayText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Ensure the URL is properly formatted
  const url = `https://hyperliquid-whale-tracker.onrender.com/summary/${address}`;
  
  return `<a href="${url}">${escapedText}</a>`;
}

async function testHTMLFix() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!telegramToken || !telegramChatId) {
    console.error('Missing Telegram credentials in .env file');
    return;
  }
  
  const address = "0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00";
  const wallet = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const link = formatTelegramLink(address, wallet);
  
  // Test the exact format from the alert
  const testMessage = `🔥 HOT POSITION

💰 PAXG SHORT
💵 Size: $1.1M
⚡ Leverage: 5.0x
👤 ` + link;

  console.log('Generated link:', link);
  console.log('Full message:', testMessage);

  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: telegramChatId,
      text: testMessage,
      parse_mode: 'HTML'
    });
    
    console.log('✅ Test message sent successfully!');
    console.log('Message ID:', response.data.result?.message_id);
    
  } catch (error) {
    console.error('❌ Error sending test message:', error.response?.data || error.message);
  }
}

testHTMLFix();
