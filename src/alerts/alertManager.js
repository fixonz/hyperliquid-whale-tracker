import axios from 'axios';
import chalk from 'chalk';
import { CopyTradingDetector } from '../analyzers/copyTradingDetector.js';

export class AlertManager {
  constructor(config = {}) {
    this.config = {
      discordWebhook: config.discordWebhook || process.env.DISCORD_WEBHOOK_URL,
      telegramToken: config.telegramToken || process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: config.telegramChatId || process.env.TELEGRAM_CHAT_ID,
      webhookUrl: config.webhookUrl || process.env.ALERT_WEBHOOK_URL,
      minPositionSize: config.minPositionSize || 50000,
      enableConsole: config.enableConsole !== false
    };

    this.alertHistory = [];
    this.recentAlerts = new Set(); // Prevent duplicate alerts
    this.copyTradingDetector = new CopyTradingDetector();
    this.liquidationThreshold = 35000; // Only show liquidations over $35K
  }

  /**
   * Send big position alert (10M+)
   */
  async sendBigPositionAlert(position, whale) {
    const notional = Math.abs(position.size * position.entryPrice);
    const wallet = position.address ? `${position.address.slice(0, 6)}...${position.address.slice(-4)}` : 'Unknown';
    
    // Fetch wallet performance data from Hyperlens
    let walletStats = '';
    try {
      const { HyperlensAPI } = await import('../api/hyperlens.js');
      const hyperlens = new HyperlensAPI();
      
      // Get address stats summary
      const stats = await hyperlens.getAddressStatsSummary({
        address: position.address,
        days: 7 // Last 7 days
      });
      
      if (stats && stats.length > 0) {
        const latestStats = stats[0]; // Most recent day
        const totalTrades = latestStats.trades || 0;
        const winningTrades = latestStats.winning_trades || 0;
        const losingTrades = latestStats.losing_trades || 0;
        const totalPnL = parseFloat(latestStats.total_pnl || 0);
        const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
        
        walletStats = `\n📊 Wallet Performance (7d):\n`;
        walletStats += `• PnL: ${totalPnL >= 0 ? '+' : ''}$${this.formatLargeNumber(Math.abs(totalPnL))}\n`;
        walletStats += `• Win Rate: ${winRate}% (${winningTrades}W/${losingTrades}L)\n`;
        walletStats += `• Trades: ${totalTrades.toLocaleString()}`;
      }
    } catch (error) {
      console.log('Could not fetch wallet stats:', error.message);
    }
    
    const alert = {
      type: 'BIG_POSITION',
      timestamp: Date.now(),
      asset: position.asset,
      side: position.side,
      address: position.address,
      notional: notional,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      whaleRoi: whale?.roi || 0,
      message: `🚨 MAJOR POSITION OPENED\n\n` +
               `💰 ${position.asset} ${position.side}\n` +
               `💵 Size: $${this.formatLargeNumber(notional)}\n` +
               `📊 Entry: $${Number(position.entryPrice || 0).toLocaleString()}\n` +
               `⚡ Leverage: ${Number(position.leverage || 0).toFixed(1)}x\n` +
               `👤 Wallet: <a href="https://hyperliquid-alerts.onrender.com/summary/${position.address}">${wallet}</a>\n` +
               `${whale?.roi ? `📈 ROI: ${Number(whale.roi).toFixed(1)}%` : ''}` +
               walletStats
    };

    await this.sendAlert(alert, true); // true = pin this message
  }

