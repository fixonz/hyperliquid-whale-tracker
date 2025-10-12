# Quick Start Guide - Get Running in 5 Minutes

## Step 1: Add Whale Addresses (Choose One Method)

### Option A: Auto-Discover from Recent Trades
```bash
node scripts/discover-whales.js
```
This will scan recent large trades and automatically add active whale addresses.

### Option B: Manually Add Known Whales
```bash
node scripts/add-whale.js 0xYourWhaleAddress
```

### Option C: Create Initial Whale List
Create `data/whales.json`:
```json
{
  "0xExample1": {
    "address": "0xExample1",
    "firstSeen": 1697000000000,
    "totalTrades": 0,
    "totalPnL": 0,
    "lastUpdated": 1697000000000
  }
}
```

**Note:** Without whale addresses, the system will run but won't have any positions to track. Start with at least 5-10 addresses for meaningful data.

## Step 2: Configure Alerts (Optional)

### Discord Alerts
1. Go to your Discord server → Settings → Integrations → Webhooks
2. Click "New Webhook"
3. Copy the webhook URL
4. Edit `.env` and set:
   ```env
   DISCORD_WEBHOOK_URL=your-webhook-url-here
   ```

### Telegram Alerts
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy your bot token
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID
5. Edit `.env` and set:
   ```env
   TELEGRAM_BOT_TOKEN=your-bot-token
   TELEGRAM_CHAT_ID=your-chat-id
   ```

## Step 3: Start the System

```bash
npm run dev
```

You should see:
```
🚀 Hyperliquid Liquidation Monitor Starting...
✓ Monitoring X addresses
✓ Poll interval: 5000ms
✓ Whale threshold: $100,000
📊 Monitoring started...
🌐 Dashboard server running on http://localhost:3000
```

## Step 4: Open the Dashboard

Navigate to: `http://localhost:3000`

You'll see:
- **Liquidation Heatmap** - Price levels with liquidation clusters
- **Whale Positions** - Live tracking of long/short positions
- **Recent Alerts** - Real-time notification feed
- **Top Whales** - Leaderboard of most profitable traders

## What You'll See

### Initially (First 30 seconds)
- Empty or minimal data while system scans
- Status shows "Connected"
- Scan counter incrementing

### After First Scan (30-60 seconds)
- Positions appear if whales are active
- Heatmap shows liquidation levels
- Stats update with tracking info

### Ongoing
- Real-time position updates
- Alerts when whales open/close positions
- Heatmap adjusts as prices move
- Dashboard refreshes every 5 seconds

## Understanding Alerts

### WHALE_OPEN
A whale opened a new position > $100k
```
🐋 Whale Position Opened
Asset: BTC | Side: LONG
Notional: $250,000 | Leverage: 10x
Entry: $45,000 | Liq: $42,750
```

### LIQUIDATION_RISK
A position is <10% from liquidation
```
⚠️ Liquidation Risk Alert
Asset: ETH | Side: SHORT
Distance to liq: 8.5%
Current: $3,850 | Liq: $4,200
```

### CLUSTER_ALERT
Large liquidation cluster detected
```
🔥 Liquidation Cluster Alert
Asset: BTC
Total: $5,000,000 between -2% and -5%
Longs: $4,500,000 | Shorts: $500,000
```

## Adjusting Settings

Edit `.env` to customize:

```env
# Scan more frequently (every 2 seconds)
POLL_INTERVAL_MS=2000

# Lower threshold to catch more positions
MIN_POSITION_SIZE_USD=25000

# Higher threshold for whale classification
WHALE_THRESHOLD_USD=250000
```

Restart the system after changes:
```bash
# Stop with Ctrl+C
# Then restart
npm run dev
```

## Finding More Whales

### Method 1: Watch for Large Trades
The system automatically discovers addresses from large trades.

### Method 2: Social Media
- Twitter: Search for "Hyperliquid whale" or "Hyperliquid trader"
- Discord: Join Hyperliquid community servers
- Telegram: Whale tracking groups

### Method 3: On-Chain Analysis
Monitor large USDC deposits to Hyperliquid contracts.

### Method 4: Community Lists
Ask in Hyperliquid communities for known profitable traders.

## Common Issues

### "No positions found"
**Solution:** Add more whale addresses. They might not be actively trading.

### "WebSocket disconnected"
**Solution:** Refresh the browser. Check if server is running.

### "No data for selected asset"
**Solution:** Switch to "All Assets" or wait for positions to be detected.

### Dashboard not loading
**Solution:** 
```bash
# Check if server is running
curl http://localhost:3000/api/stats

# Restart if needed
npm run dev
```

## Next Steps

1. **Add More Addresses** - More whales = more data
2. **Configure Alerts** - Get notified on Discord/Telegram
3. **Tune Thresholds** - Adjust for your needs
4. **Monitor Performance** - Watch the stats
5. **Analyze Patterns** - Learn from whale behavior

## Running 24/7

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start src/index.js --name hyperliquid-alerts
pm2 save
pm2 startup
```

Check status:
```bash
pm2 status
pm2 logs hyperliquid-alerts
```

### Using Screen (Simple)
```bash
screen -S hyperliquid
npm run dev
# Press Ctrl+A, then D to detach
# Reattach with: screen -r hyperliquid
```

## Getting Help

1. Read `PROJECT_SUMMARY.md` for detailed architecture
2. Check `SETUP_GUIDE.md` for comprehensive setup
3. Review `USAGE_EXAMPLES.md` for API usage
4. Test API: `node scripts/test-api.js`
5. Check logs for error messages

## Pro Tips

1. **Start Small** - Begin with 10-20 whale addresses
2. **Monitor the Leaderboard** - Track which whales are most profitable
3. **Follow the Smart Money** - Notice when top whales take positions
4. **Watch Clusters** - Large liquidation clusters often signal volatility
5. **Tune Alerts** - Adjust thresholds to reduce noise
6. **Check Regularly** - Review the dashboard during active trading hours
7. **Track Patterns** - Notice if whales favor certain assets/times
8. **Risk Management** - Never blindly copy trades, use as additional data

## Ready to Go?

```bash
# 1. Add whales (choose method above)
# 2. Start the system
npm run dev

# 3. Open dashboard
# http://localhost:3000

# 4. Watch the whales!
```

---

**Happy whale tracking!** 🐋

