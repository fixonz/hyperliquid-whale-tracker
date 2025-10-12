# 🎉 What's New - Advanced Whale Tracking

## 🆕 New Features Added

### 1. **5-Minute Digest Mode** ✅
No more spam! One comprehensive report every 5 minutes instead of 1000 tiny alerts.

**Includes:**
- 🚨 **Headline**: "JUST IN: $X MILLION LIQUIDATED IN PAST 5 MINUTES"
- 💰 Total volume moved
- 🟢 Top long positions opened
- 🔴 Top short positions opened
- ⚠️ Positions closest to liquidation
- 🔥 Large liquidation clusters
- 💥 Actual liquidations detected

**Example:**
```
🚨 JUST IN: $12.5 MILLION LIQUIDATED IN PAST 5 MINUTES 🚨
3 positions wiped out

💰 TOTAL VOLUME: $45.2 MILLION moved in 5 minutes
```

---

### 2. **Dormant Whale Tracking** 🌅 ✅
Automatically detects when whales that have been inactive for 7+ days suddenly wake up and start trading again.

**Alerts show:**
- How long the whale was dormant
- Their historical ROI
- What position they just opened
- Their past performance

**Example:**
```
🌅 DORMANT WHALES WAKING UP
  0x527366... | Dormant for 45 days
    Just opened: BTC LONG $2.5M 12x
    Historical ROI: 52.3% | PnL: $850K
```

**Why this matters:** Dormant whales waking up often signal major market moves!

---

### 3. **Automated Whale Discovery** 🔍
Script to automatically find whale addresses from multiple sources.

**Run it:**
```bash
node scripts/fetch-top-whales.js
```

**Sources it checks:**
- Hyperliquid API endpoints
- Recent large trades
- Public whale lists (add your own)
- Can integrate with Dune Analytics

**Note:** Hyperliquid API doesn't easily expose addresses, so you'll still need to manually add whales from the leaderboard.

---

### 4. **Liquidation Detection** 💥
Automatically detects when positions get liquidated (not just at risk).

**Tracks:**
- Position disappears
- Price moved past liquidation level
- Total liquidated value
- Number of positions wiped out

Adds to digest:
```
⚡ Liquidated: 3 positions ($12.5M)
```

---

## 📊 How Your Digest Looks Now

### Console Output:
```
================================================================================
📊 5 MINUTE ACTIVITY DIGEST
10:35:00 PM - 10:40:00 PM
================================================================================

🚨 JUST IN: $12.5 MILLION LIQUIDATED IN PAST 5 MINUTES 🚨
   3 positions wiped out

💰 TOTAL VOLUME: $45.2 MILLION moved in 5 minutes

📈 SUMMARY
  Longs Opened: 8 ($28.5M)
  Shorts Opened: 5 ($16.7M)
  Highest Leverage: 15.0x
  Positions at Risk: 12
  ⚡ Liquidated: 3 positions ($12.5M)
  🔥 At-Risk in Clusters: $87.3M

🟢 NEW LONG POSITIONS (8)
  BTC | $8.5M | 12x
    0x527366... | Entry: $112,450.00 | ROI: 45.2%
  [... top positions]

🔴 NEW SHORT POSITIONS (5)
  BTC | $5.5M | 12x
    0x2ea18c... | Entry: $112,600.00 | ROI: 38.7%
  [... top positions]

🌅 DORMANT WHALES WAKING UP
  0x527366... | Dormant for 45 days
    Just opened: BTC LONG $2.5M 12x
    Historical ROI: 52.3% | PnL: $850K

⚠️  LIQUIDATION RISKS
  BTC LONG | 3.2% away | $8.5M
  [... closest to liquidation]

🔥 LIQUIDATION CLUSTERS
  BTC | $45.8M at -2.5% to -5.0%
    Longs: $38.2M | Shorts: $7.6M
  [... major clusters]

================================================================================
```

### Telegram Message:
Same format, optimized for mobile with emojis and formatting!

---

## 🚀 How to Use

### 1. Update Your `.env`:
```env
POLL_INTERVAL_MS=60000              # Scan every 60 seconds
MIN_POSITION_SIZE_USD=1000000       # Only $1M+ positions
WHALE_THRESHOLD_USD=1000000         # Only alert on $1M+ 
```

### 2. Add More Whales:

**Manual Method (Easiest):**
1. Go to https://app.hyperliquid.xyz/leaderboard
2. Copy top 20-50 addresses
3. Run:
   ```bash
   node scripts/bulk-add-whales.js 0xAddr1 0xAddr2 0xAddr3...
   ```

