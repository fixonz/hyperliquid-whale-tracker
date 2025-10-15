// Test the new detailed Telegram message format
const testAlert = {
  type: 'LIQUIDATION',
  timestamp: Date.now(),
  address: '0x4a1b35a266aa123456789abcdef1234567890abcd',
  asset: 'SOL',
  side: 'LONG',
  notionalValue: 40028.724,
  entryPrice: 176.86
};

// Simulate the formatTelegramMessage function
function formatTelegramMessage(alert) {
  const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
  const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
  const notionalFormatted = formatLargeNumber(alert.notionalValue || alert.notional || 0);
  const asset = (alert.asset || 'UNKNOWN').replace(/[<>&]/g, '');
  const address = (alert.address || '').replace(/[<>&]/g, '');
  
  const timeStr = new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
  
  const price = alert.entryPrice || 0;
  
  let msg = `${sideEmoji} <b>[LIQUIDATION]</b> <code>${timeStr}</code>\n`;
  msg += `Asset: <b>${asset}</b>\n`;
  msg += `Wallet: <code>${address.slice(0, 8)}...${address.slice(-6)}</code>\n`;
  msg += `Side: <b>${sideText}</b>\n`;
  msg += `Notional: <b>$${Number(alert.notionalValue || alert.notional || 0).toLocaleString()}</b>\n`;
  msg += `Entry: <code>$${Number(price).toFixed(2)}</code>\n`;
  msg += `<a href="https://app.hyperliquid.xyz/explorer/account?address=${address}">🔗 View on Hyperliquid</a>\n`;
  msg += `\n#${asset} Liquidated ${sideText}: $${notionalFormatted} at $${Number(price).toFixed(2)}`;
  
  return msg;
}

function formatLargeNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

const message = formatTelegramMessage(testAlert);
console.log('New Telegram Message Format:');
console.log(message);
