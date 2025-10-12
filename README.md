# Hyperliquid Liquidation Alert Bot

A sophisticated liquidation alert system for Hyperliquid that tracks whale positions, analyzes profitability, and provides real-time alerts with heatmap visualization.

## Features

- **Whale Position Tracking**: Monitors large positions from profitable wallets
- **Liquidation Heatmap**: Visualizes liquidation clusters at different price levels
- **Real-time Alerts**: Instant notifications when whales open new positions
- **Profitability Analysis**: Tracks wallet performance over time to identify top traders
- **Public Dashboard**: Web interface showing live liquidation risks and whale positions

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Configure your alert webhooks (Discord, Telegram, etc.)
3. Adjust thresholds for whale detection and position size

## Usage

```bash
# Start the monitoring bot
npm run monitor

# Start the web dashboard
npm run server

# Start both
npm run dev
```

## How It Works

1. **Data Collection**: Polls Hyperliquid API for user positions and market data
2. **Whale Identification**: Tracks wallets with positions > $100k and monitors their PnL
3. **Liquidation Calculation**: Estimates liquidation prices based on leverage and margin
4. **Heatmap Generation**: Aggregates potential liquidation volume at price levels
5. **Alert System**: Sends real-time notifications for whale position changes

## Architecture

- `src/api/hyperliquid.js` - Hyperliquid API client
- `src/trackers/whaleTracker.js` - Whale wallet identification and tracking
- `src/analyzers/liquidationAnalyzer.js` - Liquidation price calculations
- `src/analyzers/heatmapGenerator.js` - Aggregates liquidation data
- `src/alerts/alertManager.js` - Alert dispatch system
- `src/monitor.js` - Main monitoring loop
- `src/server.js` - Web dashboard server

## API Endpoints Used

- `/info` - User positions and clearinghouse states
- `/info/userFills` - Historical trades for profitability analysis
- Market data endpoints for price levels

