# 🚂 Railway Deployment Guide

## 🎯 Why Railway?
- ✅ Supports WebSockets for real-time dashboard
- ✅ Persistent connections for monitoring
- ✅ $5 FREE credit per month (enough for your bot!)
- ✅ Easy deployment from GitHub
- ✅ 24/7 uptime

## 📝 Deployment Steps

### 1. Create Railway Account
1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Sign up with **GitHub** (easiest)

### 2. Push Your Code to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Hyperliquid Whale Tracker"

# Create GitHub repo and push
# Option A: Use GitHub CLI
gh repo create hyperliquid-whale-tracker --public --source=. --remote=origin --push

# Option B: Manual (create repo on github.com first)
git remote add origin https://github.com/YOUR_USERNAME/hyperliquid-whale-tracker.git
git branch -M main
git push -u origin main
```

### 3. Deploy on Railway

1. Go to **https://railway.app/new**
2. Click **"Deploy from GitHub repo"**
3. Select your **hyperliquid-whale-tracker** repository
4. Click **"Deploy Now"**

Railway will automatically:
- ✅ Detect it's a Node.js app
- ✅ Install dependencies
- ✅ Start your bot
- ✅ Assign a public URL

### 4. Add Environment Variables

In your Railway project dashboard:

1. Click on your project
2. Go to **"Variables"** tab
3. Add these variables:

```
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID=YOUR_CHAT_ID_HERE
PORT=3000
NODE_ENV=production
```

4. Click **"Deploy"** to restart with new variables

### 5. Get Your Railway URL

1. In your project dashboard, go to **"Settings"**
2. Scroll to **"Domains"**
3. Click **"Generate Domain"**
4. Copy your URL (e.g., `hyperliquid-whale-tracker.up.railway.app`)

### 6. Set Up Telegram Bot Webhook

**Replace `YOUR_RAILWAY_URL` with your actual Railway domain:**

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://YOUR_RAILWAY_URL/telegram-webhook\", \"allowed_updates\": [\"message\"]}"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 7. Configure Bot Commands

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setMyCommands" \
  -H "Content-Type: application/json" \
  -d "{\"commands\": [{\"command\": \"start\", \"description\": \"Start the whale tracker\"}, {\"command\": \"dashboard\", \"description\": \"Open the tracking dashboard\"}, {\"command\": \"status\", \"description\": \"Check monitoring status\"}, {\"command\": \"help\", \"description\": \"Show help information\"}]}"
```

## 🎉 That's It!

Your bot is now running 24/7 on Railway!

### What You Have:
- ✅ **Telegram WebApp** - Mobile-optimized dashboard
- ✅ **Real-time monitoring** - 225 whale addresses tracked
- ✅ **Liquidation alerts** - Instant notifications
- ✅ **Interactive heatmap** - Visualize liquidation clusters
- ✅ **24/7 uptime** - Running on Railway cloud

## 📱 How Users Access It

1. **Find your bot** on Telegram
2. Send `/start`
3. Click **"🚀 Open Dashboard"**
4. Get **instant access** to whale tracking!

## 🔍 Monitoring Your Deployment

### View Logs
1. Go to your Railway project
2. Click on your service
3. Click **"Deployments"** tab
4. Click **"View Logs"**

You'll see:
- Monitoring status
- Whale scanning progress
- Liquidation alerts
- API calls

### Check Resource Usage
1. Go to **"Metrics"** tab
2. Monitor:
   - CPU usage
   - Memory usage
   - Network traffic

Your bot should use:
- **~50-100 MB RAM**
- **~1-5% CPU**
- **~$3-4/month** from your $5 credit

## 🚨 Troubleshooting

### Bot Not Responding?
**Check logs in Railway dashboard**

### Webhook Not Working?
```bash
# Verify webhook is set
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

### Dashboard Not Loading?
- Check Railway deployment status
- Verify environment variables are set
- Check logs for errors

### Running Out of Credit?
Railway gives you **$5/month free**. Your bot uses ~$3-4/month.

If you need more:
- Add a credit card (no charge unless you exceed free tier)
- Or optimize polling interval

## 🎯 Next Steps

### 1. Test Everything
- Send `/start` to your bot
- Open the dashboard
- Verify data loads
- Check alerts work

### 2. Share Your Bot
- Get bot username from @BotFather
- Share: `https://t.me/YOUR_BOT_USERNAME`
- Users can start tracking immediately!

### 3. Monitor Performance
- Check Railway metrics
- Monitor credit usage
- Adjust polling intervals if needed

## 💡 Pro Tips

### Optimize Credit Usage
If running low on credits, you can:

1. **Increase poll interval** (in `.env`):
```
POLL_INTERVAL_MS=120000  # 2 minutes instead of 1
```

2. **Reduce tracked addresses**:
```
# Keep only most active whales
```

3. **Add sleep periods**:
```
# Bot sleeps during low-activity hours
```

### Add More Features
- Custom whale lists per user
- Price alerts
- PnL tracking
- Export data to CSV

## 🚀 You're Live on Railway!

Your Hyperliquid Whale Tracker is now:
- ✅ Running 24/7 in the cloud
- ✅ Accessible via Telegram WebApp
- ✅ Monitoring 225 whale addresses
- ✅ Sending real-time liquidation alerts
- ✅ Completely FREE (within Railway's $5 credit)

**Start sharing your bot and track those whales! 🐋📱**
