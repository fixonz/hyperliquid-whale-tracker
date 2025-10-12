# Usage Examples

## Basic Usage

### 1. Start the System

```bash
# Install dependencies
npm install

# Start monitoring and dashboard
npm run dev
```

### 2. Access Dashboard

Open `http://localhost:3000` in your browser to see:
- Real-time liquidation heatmap
- Whale positions (longs/shorts)
- Alert feed
- Top profitable whales

## Adding Whale Addresses

### Method 1: Manual Addition

```bash
node scripts/add-whale.js 0xYourWhaleAddress
```

### Method 2: Automatic Discovery

```bash
node scripts/discover-whales.js
```

This scans recent large trades and adds active whale addresses.

### Method 3: Via API

```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Content-Type: application/json" \
  -d '{"address": "0xWhaleAddress"}'
```

### Method 4: Bulk Import

Create `data/whales.json`:

```json
{
  "0xWhaleAddress1": {
    "address": "0xWhaleAddress1",
    "firstSeen": 1697000000000,
    "totalTrades": 0,
    "totalPnL": 0,
    "lastUpdated": 1697000000000
  },
  "0xWhaleAddress2": {
    "address": "0xWhaleAddress2",
    "firstSeen": 1697000000000,
    "totalTrades": 0,
    "totalPnL": 0,
    "lastUpdated": 1697000000000
  }
}
```

## Setting Up Alerts

### Discord Alerts

1. Go to your Discord channel settings
2. Integrations → Webhooks → New Webhook
3. Copy the webhook URL
4. Add to `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefg...
```

### Telegram Alerts

1. Create a bot via [@BotFather](https://t.me/botfather)
   - Send `/newbot`
   - Choose a name and username
   - Copy the bot token

2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
   - Send any message to the bot
   - Copy your ID

3. Add to `.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### Custom Webhook

For your own alert endpoint:

```env
ALERT_WEBHOOK_URL=https://your-domain.com/api/alerts
```

Alert JSON format:
```json
{
  "type": "WHALE_OPEN",
  "address": "0x...",
  "asset": "BTC",
  "side": "LONG",
  "size": 5.5,
  "entryPrice": 45000,
  "leverage": 10,
  "notionalValue": 247500,
  "liquidationPrice": 42750,
  "timestamp": 1697000000000
}
```

## API Usage Examples

### Get Liquidation Heatmap

```bash
curl http://localhost:3000/api/heatmap
```

Response includes price levels with liquidation clusters.

### Get All Positions

```bash
curl http://localhost:3000/api/positions
```

### Get Only Long Positions

```bash
curl http://localhost:3000/api/positions/LONG
```

### Get Only Short Positions

```bash
curl http://localhost:3000/api/positions/SHORT
```

### Get Top Whales

```bash
# Top 20 whales (default)
curl http://localhost:3000/api/whales

# Top 50 whales
curl "http://localhost:3000/api/whales?count=50"
```

### Get Specific Whale Data

```bash
curl http://localhost:3000/api/whales/0xWhaleAddress
```

### Get Recent Alerts

```bash
# Last 100 alerts (default)
curl http://localhost:3000/api/alerts

# Last 50 alerts
curl "http://localhost:3000/api/alerts?limit=50"
```

### Get Current Prices

```bash
curl http://localhost:3000/api/prices
```

### Get Monitoring Stats

```bash
curl http://localhost:3000/api/stats
```

## WebSocket Integration

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'init') {
    console.log('Initial data:', data.data);
  }
  
  if (data.type === 'update') {
    console.log('Real-time update:', data.data);
  }
};
```

## Configuration Examples

### High-Frequency Trading Monitoring

```env
POLL_INTERVAL_MS=2000
MIN_POSITION_SIZE_USD=25000
WHALE_THRESHOLD_USD=50000
```

### Conservative Whale-Only Tracking

```env
POLL_INTERVAL_MS=10000
MIN_POSITION_SIZE_USD=100000
WHALE_THRESHOLD_USD=500000
```

### Multi-Asset Monitoring

Modify `scripts/discover-whales.js`:

```javascript
const COINS = [
  'BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC', 'AVAX',
  'DOGE', 'ATOM', 'DOT', 'LINK', 'UNI', 'AAVE'
];
```

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name hyperliquid-alerts

# Save configuration
pm2 save

# Set up auto-start on boot
pm2 startup
```

### Using Docker

Build and run:

```bash
docker build -t hyperliquid-alerts .
docker run -d \
  --name hyperliquid-alerts \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e DISCORD_WEBHOOK_URL="your-webhook" \
  hyperliquid-alerts
```

### Behind Nginx

```nginx
server {
  listen 80;
  server_name alerts.yourdomain.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Monitoring and Debugging

### Check Logs

```bash
# If running with PM2
pm2 logs hyperliquid-alerts

# If running directly
npm run dev
```

### Test API Connection

```bash
curl -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type": "allMids"}'
```

### Verify Whale Data

```bash
cat data/whales.json | jq '.'
cat data/positions.json | jq '.'
```

## Advanced Use Cases

### Custom Alert Logic

Create `src/alerts/customAlerts.js`:

```javascript
export class CustomAlerts {
  shouldAlert(position, whale) {
    // Custom logic
    if (whale.roi > 50 && position.leverage > 20) {
      return {
        type: 'HIGH_RISK_WHALE',
        message: 'High ROI whale using extreme leverage'
      };
    }
    return null;
  }
}
```

### Position Size Scaling

Track when whales scale into positions:

```javascript
// In monitor.js, add logic to detect increasing position sizes
const previousSize = this.whaleTracker.getPosition(positionId)?.size || 0;
if (position.size > previousSize * 1.5) {
  // Whale is scaling in - send alert
}
```

### Correlation Analysis

Track when multiple whales take similar positions:

```javascript
const longBTC = positions.filter(p => p.asset === 'BTC' && p.side === 'LONG');
if (longBTC.length >= 5) {
  // Multiple whales are long BTC - potential signal
}
```

## Troubleshooting

### No Data Showing

1. Check if addresses are added:
   ```bash
   cat data/whales.json
   ```

2. Verify API connectivity:
   ```bash
   curl https://api.hyperliquid.xyz/info \
     -H "Content-Type: application/json" \
     -d '{"type": "allMids"}'
   ```

3. Check console for errors:
   ```bash
   npm run dev
   ```

### Alerts Not Sending

1. Test Discord webhook:
   ```bash
   curl -X POST "YOUR_DISCORD_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content": "Test alert"}'
   ```

2. Test Telegram:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test"
   ```

### High Memory Usage

1. Reduce tracked addresses
2. Increase `POLL_INTERVAL_MS`
3. Limit alert history in memory
4. Clear old position data

## Best Practices

1. **Start Small**: Begin with 10-20 whale addresses
2. **Monitor Performance**: Check CPU/memory usage
3. **Validate Addresses**: Ensure addresses are actively trading
4. **Regular Backups**: Backup `data/` directory
5. **Log Rotation**: Implement log rotation for long-running instances
6. **Rate Limiting**: Respect API rate limits
7. **Alert Fatigue**: Tune thresholds to avoid too many alerts
8. **Data Retention**: Periodically clean old data

