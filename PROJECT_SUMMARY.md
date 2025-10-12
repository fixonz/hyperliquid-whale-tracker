# Hyperliquid Liquidation Alert Bot - Project Summary

## What Has Been Built

A comprehensive liquidation alert and whale tracking system for Hyperliquid that:

1. **Tracks Whale Wallets** - Monitors large positions and profitability
2. **Generates Liquidation Heatmaps** - Visualizes liquidation clusters at different price levels
3. **Sends Real-time Alerts** - Notifies when whales open/close positions or face liquidation risk
4. **Provides Web Dashboard** - Beautiful real-time visualization with matrix theme
5. **Exposes REST API** - For integration with other systems

## Project Structure

```
liquidations/
├── src/
│   ├── api/
│   │   └── hyperliquid.js          # Hyperliquid API client
│   ├── trackers/
│   │   └── whaleTracker.js         # Whale wallet tracking & profitability
│   ├── analyzers/
│   │   ├── liquidationAnalyzer.js  # Liquidation price calculations
│   │   └── heatmapGenerator.js     # Heatmap aggregation
│   ├── alerts/
│   │   └── alertManager.js         # Multi-channel alert system
│   ├── utils/
│   │   └── addressDiscovery.js     # Whale address discovery
│   ├── monitor.js                  # Main monitoring loop
│   ├── server.js                   # Web server + WebSocket
│   └── index.js                    # Entry point
├── public/
│   ├── index.html                  # Dashboard UI
│   ├── styles.css                  # Matrix-themed styling
│   └── app.js                      # Frontend JavaScript
├── scripts/
│   ├── add-whale.js                # Manually add whale addresses
│   └── discover-whales.js          # Auto-discover whales
├── examples/
│   ├── example-alert.json          # Alert structure example
│   └── example-heatmap.json        # Heatmap data example
├── data/                           # Local data storage
│   ├── whales.json                 # Tracked whales
│   └── positions.json              # Current positions
├── package.json
├── README.md
├── SETUP_GUIDE.md                  # Detailed setup instructions
└── USAGE_EXAMPLES.md               # API & usage examples
```

## Core Features

### 1. Whale Position Tracking

**File:** `src/trackers/whaleTracker.js`

- Tracks positions for configured wallet addresses
- Calculates realized and unrealized PnL
- Computes ROI and win rates
- Maintains historical performance data
- Identifies position changes (new/modified/closed)

### 2. Liquidation Analysis

**File:** `src/analyzers/liquidationAnalyzer.js`

- Calculates liquidation prices for long/short positions
- Measures distance to liquidation (% away)
- Identifies high-risk positions
- Groups positions by price level
- Predicts liquidation cascades

### 3. Heatmap Generation

**File:** `src/analyzers/heatmapGenerator.js`

- Aggregates liquidations at price levels
- Creates per-asset and global heatmaps
- Identifies significant liquidation clusters
- Visualizes long vs short liquidation zones
- Configurable price step granularity

### 4. Alert System

**File:** `src/alerts/alertManager.js`

**Alert Types:**
- `WHALE_OPEN` - Whale opens new large position
- `WHALE_CLOSE` - Whale closes position
- `LIQUIDATION_RISK` - Position <10% from liquidation
- `LARGE_POSITION` - Position exceeds whale threshold
- `CLUSTER_ALERT` - Large liquidation cluster detected

**Channels:**
- Console (colored terminal output)
- Discord (rich embeds)
- Telegram (HTML formatted)
- Custom webhooks (JSON)

### 5. Web Dashboard

**Files:** `public/index.html`, `public/styles.css`, `public/app.js`

**Features:**
- Real-time liquidation heatmap with price levels
- Position viewer (all/longs/shorts)
- Live alert feed
- Top whale leaderboard
- WebSocket-powered updates
- Matrix-themed dark interface (per user preference)

### 6. REST API

**File:** `src/server.js`

**Endpoints:**
```
GET  /api/stats           - Monitoring statistics
GET  /api/heatmap         - Liquidation heatmap
GET  /api/positions       - All positions
GET  /api/positions/:side - Longs or shorts
GET  /api/whales          - Top profitable whales
GET  /api/whales/:address - Specific whale
GET  /api/alerts          - Alert history
POST /api/addresses       - Add address to track
GET  /api/prices          - Current prices
```

### 7. Monitoring System

**File:** `src/monitor.js`

