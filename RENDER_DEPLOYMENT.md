# 🎨 Render.com Deployment Guide

## 🎯 Why Render?
- ✅ **100% FREE tier** - 750 hours/month (enough for 24/7!)
- ✅ Supports WebSockets for real-time dashboard
- ✅ Persistent connections for monitoring
- ✅ Auto-deploys from GitHub
- ✅ Easy setup - 5 minutes!

## 📝 Deployment Steps

### 1. Create Render Account
1. Go to **https://render.com**
2. Click **"Get Started"**
3. Sign up with **GitHub** (easiest option)

### 2. Push Your Code to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Hyperliquid Whale Tracker"

# Create GitHub repo and push
# Option A: Use GitHub CLI (easiest)
gh repo create hyperliquid-whale-tracker --public --source=. --remote=origin --push

# Option B: Manual
# 1. Create repo on github.com
# 2. Then run:
git remote add origin https://github.com/YOUR_USERNAME/hyperliquid-whale-tracker.git
git branch -M main
git push -u origin main
```

### 3. Create Web Service on Render

1. Go to **https://dashboard.render.com**
2. Click **"New +"** button
3. Select **"Web Service"**
4. Click **"Connect account"** if needed
5. Find and select your **hyperliquid-whale-tracker** repo
6. Click **"Connect"**

### 4. Configure Your Service

Fill in these settings:

**Name:** `hyperliquid-whale-tracker`

**Region:** Choose closest to you (e.g., Frankfurt, Oregon)

**Branch:** `main`

**Runtime:** `Node`

**Build Command:** `npm install`

**Start Command:** `npm start`

**Instance Type:** **FREE** ⭐

### 5. Add Environment Variables

Scroll down to **"Environment Variables"** section and add:

```
TELEGRAM_BOT_TOKEN = YOUR_BOT_TOKEN_HERE
TELEGRAM_CHAT_ID = YOUR_CHAT_ID_HERE
NODE_ENV = production
```

Click **"Add Environment Variable"** for each one.

### 6. Deploy!

1. Click **"Create Web Service"** at the bottom
2. Render will start building and deploying
3. Wait 2-3 minutes for deployment to complete
4. You'll see **"Your service is live 🎉"**

### 7. Get Your Render URL

Once deployed, you'll see your URL at the top:
- Format: `https://hyperliquid-whale-tracker.onrender.com`
- **Copy this URL** - you'll need it for the webhook

### 8. Set Up Telegram Bot Webhook

**Replace `YOUR_RENDER_URL` with your actual Render URL:**

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://YOUR_RENDER_URL/telegram-webhook\", \"allowed_updates\": [\"message\"]}"
```

**Example:**
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://hyperliquid-whale-tracker.onrender.com/telegram-webhook\", \"allowed_updates\": [\"message\"]}"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 9. Configure Bot Commands

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setMyCommands" \
  -H "Content-Type: application/json" \
  -d "{\"commands\": [{\"command\": \"start\", \"description\": \"Start the whale tracker\"}, {\"command\": \"dashboard\", \"description\": \"Open the tracking dashboard\"}, {\"command\": \"status\", \"description\": \"Check monitoring status\"}, {\"command\": \"help\", \"description\": \"Show help information\"}]}"
```

### 10. Verify Webhook

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

Should return your Render URL.

## 🎉 You're Live!

Your bot is now running 24/7 on Render for **FREE**!

### What You Have:
- ✅ **Telegram WebApp** - Mobile-optimized dashboard
- ✅ **Real-time monitoring** - 225 whale addresses tracked
- ✅ **Liquidation alerts** - Instant Telegram notifications
- ✅ **Interactive heatmap** - Visualize liquidation clusters
- ✅ **Desktop dashboard** - Access at your Render URL
- ✅ **24/7 uptime** - Running on Render cloud
- ✅ **100% FREE** - No credit card needed!

## 📱 How Users Access It

### Via Telegram (Mobile):
1. Find your bot on Telegram
2. Send `/start`
3. Click **"🚀 Open Dashboard"**
4. WebApp opens with whale tracking!