**Auto-Discovery (Try it):**
```bash
node scripts/fetch-top-whales.js
```

### 3. Start the Bot:
```bash
npm run dev
```

### 4. Wait 5 Minutes:
First digest appears after 5 minutes of scanning.

---

## 🎯 What Gets Tracked

### Per Whale:
- ✅ Total PnL (realized + unrealized)
- ✅ ROI percentage
- ✅ Active positions
- ✅ Last active timestamp
- ✅ **Dormancy status** (new!)
- ✅ **Days dormant** (new!)
- ✅ **Wake-up detection** (new!)

### Per Digest:
- ✅ All new longs opened
- ✅ All new shorts opened
- ✅ Positions at liquidation risk
- ✅ **Actual liquidations** (new!)
- ✅ **Dormant whales waking up** (new!)
- ✅ Liquidation clusters
- ✅ **Total volume moved** (new!)

---

## 💡 Pro Tips

### Finding Top 100 Whales:

**Method 1: Hyperliquid Leaderboard**
- Visit https://app.hyperliquid.xyz/leaderboard
- Copy top 50-100 addresses
- Add with bulk script

**Method 2: Dune Analytics**
- Search for "Hyperliquid" dashboards
- Find trader analytics
- Export addresses

**Method 3: Community**
- Join Hyperliquid Discord
- Ask for known profitable traders
- Share addresses with community

**Method 4: Monitor Live**
- Watch trading interface
- Note addresses making large trades
- Add them to tracking

**Method 5: Twitter/X**
- Follow whale tracking accounts
- They often share addresses
- Look for "Hyperliquid whale watch"

### Dormant Whale Signals:

**Why they matter:**
- Often have inside information
- Wake up before major moves
- High success rate historically
- Can signal trend reversals

**Best practices:**
- Pay attention to 30+ day dormant whales
- Check what they're opening (long/short)
- Note if multiple dormant whales wake up together
- Higher leverage = more conviction

### Tuning Thresholds:

**Conservative (fewer alerts):**
```env
MIN_POSITION_SIZE_USD=2000000       # $2M+
WHALE_THRESHOLD_USD=2000000
```

**Balanced:**
```env
MIN_POSITION_SIZE_USD=1000000       # $1M+
WHALE_THRESHOLD_USD=1000000
```

**Aggressive (more data):**
```env
MIN_POSITION_SIZE_USD=500000        # $500K+
WHALE_THRESHOLD_USD=500000
```

---

## 📡 API Endpoints

Added to your server:

```
GET  /api/whales/dormant          # Get dormant whales
GET  /api/whales/woken            # Get recently woken whales
```

---

## 🔮 Future Enhancements

Ideas for v2:
- [ ] Integrate with Dune Analytics API
- [ ] Automatic address discovery from on-chain data
- [ ] ML-based whale performance prediction
- [ ] Copy-trading suggestions
- [ ] Correlation analysis (whales trading together)
- [ ] Historical wake-up success rate
- [ ] Whale "groups" (wallets that move together)
- [ ] Early entry alerts (before whales)

---

## 📝 Quick Reference

### Your Whale Count:
```bash
# Check how many whales you're tracking
cat data/whales.json | grep "address" | wc -l
```

### Add Whales:
```bash
# Single
node scripts/add-whale.js 0xAddress

# Bulk
node scripts/bulk-add-whales.js 0xAddr1 0xAddr2 0xAddr3

# Auto-discover
node scripts/fetch-top-whales.js
```

### Check Dormant Whales:
The bot automatically tracks this, but you can see them in `data/whales.json` - look for `"wasDormant": true` and `"dormantSince"` fields.

### Start Bot:
```bash
npm run dev
```

---

## 🎉 Summary

You now have:
1. ✅ **Digest mode** - Clean 5-minute summaries instead of spam
2. ✅ **Liquidation headlines** - "$X MILLION LIQUIDATED" alerts
3. ✅ **Dormant whale tracking** - Know when big players wake up
4. ✅ **Automated discovery** - Scripts to find more whales
5. ✅ **Total volume tracking** - See market activity at a glance
6. ✅ **Liquidation detection** - Track actual wipeouts, not just risks

**All alerts go to:**
- Console (colored, formatted)
- Telegram (your group)
- Discord (if configured)
- Web dashboard (http://localhost:3000)

**Next step:** Go grab those top 100 whale addresses from the leaderboard! 🚀

