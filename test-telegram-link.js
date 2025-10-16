// Test script to check Telegram HTML link formatting

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

// Test the function
const address = "0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00";
const displayText = "0xecb6...2b00";

const link = formatTelegramLink(address, displayText);
console.log("Generated link:", link);

// Test with template literal
const message = `👤 ` + link + `\n`;
console.log("Message with link:", message);

// Test the exact format from the alert
const wallet = `${address.slice(0, 6)}...${address.slice(-4)}`;
const link2 = formatTelegramLink(address, wallet);
console.log("Wallet link:", link2);
