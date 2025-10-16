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

async function testMultipleLinks() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!telegramToken || !telegramChatId) {
    console.error('Missing Telegram credentials in .env file');
    return;
  }
  
  const address1 = "0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00";
  const address2 = "0x1234567890abcdef1234567890abcdef12345678";
  const address3 = "0xabcdef1234567890abcdef1234567890abcdef12";
  
  const wallet1 = `${address1.slice(0, 6)}...${address1.slice(-4)}`;
  const wallet2 = `${address2.slice(0, 6)}...${address2.slice(-4)}`;
  const wallet3 = `${address3.slice(0, 6)}...${address3.slice(-4)}`;
  
  const link1 = formatTelegramLink(address1, wallet1);
  const link2 = formatTelegramLink(address2, wallet2);
  const link3 = formatTelegramLink(address3, wallet3);
  
  const testMessage = `🧪 TEST: Multiple HTML Links

🚨 MAJOR BTC POSITIONS

💰 Total Volume: $45,000,000
📊 Positions: 3 (2L/1S)

1. LONG $20,000,000
   👤 ` + link1 + `
   📊 Entry: $45,000
   ⚡ Leverage: 10.0x

2. LONG $15,000,000
   👤 ` + link2 + `
   📊 Entry: $44,800
   ⚡ Leverage: 8.5x

3. SHORT $10,000,000
   👤 ` + link3 + `
   📊 Entry: $45,200
   ⚡ Leverage: 12.0x

All links should be clickable!`;

  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: telegramChatId,
      text: testMessage,
      parse_mode: 'HTML'
    });
    
    console.log('✅ Test message with multiple links sent!');
    console.log('Message ID:', response.data.result?.message_id);
    
  } catch (error) {
    console.error('❌ Error sending test message:', error.response?.data || error.message);
  }
}

testMultipleLinks();