  /**
   * Send HOT position alert for positions $1M-$100M
   */
  async sendHotPositionAlert(position, whale) {
    const notional = Math.abs(position.size * position.entryPrice);
    const wallet = position.address ? `${position.address.slice(0, 6)}...${position.address.slice(-4)}` : 'Unknown';
    
    // Fetch wallet performance data from Hyperlens
    let walletStats = '';
    try {
      const { HyperlensAPI } = await import('../api/hyperlens.js');
      const hyperlens = new HyperlensAPI();
      
      // Get address stats summary
      const stats = await hyperlens.getAddressStatsSummary({
        address: position.address,
        days: 7 // Last 7 days
      });
      
      if (stats && stats.length > 0) {
        const latestStats = stats[0]; // Most recent day
        const totalTrades = latestStats.trades || 0;
        const winningTrades = latestStats.winning_trades || 0;
        const losingTrades = latestStats.losing_trades || 0;
        const totalPnL = parseFloat(latestStats.total_pnl || 0);
        const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
        
        walletStats = `\n📊 Wallet (7d): ${totalPnL >= 0 ? '+' : ''}$${this.formatLargeNumber(Math.abs(totalPnL))} | ${winRate}% WR`;
      }
    } catch (error) {
      console.log('Could not fetch wallet stats for HOT alert:', error.message);
    }
    
    const alert = {
      type: 'HOT_POSITION',
      timestamp: Date.now(),
      asset: position.asset,
      side: position.side,
      address: position.address,
      notional: notional,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      whaleRoi: whale?.roi || 0,
      message: `🔥 HOT POSITION\n\n` +
               `💰 ${position.asset} ${position.side}\n` +
               `💵 Size: $${this.formatLargeNumber(notional)}\n` +
               `⚡ Leverage: ${Number(position.leverage || 0).toFixed(1)}x\n` +
               `👤 <a href="https://hyperliquid-alerts.onrender.com/summary/${position.address}">${wallet}</a>` +
               walletStats
    };

    await this.sendAlert(alert, false); // false = don't pin HOT position alerts
  }

  /**
   * Send immediate liquidation alert
   */
  async sendLiquidationAlert(position, liquidationPrice) {
    const notional = Math.abs(position.size * liquidationPrice);
    
    // Only send alerts for liquidations over $35K
    if (notional < this.liquidationThreshold) {
      console.log(`💰 Liquidation below threshold: $${notional.toLocaleString()} (min: $${this.liquidationThreshold.toLocaleString()})`);
      return;
    }

    // Analyze for copy trading
    const liquidation = {
      asset: position.asset,
      side: position.side,
      address: position.address,
      liquidationPrice: liquidationPrice,
      notional: notional,
      time: Date.now()
    };

    const copyTradingInfo = await this.copyTradingDetector.analyzeLiquidation(liquidation);

    const alert = {
      type: 'LIQUIDATION',
      timestamp: Date.now(),
      asset: position.asset,
      side: position.side,
      address: position.address,
      notional: notional,
      liquidationPrice: liquidationPrice,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      pnl: position.unrealizedPnL || 0,
      copyTradingInfo: copyTradingInfo
    };

    await this.sendAlert(alert);
  }