### Via Browser (Desktop):
1. Visit: `https://YOUR_RENDER_URL`
2. Full desktop dashboard with all features

## 🔍 Monitoring Your Deployment

### View Logs
1. Go to your Render dashboard
2. Click on your service
3. Click **"Logs"** tab

You'll see:
- ✅ Monitoring started
- ✅ Whale scanning progress
- ✅ Liquidation alerts
- ✅ API calls and responses

### Check Service Status
- **Dashboard shows:** "Your service is live"
- **Green indicator** = All good
- **Yellow/Red** = Check logs

## ⚠️ Important: Free Tier Limitations

### Auto-Sleep Feature
Render's free tier:
- **Spins down after 15 minutes** of inactivity
- **Wakes up automatically** when accessed (takes ~30 seconds)

### Keep It Awake (Optional)
To prevent sleep, use a service like **UptimeRobot**:

1. Go to **uptimerobot.com** (free)
2. Add your Render URL
3. Check every 5 minutes
4. Keeps your bot awake 24/7!

**OR** just accept the 30-second wake-up delay (usually fine for most users).

## 🚨 Troubleshooting

### Bot Not Responding?
1. **Check Render logs** for errors
2. Verify service is running (not sleeping)
3. Check webhook is set correctly

### Webhook Not Working?
```bash
# Check webhook status
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"

# Should show your Render URL
```

### Dashboard Not Loading?
1. Check Render deployment status
2. Verify environment variables are set
3. Check logs for startup errors
4. Service might be sleeping - access it to wake up

### Build Failed?
1. Check **"Events"** tab in Render
2. Common fixes:
   - Verify `package.json` is correct
   - Check Node.js version
   - Clear build cache and retry

## 🎯 Next Steps

### 1. Test Your Bot
- Send `/start` to your bot
- Click "Open Dashboard"
- Verify data loads correctly
- Check that alerts work

### 2. Set Up UptimeRobot (Optional)
Keep your bot awake 24/7:
1. Create free account at **uptimerobot.com**
2. Add monitor for your Render URL
3. Set check interval to 5 minutes

### 3. Share Your Bot
- Get bot username from @BotFather
- Share: `https://t.me/YOUR_BOT_USERNAME`
- Users get instant access!

### 4. Monitor Performance
- Check Render metrics
- Monitor logs for errors
- Track liquidation alerts

## 💡 Pro Tips

### Update Your Bot
Just push to GitHub:
```bash
git add .
git commit -m "Update bot features"
git push
```
Render auto-deploys! ✅

### View Real-Time Logs
```bash
# From Render dashboard, click "Logs" and enable "Auto-scroll"
# Watch your bot in action!
```

### Custom Domain (Optional)
1. Go to Render dashboard
2. Settings → Custom Domain
3. Add your domain
4. Update webhook URL

### Scale Up Later
If you outgrow free tier:
- Upgrade to **Starter ($7/month)**
- No sleep, more resources
- Better performance

## 📊 What to Expect

### Performance on Free Tier:
- **Cold start:** ~30 seconds (after 15min inactivity)
- **Response time:** Fast once running
- **Reliability:** Very good for free tier
- **Limitations:** Auto-sleep after 15min

### Resource Usage:
- **Memory:** ~100-150 MB
- **CPU:** Low usage
- **Network:** Moderate (API calls)

## 🚀 You're Live on Render!

Your Hyperliquid Whale Tracker is now:
- ✅ Running on Render cloud (FREE!)
- ✅ Accessible via Telegram WebApp
- ✅ Monitoring 225 whale addresses
- ✅ Sending real-time liquidation alerts
- ✅ Available 24/7 (with optional wake-up delay)

**Start tracking those whales! 🐋📱**

---

## 📞 Need Help?

- **Render Docs:** https://render.com/docs
- **Community:** Render community forum
- **Telegram Support:** Your bot's webhook logs

**Happy whale tracking!** 🎉
