# 🚀 Vercel Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] Mobile-optimized Telegram WebApp created
- [x] Webhook endpoint configured
- [x] vercel.json configuration file ready
- [x] Environment variables identified
- [x] Bot commands defined

## 📝 Deployment Steps

### 1. Install Vercel CLI (if not already installed)
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy Your Project
```bash
vercel
```

**Follow the prompts:**
- Set up and deploy? **Y**
- Which scope? (Select your account)
- Link to existing project? **N**
- What's your project's name? `hyperliquid-whale-tracker`
- In which directory is your code located? `./`
- Want to override the settings? **N**

### 4. Set Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables:
```
TELEGRAM_BOT_TOKEN=8150022576:AAHnjCfXgev0kwkrsFVI1fQHOLz5KrttvbQ
TELEGRAM_CHAT_ID=1003197577020
NODE_ENV=production
```

**Or use CLI:**
```bash
vercel env add TELEGRAM_BOT_TOKEN
# Paste: 8150022576:AAHnjCfXgev0kwkrsFVI1fQHOLz5KrttvbQ

vercel env add TELEGRAM_CHAT_ID
# Paste: 1003197577020

vercel env add NODE_ENV
# Paste: production
```

### 5. Redeploy with Environment Variables
```bash
vercel --prod
```

**Copy your deployment URL** (e.g., `https://hyperliquid-whale-tracker.vercel.app`)

### 6. Set Up Telegram Bot Webhook

**Replace `YOUR_DEPLOYMENT_URL` with your Vercel URL:**

```bash
curl -X POST "https://api.telegram.org/bot8150022576:AAHnjCfXgev0kwkrsFVI1fQHOLz5KrttvbQ/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://YOUR_DEPLOYMENT_URL/telegram-webhook\", \"allowed_updates\": [\"message\"]}"
```

**Expected response:**
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 7. Configure Bot Commands

```bash
curl -X POST "https://api.telegram.org/bot8150022576:AAHnjCfXgev0kwkrsFVI1fQHOLz5KrttvbQ/setMyCommands" \
  -H "Content-Type: application/json" \
  -d "{\"commands\": [{\"command\": \"start\", \"description\": \"Start the whale tracker\"}, {\"command\": \"dashboard\", \"description\": \"Open the tracking dashboard\"}, {\"command\": \"status\", \"description\": \"Check monitoring status\"}, {\"command\": \"help\", \"description\": \"Show help information\"}]}"
```

### 8. Update Telegram WebApp Button URL

**Edit `src/telegramWebhook.js` if needed** and update the `webAppUrl` with your actual Vercel URL, then redeploy:

```bash
vercel --prod
```

## 🧪 Testing

### Test the Webhook
```bash
# Check webhook info
curl "https://api.telegram.org/bot8150022576:AAHnjCfXgev0kwkrsFVI1fQHOLz5KrttvbQ/getWebhookInfo"
```

### Test the Bot
1. Open Telegram
2. Search for your bot
3. Send `/start`
4. Click "🚀 Open Dashboard"
5. Verify the WebApp loads and shows data

### Test Desktop Dashboard
Visit: `https://YOUR_DEPLOYMENT_URL/` in browser

## 🔍 Troubleshooting

### Issue: Webhook not receiving messages
**Solution:** Check webhook is set correctly:
```bash
curl "https://api.telegram.org/bot8150022576:AAHnjCfXgev0kwkrsFVI1fQHOLz5KrttvbQ/getWebhookInfo"
```

### Issue: WebApp not loading
**Solution:** Check Vercel function logs in dashboard

### Issue: Environment variables not working
**Solution:** Make sure you redeployed after adding env vars:
```bash
vercel --prod
```

### Issue: 429 Rate limit errors
**Solution:** This is expected with 225 addresses. The bot handles it with delays.

## 📊 Post-Deployment

### Monitor Your Deployment
- **Vercel Dashboard:** Check function executions
- **Telegram Bot:** Test all commands
- **WebSocket:** Verify real-time updates work

### Share Your Bot
1. Get your bot username from @BotFather
2. Share the bot link: `https://t.me/YOUR_BOT_USERNAME`
3. Users can start tracking whales instantly!

## 🎉 Success Indicators

- ✅ Webhook info shows your Vercel URL
- ✅ `/start` command returns welcome message with button
- ✅ Dashboard button opens the WebApp in Telegram
- ✅ WebApp shows live data (whales, positions, heatmap)
- ✅ Real-time updates work (WebSocket connection)
- ✅ Desktop dashboard works at your Vercel URL

## 🚀 You're Live!

Your Hyperliquid Whale Tracker is now live as a **professional Telegram WebApp**! 

Users can:
- Open your bot in Telegram
- Click "Open Dashboard" 
- Get instant access to whale tracking
- Receive real-time liquidation alerts
- View interactive heatmaps
- All from their mobile device!

**Happy tracking! 🐋📱**