- Configurable polling interval
- Batch position fetching
- Automatic price updates
- Position change detection
- Performance statistics
- Graceful error handling

## How It Works

### Data Flow

```
1. Monitor polls Hyperliquid API every 5s (configurable)
   ↓
2. Fetches positions for tracked whale addresses
   ↓
3. WhaleTracker analyzes profitability & tracks changes
   ↓
4. LiquidationAnalyzer calculates liquidation risks
   ↓
5. HeatmapGenerator creates visualization data
   ↓
6. AlertManager sends notifications for important events
   ↓
7. Web server broadcasts updates via WebSocket
   ↓
8. Dashboard updates in real-time
```

### Key Algorithms

**PnL Calculation** (`whaleTracker.js:39-76`):
- Tracks position opens/closes
- Calculates realized PnL on position exits
- Aggregates unrealized PnL from open positions
- Computes ROI based on margin used

**Liquidation Price** (`liquidationAnalyzer.js:13-43`):
```
For LONG: liqPrice = entryPrice × (1 - (1/leverage - maintenanceMargin))
For SHORT: liqPrice = entryPrice × (1 + (1/leverage - maintenanceMargin))
```

**Heatmap Clustering** (`heatmapGenerator.js:110-155`):
- Buckets liquidations into price levels (0.5% steps)
- Identifies consecutive high-volume levels
- Aggregates long vs short exposure
- Highlights significant clusters

## Configuration

### Environment Variables

```env
# API Configuration
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz

# Monitoring Thresholds
POLL_INTERVAL_MS=5000           # Scan frequency
MIN_POSITION_SIZE_USD=50000     # Minimum position to track
WHALE_THRESHOLD_USD=100000      # Whale classification

# Alert Channels (Optional)
DISCORD_WEBHOOK_URL=            # Discord webhook
TELEGRAM_BOT_TOKEN=             # Telegram bot
TELEGRAM_CHAT_ID=               # Telegram chat
ALERT_WEBHOOK_URL=              # Custom webhook

# Server
PORT=3000                       # Dashboard port
```

### Customization

**Change Polling Frequency:**
Adjust `POLL_INTERVAL_MS` (default: 5000ms)

**Adjust Whale Threshold:**
Modify `WHALE_THRESHOLD_USD` (default: $100k)

**Change Heatmap Granularity:**
In `src/analyzers/heatmapGenerator.js`, adjust `priceStepPercent` (default: 0.5%)

**Maintenance Margin:**
In `src/analyzers/liquidationAnalyzer.js`, modify `maintenanceMarginRatio` (default: 3%)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file (copy from `.env.example`):
```env
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
POLL_INTERVAL_MS=5000
MIN_POSITION_SIZE_USD=50000
WHALE_THRESHOLD_USD=100000
PORT=3000
```

### 3. Add Whale Addresses

**Option A - Manual:**
```bash
node scripts/add-whale.js 0xWhaleAddress
```

**Option B - Auto-discover:**
```bash
node scripts/discover-whales.js
```

**Option C - Bulk import:**
Edit `data/whales.json` directly

### 4. Start the System

```bash
npm run dev
```

### 5. Open Dashboard

Navigate to `http://localhost:3000`

## Understanding the Dashboard

### Heatmap
- **Green bars** = Long liquidations
- **Red bars** = Short liquidations
- **Height** = Notional value at risk
- **X-axis** = % move from current price
- Hover for details

### Positions
- Shows tracked whale positions
- Color-coded: Long (green) / Short (red)
- Displays entry, current, liquidation prices
- Shows distance to liquidation
- Filter by all/longs/shorts

### Alerts Feed
- Real-time notification stream
- Whale opens/closes
- Liquidation risks
- Large position alerts
- Cluster warnings

### Top Whales
- Leaderboard by total PnL
- ROI percentages
- Realized vs unrealized PnL
- Trade counts
- Wallet addresses

## Data Storage

### whales.json
```json
{
  "0xAddress": {
    "address": "0xAddress",
    "firstSeen": 1697000000000,
    "totalTrades": 150,
    "realizedPnL": 50000,
    "unrealizedPnL": 10000,
    "totalPnL": 60000,
    "marginUsed": 100000,
    "roi": 60,
    "lastUpdated": 1697000000000
  }
}
```

### positions.json
```json
{
  "0xAddress_BTC": {
    "address": "0xAddress",
    "asset": "BTC",
    "side": "LONG",
    "size": 5.5,
    "entryPrice": 45000,
    "leverage": 10,
    "positionValue": 247500,
    "liquidationPx": 42750,
    "trackedSince": 1697000000000,
    "lastUpdated": 1697000000000
  }
}
```

