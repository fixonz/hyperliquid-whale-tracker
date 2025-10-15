// Test the Telegram message format
const testAlert = {
  type: 'LIQUIDATION',
  timestamp: Date.now(),
  address: '0xf517639ab1ec7febea4f841d525785955b7fe0e812d6e86a',
  asset: 'BTC',
  side: 'LONG',
  notionalValue: 403000,
  entryPrice: 109867.45
};

// Simulate the formatTelegramMessage function
function formatTelegramMessage(alert) {
  const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
  const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
  const notionalFormatted = formatLargeNumber(alert.notionalValue || 0);
  const asset = (alert.asset || 'UNKNOWN').replace(/[<>&]/g, '');
  const address = (alert.address || '').replace(/[<>&]/g, '');
  
  let msg = `${sideEmoji} <a href="https://app.hyperliquid.xyz/explorer/account?address=${address}">${address.slice(0, 10)}...${address.slice(-8)}</a>\n`;
  const price = alert.entryPrice || 0;
  msg += `#${asset} Liquidated ${sideText}: $${notionalFormatted} at $${Number(price).toFixed(2)}`;
  
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
console.log('Telegram Message:');
console.log(message);
console.log('\nHTML Preview:');
console.log(message.replace(/<a href="([^"]+)">([^<]+)<\/a>/, '[$2]($1)'));