  /**
   * Send an alert through all configured channels
   */
  async sendAlert(alert, shouldPin = false) {
    const alertKey = this.getAlertKey(alert);
    
    // Prevent duplicate alerts within 5 minutes
    if (this.recentAlerts.has(alertKey)) {
      return;
    }

    this.recentAlerts.add(alertKey);
    setTimeout(() => this.recentAlerts.delete(alertKey), 5 * 60 * 1000);

    // Store in history
    this.alertHistory.push({
      ...alert,
      timestamp: Date.now()
    });

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Send through all channels
    const promises = [];

    // Always show liquidation alerts in console, regardless of config
    if (this.config.enableConsole || alert.type === 'LIQUIDATION') {
      this.logToConsole(alert);
    }

    if (this.config.discordWebhook) {
      promises.push(this.sendDiscordAlert(alert));
    }

    if (this.config.telegramToken && this.config.telegramChatId) {
      promises.push(this.sendTelegramAlert(alert, shouldPin));
    }

    if (this.config.webhookUrl) {
      promises.push(this.sendWebhookAlert(alert));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Generate unique key for alert deduplication
   */
  getAlertKey(alert) {
    return `${alert.type}_${alert.address}_${alert.asset}_${alert.side}`;
  }

  /**
   * Log alert to console with colors
   */
  logToConsole(alert) {
    const timestamp = new Date().toISOString();
    const typeColor = {
      'WHALE_OPEN': chalk.green,
      'WHALE_CLOSE': chalk.yellow,
      'LIQUIDATION_RISK': chalk.red,
      'LIQUIDATION': chalk.red.bold,
      'NEW_WHALE_DISCOVERED': chalk.cyan.bold,
      'NEW_WALLET_DISCOVERED': chalk.blue.bold,
      'LARGE_POSITION': chalk.cyan,
      'CLUSTER_ALERT': chalk.magenta
    };

    const color = typeColor[alert.type] || chalk.white;
    
    console.log('\n' + '='.repeat(80));
    const timeStr = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    console.log(color.bold(`[${alert.type}]`) + chalk.gray(` ${timeStr}`));
    console.log(chalk.white(`Asset: ${alert.asset || 'N/A'}`));
    
    if (alert.address) {
      console.log(chalk.gray(`Wallet: ${alert.address.slice(0, 8)}...${alert.address.slice(-6)}`));
    }
    
    if (alert.side) {
      const sideColor = alert.side === 'LONG' ? chalk.green : chalk.red;
      console.log(sideColor(`Side: ${alert.side}`));
    }
    
    if (alert.size) {
      console.log(chalk.white(`Size: ${alert.size.toFixed(4)}`));
    }
    
    if (alert.notionalValue) {
      console.log(chalk.yellow(`Notional: $${alert.notionalValue.toLocaleString()}`));
    }
    
    if (alert.leverage) {
      console.log(chalk.cyan(`Leverage: ${alert.leverage.toFixed(2)}x`));
    }
    
    if (alert.entryPrice) {
      console.log(chalk.white(`Entry: $${alert.entryPrice.toFixed(2)}`));
    }
    
    if (alert.liquidationPrice) {
      console.log(chalk.red(`Liquidation: $${alert.liquidationPrice.toFixed(2)}`));
    }
    
    if (alert.distancePercent) {
      console.log(chalk.yellow(`Distance to liq: ${alert.distancePercent.toFixed(2)}%`));
    }
    
    if (alert.message) {
      console.log(chalk.white(`\n${alert.message}`));
    }
    
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Send alert to Discord
   */
  async sendDiscordAlert(alert) {
    if (!this.config.discordWebhook) return;

    try {
      const embed = {
        title: this.getAlertTitle(alert),
        description: alert.message || '',
        color: this.getAlertColor(alert),
        fields: [],
        timestamp: new Date().toISOString(),
        footer: { text: 'Hyperliquid Liquidation Alerts' }
      };

      if (alert.asset) embed.fields.push({ name: 'Asset', value: alert.asset, inline: true });
      if (alert.side) embed.fields.push({ name: 'Side', value: alert.side, inline: true });
      if (alert.leverage) embed.fields.push({ name: 'Leverage', value: `${alert.leverage.toFixed(2)}x`, inline: true });
      if (alert.notionalValue) embed.fields.push({ name: 'Notional Value', value: `$${alert.notionalValue.toLocaleString()}`, inline: true });
      if (alert.entryPrice) embed.fields.push({ name: 'Entry Price', value: `$${alert.entryPrice.toFixed(2)}`, inline: true });
      if (alert.liquidationPrice) embed.fields.push({ name: 'Liquidation Price', value: `$${alert.liquidationPrice.toFixed(2)}`, inline: true });
      if (alert.distancePercent) embed.fields.push({ name: 'Distance to Liq', value: `${alert.distancePercent.toFixed(2)}%`, inline: true });
      if (alert.address) embed.fields.push({ name: 'Wallet', value: `${alert.address.slice(0, 8)}...${alert.address.slice(-6)}`, inline: false });

      await axios.post(this.config.discordWebhook, {
        embeds: [embed]
      });
    } catch (error) {
      console.error('Error sending Discord alert:', error.message);
    }
  }

  /**
   * Send alert to Telegram
   */
  async sendTelegramAlert(alert, shouldPin = false) {
    if (!this.config.telegramToken || !this.config.telegramChatId) return;

    try {
      const message = this.formatTelegramMessage(alert);
      const messageId = await this.sendTelegramMessage(message);
      
      // Pin the message if requested
      if (shouldPin && messageId) {
        await this.pinTelegramMessage(messageId);
      }
    } catch (error) {
      console.error('Error sending Telegram alert:', error.message);
    }
  }

  /**
   * Pin a Telegram message
   */
  async pinTelegramMessage(messageId) {
    if (!this.config.telegramToken || !this.config.telegramChatId) return;

    try {
      const url = `https://api.telegram.org/bot${this.config.telegramToken}/pinChatMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          message_id: messageId,
          disable_notification: false
        })
      });

      if (!response.ok) {
        console.error('Failed to pin message:', response.statusText);
      }
    } catch (error) {
      console.error('Error pinning Telegram message:', error.message);
    }
  }

  /**
   * Send Telegram message with splitting for long messages
   */
  async sendTelegramMessage(text, maxLength = 4000) {
    if (!this.config.telegramToken || !this.config.telegramChatId) return;

    try {
      // If message is short enough, send normally
      if (text.length <= maxLength) {
        const url = `https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`;
        const response = await axios.post(url, {
          chat_id: this.config.telegramChatId,
          text: text,
          parse_mode: 'HTML'
        });
        return response.data.result?.message_id;
      }

      // Split long message
      const parts = this.splitMessage(text, maxLength);
      const url = `https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`;

      for (let i = 0; i < parts.length; i++) {
        await axios.post(url, {
          chat_id: this.config.telegramChatId,
          text: parts[i],
          parse_mode: 'HTML'
        });
        
        // Small delay between messages to avoid rate limiting
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error.message);
    }
  }

  /**
   * Split message into chunks while preserving HTML tags
   */
  splitMessage(text, maxLength) {
    const parts = [];
    let currentPart = '';
    const lines = text.split('\n');
    
    for (const line of lines) {
      // If adding this line would exceed the limit, start a new part
      if (currentPart.length + line.length + 1 > maxLength && currentPart.length > 0) {
        parts.push(currentPart.trim());
        currentPart = line;
      } else {
        currentPart += (currentPart.length > 0 ? '\n' : '') + line;
      }
    }
    
    // Add the last part if it has content
    if (currentPart.trim().length > 0) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  }

  /**
   * Send alert to custom webhook
   */
  async sendWebhookAlert(alert) {
    if (!this.config.webhookUrl) return;

    try {
      await axios.post(this.config.webhookUrl, alert, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error sending webhook alert:', error.message);
    }
  }

  /**
   * Format message for Telegram
   */
  formatTelegramMessage(alert) {
    try {
      // Special format for liquidation alerts
      // Special formatting for big position alerts
      if (alert.type === 'BIG_POSITION') {
        const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
        const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
        const notionalFormatted = this.formatLargeNumber(alert.notional || alert.notionalValue || 0);
        const asset = (alert.asset || 'UNKNOWN').replace(/[<>&]/g, '');
        const address = (alert.address || '').replace(/[<>&]/g, '');
        
        let msg = `🚨 MAJOR POSITION OPENED\n`;
        msg += `${sideEmoji} #${asset} - ${sideText}\n`;
        msg += `Size: $${notionalFormatted} at $${Number(alert.entryPrice || 0).toLocaleString()}\n`;
        msg += `Leverage: ${Number(alert.leverage || 0).toFixed(1)}x\n`;
        msg += `-- <a href="https://hyperliquid-alerts.onrender.com/summary/${address}">${address.slice(0, 6)}...${address.slice(-4)}</a>`;
        
        return msg;
      }
      
      if (alert.type === 'LIQUIDATION') {
        const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
        const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
        const notionalFormatted = this.formatLargeNumber(alert.notionalValue || alert.notional || 0);
        const liquidationPrice = Number(alert.liquidationPrice || 0);
        const asset = (alert.asset || 'UNKNOWN').replace(/[<>&]/g, '');
        const address = (alert.address || '').replace(/[<>&]/g, '');
        
        const price = liquidationPrice || alert.entryPrice || 0;
        const isTest = alert.message && alert.message.includes('TEST');
        let msg = isTest ? `🧪 TEST LIQUIDATION ALERT\n` : '';
        msg += `${sideEmoji} #${asset} - ${sideText}\n`;
        msg += `Liquidated $${notionalFormatted} at $${Number(price).toLocaleString()}\n`;
        
        // Add copy trading information if detected
        if (alert.copyTradingInfo) {
          msg += this.copyTradingDetector.formatCopyTradingAlert(alert, alert.copyTradingInfo);
        }
        
        msg += `\n-- <a href="https://hyperliquid-alerts.onrender.com/summary/${address}">${address.slice(0, 6)}...${address.slice(-4)}</a>`;
        
        return msg;
      }
      
      // Default format for other alerts
      let msg = `<b>${(this.getAlertTitle(alert) || 'Alert').replace(/[<>&]/g, '')}</b>\n\n`;
      
      if (alert.asset) msg += `Asset: <b>${(alert.asset || '').replace(/[<>&]/g, '')}</b>\n`;
      if (alert.side) msg += `Side: <b>${(alert.side || '').replace(/[<>&]/g, '')}</b>\n`;
      if (alert.leverage) msg += `Leverage: <b>${Number(alert.leverage || 0).toFixed(2)}x</b>\n`;
      if (alert.notionalValue) msg += `Notional: <b>$${Number(alert.notionalValue || 0).toLocaleString()}</b>\n`;
      if (alert.entryPrice) msg += `Entry: $${Number(alert.entryPrice || 0).toFixed(2)}\n`;
      if (alert.liquidationPrice) msg += `Liquidation: <b>$${Number(alert.liquidationPrice || 0).toFixed(2)}</b>\n`;
      if (alert.distancePercent) msg += `Distance: ${Number(alert.distancePercent || 0).toFixed(2)}%\n`;
      if (alert.address) {
        const cleanAddress = (alert.address || '').replace(/[<>&]/g, '');
        msg += `\nWallet: <code>${cleanAddress.slice(0, 8)}...${cleanAddress.slice(-6)}</code>\n`;
      }
      if (alert.message) msg += `\n${(alert.message || '').replace(/[<>&]/g, '')}`;

      return msg;
    } catch (error) {
      console.error('Error formatting Telegram message:', error);
      return `Alert: ${(alert.type || 'Unknown').replace(/[<>&]/g, '')}`;
    }
  }

  /**
   * Format large numbers (1.5M, 2.3K, etc.)
   */
  formatLargeNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
  }

  /**
   * Get alert title based on type
   */
  getAlertTitle(alert) {
    const titles = {
      'WHALE_OPEN': '🐋 Whale Position Opened',
      'WHALE_CLOSE': '🐋 Whale Position Closed',
      'LIQUIDATION_RISK': '⚠️ Liquidation Risk Alert',
      'LIQUIDATION': '🔥 LIQUIDATION ALERT',
      'BIG_POSITION': '🚨 MAJOR POSITION OPENED',
      'NEW_WHALE_DISCOVERED': '🐋 New Whale Discovered',
      'NEW_WALLET_DISCOVERED': '💼 New Wallet Discovered',
      'LARGE_POSITION': '💰 Large Position Detected',
      'CLUSTER_ALERT': '🔥 Liquidation Cluster Alert'
    };
    return titles[alert.type] || 'Alert';
  }

  /**
   * Get color for alert type (Discord)
   */
  getAlertColor(alert) {
    const colors = {
      'WHALE_OPEN': 0x00FF00,      // Green
      'WHALE_CLOSE': 0xFFFF00,     // Yellow
      'LIQUIDATION_RISK': 0xFF0000, // Red
      'LIQUIDATION': 0xFF0000, // Red
      'NEW_WHALE_DISCOVERED': 0x00FFFF, // Cyan
      'NEW_WALLET_DISCOVERED': 0x4169E1, // Royal Blue
      'LARGE_POSITION': 0x00FFFF,  // Cyan
      'CLUSTER_ALERT': 0xFF00FF    // Magenta
    };
    return colors[alert.type] || 0xFFFFFF;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear alert history
   */
  clearHistory() {
    this.alertHistory = [];
  }
}