## Alert Examples

### Discord Alert (Rich Embed)
![Whale Open Alert]
- Title: "🐋 Whale Position Opened"
- Asset, Side, Leverage
- Notional value, Entry price
- Liquidation price, Distance
- Wallet address

### Telegram Alert (HTML)
```
🐋 Whale Position Opened

Asset: BTC
Side: LONG
Leverage: 10.00x
Notional: $247,500
Entry: $45,000.00
Liquidation: $42,750.00
Distance: 5.00%

Wallet: 0x1234567...abcdef
```

### Console Alert (Colored)
```
================================================================================
[WHALE_OPEN] 2024-10-11T10:30:45.123Z
Asset: BTC
Wallet: 0x123456...abcdef
Side: LONG
Size: 5.5000
Notional: $247,500
Leverage: 10.00x
Entry: $45,000.00
Liquidation: $42,750.00
Distance to liq: 5.00%

Whale with +45.23% ROI opened LONG position
================================================================================
```

## Performance Considerations

### Scalability
- **10 addresses**: ~100ms scan time
- **100 addresses**: ~1s scan time
- **1000 addresses**: ~10s scan time

Adjust `POLL_INTERVAL_MS` accordingly.

### Memory Usage
- ~50MB base
- ~100KB per tracked address
- ~1KB per position
- History limited to 1000 entries

### API Rate Limits
Hyperliquid generally allows:
- ~60 requests/minute
- Batch endpoints recommended
- Monitor for 429 errors

## Advanced Features

### Cascade Prediction
`liquidationAnalyzer.predictCascade()` simulates:
- What positions liquidate at X% price move
- Total notional liquidated
- Affected assets

### Cluster Detection
`heatmapGenerator.identifyLiquidationClusters()`:
- Finds consecutive high-volume levels
- Identifies "walls" of liquidations
- Prioritizes by notional value

### Profitability Tracking
`whaleTracker.calculateRealizedPnL()`:
- Tracks all fills
- Computes position average entry
- Calculates realized P&L on exits
- Aggregates by wallet

## Security & Best Practices

1. **Never commit `.env`** - Contains sensitive webhooks
2. **Read-only API access** - Bot only reads, never trades
3. **Validate webhook URLs** - Ensure HTTPS
4. **Rate limit awareness** - Don't spam the API
5. **Data backup** - Backup `data/` directory regularly
6. **Error handling** - System continues on individual failures
7. **Resource monitoring** - Watch CPU/memory in production

## Production Deployment

### PM2 (Recommended)
```bash
pm2 start src/index.js --name hyperliquid-alerts
pm2 save
pm2 startup
```

### Docker
```bash
docker build -t hyperliquid-alerts .
docker run -d -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  hyperliquid-alerts
```

### Systemd Service
Create `/etc/systemd/system/hyperliquid-alerts.service`:
```ini
[Unit]
Description=Hyperliquid Liquidation Alerts
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/hyperliquid-alerts
ExecStart=/usr/bin/node src/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Future Enhancements

### Potential Features
1. **Historical Analysis** - Track liquidation patterns over time
2. **Smart Notifications** - ML-based alert filtering
3. **Social Integration** - Post to Twitter/Discord automatically
4. **Mobile App** - Push notifications
5. **Multi-Chain** - Support other perpetual protocols
6. **Strategy Backtesting** - Test following whale trades
7. **Portfolio Tracking** - Track your own positions
8. **Risk Scoring** - Rate whale risk tolerance
9. **Correlation Analysis** - Find whales that trade together
10. **API Rate Optimization** - Smarter batching

### Contributing
- Add more alert channels (Slack, Email, SMS)
- Improve heatmap visualization (3D, time-series)
- Add more discovery methods
- Optimize for lower latency
- Add unit tests
- Improve documentation

## Troubleshooting

See `SETUP_GUIDE.md` and `USAGE_EXAMPLES.md` for detailed troubleshooting steps.

## Support

For issues or questions:
1. Check `SETUP_GUIDE.md`
2. Review `USAGE_EXAMPLES.md`
3. Examine console logs
4. Verify API connectivity
5. Test with example addresses

## License

MIT License - See LICENSE file

---

**Built for tracking Hyperliquid whales and liquidation risks in real-time.**

