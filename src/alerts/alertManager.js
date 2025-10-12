import axios from 'axios';
import chalk from 'chalk';

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
  }

  /**
   * Send immediate liquidation alert
   */
  async sendLiquidationAlert(position, liquidationPrice) {
    const alert = {
      type: 'LIQUIDATION',
      timestamp: Date.now(),
      asset: position.asset,
      side: position.side,
      address: position.address,
      notional: Math.abs(position.size * liquidationPrice),
      liquidationPrice: liquidationPrice,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      pnl: position.unrealizedPnL || 0
    };

    await this.sendAlert(alert);
  }

  /**
   * Send an alert through all configured channels
   */
  async sendAlert(alert) {
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
      promises.push(this.sendTelegramAlert(alert));
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
    console.log(color.bold(`[${alert.type}]`) + chalk.gray(` ${timestamp}`));
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
  async sendTelegramAlert(alert) {
    if (!this.config.telegramToken || !this.config.telegramChatId) return;

    try {
      const message = this.formatTelegramMessage(alert);
      const url = `https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`;

      await axios.post(url, {
        chat_id: this.config.telegramChatId,
        text: message,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error sending Telegram alert:', error.message);
    }
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
    // Special format for liquidation alerts
    if (alert.type === 'LIQUIDATION') {
      const sideEmoji = alert.side === 'LONG' ? '🟢' : '🔴';
      const sideText = alert.side === 'LONG' ? 'Long' : 'Short';
      const notionalFormatted = this.formatLargeNumber(alert.notional);
      
      let msg = `${sideEmoji} <a href="https://app.hyperliquid.xyz/explorer/account?address=${alert.address}">${alert.address.slice(0, 10)}...${alert.address.slice(-8)}</a>\n`;
      msg += `#${alert.asset} Liquidated ${sideText}: $${notionalFormatted} at $${alert.liquidationPrice.toFixed(2)}`;
      
      return msg;
    }
    
    // Default format for other alerts
    let msg = `<b>${this.getAlertTitle(alert)}</b>\n\n`;
    
    if (alert.asset) msg += `Asset: <b>${alert.asset}</b>\n`;
    if (alert.side) msg += `Side: <b>${alert.side}</b>\n`;
    if (alert.leverage) msg += `Leverage: <b>${alert.leverage.toFixed(2)}x</b>\n`;
    if (alert.notionalValue) msg += `Notional: <b>$${alert.notionalValue.toLocaleString()}</b>\n`;
    if (alert.entryPrice) msg += `Entry: $${alert.entryPrice.toFixed(2)}\n`;
    if (alert.liquidationPrice) msg += `Liquidation: <b>$${alert.liquidationPrice.toFixed(2)}</b>\n`;
    if (alert.distancePercent) msg += `Distance: ${alert.distancePercent.toFixed(2)}%\n`;
    if (alert.address) msg += `\nWallet: <code>${alert.address.slice(0, 8)}...${alert.address.slice(-6)}</code>\n`;
    if (alert.message) msg += `\n${alert.message}`;

    return msg;
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

