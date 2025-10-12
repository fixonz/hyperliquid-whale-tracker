# 🐋 How to Get Hyperliquid Whale Addresses

Your liquidation bot needs **real Hyperliquid trader addresses** to track positions and liquidations.

## 🎯 Quick Start (Easiest Method)

### Option 1: Hyperliquid Leaderboard (Best Source)

1. **Visit**: https://app.hyperliquid.xyz/leaderboard
2. **Click on any top trader** in the list
3. **Copy their address** (starts with `0x...`)
4. **Repeat for 10-20 top traders**

### Option 2: Watch Large Trades

1. **Visit**: https://app.hyperliquid.xyz/
2. **Go to any market** (BTC, ETH, etc.)
3. **Look at the "Trades" tab** for large orders
4. **Click on trades** to see the trader address

### Option 3: Third-Party Trackers

1. **BaseHype Whale Tracker**: https://basehype.xyz
   - Shows top whale positions in real-time
   - Copy addresses from the leaderboard

2. **HyperTicker**: https://hyperticker.com/terminal/ETH
   - Shows top wallets for each asset
   - Displays high-volume trades

## 📝 How to Add Addresses

### Method 1: Interactive Script

```bash
node scripts/add-starter-whales.js
```

Follow the prompts to add addresses one by one.

### Method 2: Bulk Add (Fastest)

```bash
node scripts/bulk-add-whales.js
```

Paste multiple addresses at once (one per line), then press Enter twice.

### Method 3: Manual Edit

1. Create/edit `data/whales.json`
2. Add addresses in this format:

```json
{
  "0xYOUR_ADDRESS_HERE": {
    "address": "0xYOUR_ADDRESS_HERE",
    "firstSeen": 1760145683566,
    "totalTrades": 0,
    "realizedPnL": 0,
    "unrealizedPnL": 0,
    "totalPnL": 0,
    "marginUsed": 0,
    "roi": 0,
    "winRate": 0,
    "largestPosition": 0,
    "activePositions": 0,
    "lastUpdated": 1760145683566,
    "source": "manual",
    "lastActive": null
  }
}
```

## 🚀 Start Tracking

Once you've added addresses:

```bash
npm run dev
```

The bot will:
- ✅ Scan all addresses every 60 seconds
- ✅ Track their positions on Hyperliquid
- ✅ Calculate liquidation risks
- ✅ Send 5-minute digest reports to Telegram
- ✅ Show live heatmap on http://localhost:3000

## 💡 Tips

### Start Small
- Add 10-20 addresses to start
- See how the bot performs
- Add more as needed

### Focus on Large Accounts
- Look for traders with >$100k account value
- High-volume traders (>$1M daily volume)
- High-leverage positions (>10x)

### Update Regularly
- Top traders change over time
- Remove inactive addresses
- Add newly discovered whales

## 🔍 Example Addresses (For Testing)

**⚠️ These are examples only - get real addresses from the leaderboard!**

```
0x0000000000000000000000000000000000000000  (Test address with ~$30k)
```

## ❓ Need Help?

If you're having trouble finding addresses:

1. Check if https://app.hyperliquid.xyz/leaderboard loads
2. Look for the "Wallet" or "Address" column
3. Addresses should start with `0x` and be 42 characters long

---

**Ready to add addresses?**

```bash
# Interactive mode
node scripts/add-starter-whales.js

# Or bulk add
node scripts/bulk-add-whales.js
```

