# Hyperliquid Liquidation Alert Bot - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` (note: .env file modification is restricted, so manually create it):

```env
# Hyperliquid Configuration
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws

# Monitoring Configuration
POLL_INTERVAL_MS=5000
MIN_POSITION_SIZE_USD=50000
WHALE_THRESHOLD_USD=100000

# Alert Configuration (Optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# Server Configuration
PORT=3000
```

### 3. Add Whale Addresses

Create `data/whales.json` with addresses to track:

```json
{
  "0xYourWhaleAddress1": {
    "address": "0xYourWhaleAddress1",
    "firstSeen": 1234567890000,
    "totalTrades": 0,
    "realizedPnL": 0,
    "unrealizedPnL": 0,
    "totalPnL": 0,
    "marginUsed": 0,
    "roi": 0,
    "winRate": 0,
    "largestPosition": 0,
    "activePositions": 0,
    "lastUpdated": 1234567890000
  }
}
```

### 4. Run the Bot

```bash
# Start both monitor and web dashboard
npm run dev

# Or run separately:
npm run monitor  # Just the monitoring bot
npm run server   # Just the web server
```

### 5. Access Dashboard

Open your browser to: `http://localhost:3000`

## Features Overview

### 🐋 Whale Tracking
- Monitors large positions (> $100k by default)
- Tracks profitability (ROI, PnL) over time
- Identifies top-performing traders

### 🔥 Liquidation Heatmap
- Visualizes liquidation clusters at different price levels
- Shows potential cascade risks
- Real-time price level analysis

### ⚠️ Alert System
Sends alerts for:
- **WHALE_OPEN**: When a whale opens a new large position
- **WHALE_CLOSE**: When a whale closes a position
- **LIQUIDATION_RISK**: When a position is < 10% from liquidation
- **LARGE_POSITION**: Positions above whale threshold
- **CLUSTER_ALERT**: Large liquidation clusters detected

### 📊 Dashboard
- Real-time heatmap visualization
- Live position tracking (longs/shorts)
- Alert feed
- Top whale leaderboard

## Configuration

### Monitoring Thresholds

- `MIN_POSITION_SIZE_USD`: Minimum position size to track (default: $50,000)
- `WHALE_THRESHOLD_USD`: Threshold for whale classification (default: $100,000)
- `POLL_INTERVAL_MS`: How often to scan positions (default: 5000ms)

### Alert Channels

#### Discord
1. Create a webhook in your Discord channel
2. Set `DISCORD_WEBHOOK_URL` in `.env`

#### Telegram
1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`

#### Custom Webhook
Set `ALERT_WEBHOOK_URL` to receive JSON alerts at your endpoint.

## Finding Whale Addresses

Since Hyperliquid doesn't expose all trader addresses, here are ways to find whales:

### 1. Monitor Large Trades
The bot will automatically discover addresses from large trades in recent trade data.

### 2. Social Media
Track addresses shared on:
- Twitter/X (whale tracking accounts)
- Discord communities
- Telegram groups

### 3. On-Chain Analysis
Monitor large USDC deposits to Hyperliquid contracts.

### 4. Manual Addition
Use the API to add addresses:

```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Content-Type: application/json" \
  -d '{"address": "0xWhaleAddress"}'
```

## API Endpoints

```
GET  /api/stats           - Monitoring statistics
GET  /api/heatmap         - Liquidation heatmap data
GET  /api/positions       - All tracked positions
GET  /api/positions/LONG  - Long positions only
GET  /api/positions/SHORT - Short positions only
GET  /api/whales          - Top profitable whales
GET  /api/whales/:address - Specific whale data
GET  /api/alerts          - Recent alerts
POST /api/addresses       - Add address to monitor
GET  /api/prices          - Current market prices
```

## Data Storage

Data is stored locally in the `data/` directory:
- `whales.json` - Whale tracking data
- `positions.json` - Current position tracking

## Troubleshooting

### No positions showing
- Make sure you've added whale addresses to track
- Check that addresses are actively trading
- Verify API connectivity: `curl https://api.hyperliquid.xyz/info`

### WebSocket disconnecting
- Check network stability
- Verify the server is running
- Look for firewall blocking WebSocket connections

### Alerts not sending
- Verify webhook URLs are correct
- Check API tokens/credentials
- Look at console for error messages

## Performance Tips

1. **Optimize polling interval**: Increase `POLL_INTERVAL_MS` if tracking many addresses
2. **Filter positions**: Adjust `MIN_POSITION_SIZE_USD` to reduce noise
3. **Limit tracked addresses**: Focus on most active/profitable whales

## Advanced Usage

### Running in Production

Use PM2 for process management:

```bash
npm install -g pm2
pm2 start src/index.js --name hyperliquid-alerts
pm2 save
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Monitoring Multiple Instances

Run multiple instances with different configurations:
- One for BTC/ETH whales
- One for altcoin whales
- One for specific strategies

## Security Notes

- Never commit `.env` files to version control
- Protect webhook URLs (they provide access to your channels)
- Use read-only API access when possible
- Run behind a reverse proxy in production

## Support & Community

For issues, feature requests, or questions:
- Check existing GitHub issues
- Join the community Discord
- Review Hyperliquid API docs: https://hyperliquid.gitbook.io/

## License

MIT License - See LICENSE file for details

