import chalk from 'chalk';

export class DigestManager {
  constructor(alertManager, intervalMinutes = 5) {
    this.alertManager = alertManager;
    this.intervalMs = intervalMinutes * 60 * 1000;
    this.digest = this.createEmptyDigest();
    this.isRunning = false;
  }

  /**
   * Format clickable link for Telegram (HTML anchor tags)
   */
  formatTelegramLink(address, displayText) {
    const url = `https://hyperliquid-whale-tracker.onrender.com/summary/${address}`;
    return `<a href="${url}">${displayText}</a>`;
  }

  createEmptyDigest() {
    return {
      startTime: Date.now(),
      endTime: null,
      newLongs: [],
      newShorts: [],
      closedPositions: [],
      liquidationRisks: [],
      liquidatedPositions: [],
      wokenWhales: [],
      clusters: [],
      processedPositions: new Set(), // Track processed positions to prevent duplicates
      processedLiquidations: new Set(), // Track processed liquidations
      stats: {
        totalLongsOpened: 0,
        totalShortsOpened: 0,
        totalLongValue: 0,
        totalShortValue: 0,
        totalLiquidated: 0,
        totalLiquidatedValue: 0,
        highestLeverage: 0,
        closestToLiquidation: null
      }
    };
  }

  start() {
    this.isRunning = true;
    this.scheduleDigest();
    console.log(chalk.cyan(`📊 Digest mode enabled - Reports every ${this.intervalMs / 60000} minutes`));
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  scheduleDigest() {
    if (!this.isRunning) return;
    
    this.timer = setTimeout(async () => {
      await this.sendDigest();
      this.digest = this.createEmptyDigest();
      this.scheduleDigest();
    }, this.intervalMs);
  }

  /**
   * Add a whale position opening to digest
   */
  addWhaleOpen(position, whale) {
    // Create unique key for position (address + asset + side) - no time window for strict deduplication
    const positionKey = `${position.address}_${position.asset}_${position.side}`;
    
    // Skip if already processed in this digest period
    if (this.digest.processedPositions.has(positionKey)) {
      console.log(`🔄 Skipping duplicate position: ${position.address.slice(0, 6)}...${position.asset} ${position.side}`);
      return;
    }
    
    this.digest.processedPositions.add(positionKey);
    console.log(`✅ Added new position: ${position.address.slice(0, 6)}...${position.asset} ${position.side} $${Math.round(position.positionValue)}`);
    
    const posData = {
      address: position.address,
      asset: position.asset,
      side: position.side,
      size: Math.abs(position.size),
      notional: position.positionValue,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      liquidationPrice: position.liquidationPx,
      whaleRoi: whale?.roi || 0,
      timestamp: Date.now()
    };

    if (position.side === 'LONG') {
      this.digest.newLongs.push(posData);
      this.digest.stats.totalLongsOpened++;
      this.digest.stats.totalLongValue += position.positionValue;
    } else {
      this.digest.newShorts.push(posData);
      this.digest.stats.totalShortsOpened++;
      this.digest.stats.totalShortValue += position.positionValue;
    }

    if (position.leverage > this.digest.stats.highestLeverage) {
      this.digest.stats.highestLeverage = position.leverage;
    }
  }

  /**
   * Add liquidation risk to digest
   */
  addLiquidationRisk(analysis) {
    this.digest.liquidationRisks.push({
      address: analysis.address,
      asset: analysis.asset,
      side: analysis.side,
      notional: analysis.notionalValue,
      currentPrice: analysis.currentPrice,
      liquidationPrice: analysis.liquidationPrice,
      distancePercent: analysis.distancePercent,
      leverage: analysis.leverage
    });

    // Track closest to liquidation
    if (!this.digest.stats.closestToLiquidation || 
        analysis.distancePercent < this.digest.stats.closestToLiquidation.distancePercent) {
      this.digest.stats.closestToLiquidation = {
        asset: analysis.asset,
        distancePercent: analysis.distancePercent,
        notional: analysis.notionalValue
      };
    }
  }

  /**
   * Add actual liquidation event
   */
  addLiquidation(position) {
    // Create unique key for liquidation (address + asset + side + rounded timestamp to minute)
    const timeKey = Math.floor(Date.now() / 60000); // Round to minute
    const liquidationKey = `LIQ_${position.address}_${position.asset}_${position.side}_${timeKey}`;
    
    // Skip if already processed in this minute
    if (this.digest.processedLiquidations.has(liquidationKey)) {
      return;
    }
    
    this.digest.processedLiquidations.add(liquidationKey);
    
    this.digest.liquidatedPositions.push({
      address: position.address,
      asset: position.asset,
      side: position.side,
      notional: position.notionalValue || position.positionValue,
      leverage: position.leverage,
      timestamp: Date.now()
    });

    this.digest.stats.totalLiquidated++;
    this.digest.stats.totalLiquidatedValue += (position.notionalValue || position.positionValue);
  }

  /**
   * Add cluster alert to digest
   */
  addCluster(asset, cluster) {
    this.digest.clusters.push({
      asset,
      priceRange: `${cluster.startPercent.toFixed(1)}% to ${cluster.endPercent.toFixed(1)}%`,
      totalNotional: cluster.totalNotional,
      longNotional: cluster.longNotional,
      shortNotional: cluster.shortNotional,
      positionCount: cluster.positionCount
    });
  }

  /**
   * Add dormant whale wake-up to digest
   */
  addWokenWhale(whale, position) {
    const daysDormant = whale.dormantSince ? 
      (Date.now() - whale.dormantSince) / (24 * 60 * 60 * 1000) : 0;
    
    this.digest.wokenWhales.push({
      address: whale.address,
      daysDormant: Math.floor(daysDormant),
      position: position ? {
        asset: position.asset,
        side: position.side,
        notional: position.positionValue,
        leverage: position.leverage
      } : null,
      whaleRoi: whale.roi || 0,
      previousPnL: whale.totalPnL || 0
    });
  }

  /**
   * Generate and send the digest
   */
  async sendDigest() {
    const hasActivity = 
      this.digest.newLongs.length > 0 ||
      this.digest.newShorts.length > 0 ||
      this.digest.liquidationRisks.length > 0 ||
      this.digest.clusters.length > 0;

    if (!hasActivity) {
      console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] No activity in last ${this.intervalMs / 60000} minutes`));
      return;
    }

    this.digest.endTime = Date.now();

    // Console output
    this.logDigestToConsole();

    // Send to alert channels
    await this.sendTelegramDigest();
    await this.sendDiscordDigest();
  }

  /**
   * Log digest to console with nice formatting
   */
  logDigestToConsole() {
    const duration = (this.digest.endTime - this.digest.startTime) / 60000;
    
    console.log('\n' + '='.repeat(80));
    console.log(chalk.cyan.bold(`📊 ${duration.toFixed(0)} MINUTE ACTIVITY DIGEST`));
    console.log(chalk.gray(`${new Date(this.digest.startTime).toLocaleTimeString()} - ${new Date(this.digest.endTime).toLocaleTimeString()}`));
    console.log('='.repeat(80));

    // HEADLINE: Total liquidations if any
    if (this.digest.stats.totalLiquidatedValue > 0) {
      console.log(chalk.red.bold.inverse(`\n 🚨 JUST IN: $${this.formatLargeNumber(this.digest.stats.totalLiquidatedValue)} LIQUIDATED IN PAST ${duration.toFixed(0)} MINUTES 🚨 `));
      console.log(chalk.red(`   ${this.digest.stats.totalLiquidated} positions wiped out`));
    }
    
    // Total volume moved
    const totalVolume = this.digest.stats.totalLongValue + this.digest.stats.totalShortValue;
    if (totalVolume > 0) {
      console.log(chalk.yellow.bold(`\n💰 TOTAL VOLUME: $${this.formatLargeNumber(totalVolume)} moved in ${duration.toFixed(0)} minutes`));
    }

    // Summary Stats
    console.log(chalk.yellow.bold('\n📈 SUMMARY'));
    console.log(chalk.green(`  Longs Opened: ${this.digest.stats.totalLongsOpened} ($${this.formatNumber(this.digest.stats.totalLongValue)})`));
    console.log(chalk.red(`  Shorts Opened: ${this.digest.stats.totalShortsOpened} ($${this.formatNumber(this.digest.stats.totalShortValue)})`));
    console.log(chalk.magenta(`  Highest Leverage: ${this.digest.stats.highestLeverage.toFixed(1)}x`));
    console.log(chalk.yellow(`  Positions at Risk: ${this.digest.liquidationRisks.length}`));
    
    if (this.digest.stats.totalLiquidated > 0) {
      console.log(chalk.red.bold(`  ⚡ Liquidated: ${this.digest.stats.totalLiquidated} positions ($${this.formatNumber(this.digest.stats.totalLiquidatedValue)})`));
    }
    
    // Total at-risk volume in clusters
    const totalClusterVolume = this.digest.clusters.reduce((sum, c) => sum + c.totalNotional, 0);
    if (totalClusterVolume > 0) {
      console.log(chalk.magenta(`  🔥 At-Risk in Clusters: $${this.formatNumber(totalClusterVolume)}`));
    }

    // New Longs
    if (this.digest.newLongs.length > 0) {
      console.log(chalk.green.bold('\n🟢 NEW LONG POSITIONS'));
      this.digest.newLongs
        .sort((a, b) => b.notional - a.notional)
        .slice(0, 10)
        .forEach(pos => {
          console.log(chalk.green(`  ${pos.asset} | $${this.formatNumber(pos.notional)} | ${pos.leverage.toFixed(1)}x`));
          console.log(chalk.gray(`    ${pos.address.slice(0, 10)}... | Entry: $${pos.entryPrice.toFixed(2)} | ROI: ${pos.whaleRoi.toFixed(1)}%`));
        });
      if (this.digest.newLongs.length > 10) {
        console.log(chalk.gray(`    ... and ${this.digest.newLongs.length - 10} more`));
      }
    }

    // New Shorts
    if (this.digest.newShorts.length > 0) {
      console.log(chalk.red.bold('\n🔴 NEW SHORT POSITIONS'));
      this.digest.newShorts
        .sort((a, b) => b.notional - a.notional)
        .slice(0, 10)
        .forEach(pos => {
          console.log(chalk.red(`  ${pos.asset} | $${this.formatNumber(pos.notional)} | ${pos.leverage.toFixed(1)}x`));
          console.log(chalk.gray(`    ${pos.address.slice(0, 10)}... | Entry: $${pos.entryPrice.toFixed(2)} | ROI: ${pos.whaleRoi.toFixed(1)}%`));
        });
      if (this.digest.newShorts.length > 10) {
        console.log(chalk.gray(`    ... and ${this.digest.newShorts.length - 10} more`));
      }
    }

    // Woken Whales (Dormant wallets that just became active)
    if (this.digest.wokenWhales.length > 0) {
      console.log(chalk.magenta.bold('\n🌅 DORMANT WHALES WAKING UP'));
      this.digest.wokenWhales.forEach(woken => {
        console.log(chalk.magenta(`  ${woken.address.slice(0, 10)}... | Dormant for ${woken.daysDormant} days`));
        if (woken.position) {
          console.log(chalk.gray(`    Just opened: ${woken.position.asset} ${woken.position.side} $${this.formatNumber(woken.position.notional)} ${woken.position.leverage.toFixed(1)}x`));
        }
        console.log(chalk.gray(`    Historical ROI: ${woken.whaleRoi.toFixed(1)}% | PnL: $${this.formatNumber(Math.abs(woken.previousPnL))}`));
      });
    }

    // Liquidation Risks
    if (this.digest.liquidationRisks.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  LIQUIDATION RISKS'));
      this.digest.liquidationRisks
        .sort((a, b) => a.distancePercent - b.distancePercent)
        .slice(0, 10)
        .forEach(risk => {
          console.log(chalk.yellow(`  ${risk.asset} ${risk.side} | ${risk.distancePercent.toFixed(1)}% away | $${this.formatNumber(risk.notional)}`));
          console.log(chalk.gray(`    Current: $${Number(risk.currentPrice || 0).toFixed(2)} → Liq: $${Number(risk.liquidationPrice || 0).toFixed(2)}`));
        });
      if (this.digest.liquidationRisks.length > 10) {
        console.log(chalk.gray(`    ... and ${this.digest.liquidationRisks.length - 10} more at risk`));
      }
    }

    // Clusters
    if (this.digest.clusters.length > 0) {
      console.log(chalk.magenta.bold('\n🔥 LIQUIDATION CLUSTERS'));
      this.digest.clusters
        .sort((a, b) => b.totalNotional - a.totalNotional)
        .slice(0, 5)
        .forEach(cluster => {
          console.log(chalk.magenta(`  ${cluster.asset} | $${this.formatNumber(cluster.totalNotional)} at ${cluster.priceRange}`));
          console.log(chalk.gray(`    Longs: $${this.formatNumber(cluster.longNotional)} | Shorts: $${this.formatNumber(cluster.shortNotional)}`));
        });
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Send digest to Telegram
   */
  async sendTelegramDigest() {
    if (!this.alertManager.config.telegramToken || !this.alertManager.config.telegramChatId) {
      return;
    }

    const duration = (this.digest.endTime - this.digest.startTime) / 60000;
    const totalVolume = this.digest.stats.totalLongValue + this.digest.stats.totalShortValue;
    
    // Simple, short digest to avoid 400 errors
    let message = `📊 <b>${duration.toFixed(0)}-MIN DIGEST</b>\n`;
    
    // Only show volume if > 0
    if (totalVolume > 0) {
      message += `💰 Volume: $${this.formatLargeNumber(totalVolume)}\n`;
    }
    
    // Only show longs if > 0
    if (this.digest.stats.totalLongsOpened > 0) {
      message += `🟢 Longs: ${this.digest.stats.totalLongsOpened} ($${this.formatLargeNumber(this.digest.stats.totalLongValue)})\n`;
    }
    
    // Only show shorts if > 0
    if (this.digest.stats.totalShortsOpened > 0) {
      message += `🔴 Shorts: ${this.digest.stats.totalShortsOpened} ($${this.formatLargeNumber(this.digest.stats.totalShortValue)})\n`;
    }
    
    // Only show leverage if > 0
    if (this.digest.stats.highestLeverage > 0) {
      message += `⚡ Max Leverage: ${this.digest.stats.highestLeverage.toFixed(1)}x\n`;
    }
    
    // Always show at-risk positions
    if (this.digest.liquidationRisks.length > 0) {
      message += `⚠️ At Risk: ${this.digest.liquidationRisks.length} positions\n`;
    }

    // Only show top 3 biggest positions
    const allPositions = [...this.digest.newLongs, ...this.digest.newShorts]
      .sort((a, b) => b.notional - a.notional)
      .slice(0, 3);
    
    if (allPositions.length > 0) {
      message += `\n<b>🔥 TOP POSITIONS:</b>\n`;
      allPositions.forEach(pos => {
        const emoji = pos.side === 'LONG' ? '🟢' : '🔴';
        const wallet = pos.address ? `${pos.address.slice(0, 6)}...${pos.address.slice(-4)}` : 'Unknown';
        message += `${emoji} ${pos.asset} ${pos.side} $${this.formatLargeNumber(pos.notional)} ${pos.leverage.toFixed(1)}x\n`;
        message += `   👤 ` + this.formatTelegramLink(pos.address, wallet) + `\n`;
      });
    }

    // Show closest liquidation risks
    if (this.digest.liquidationRisks.length > 0) {
      message += `\n<b>⚠️ CLOSEST TO LIQ:</b>\n`;
      this.digest.liquidationRisks
        .sort((a, b) => a.distancePercent - b.distancePercent)
        .slice(0, 3)
        .forEach(risk => {
          const wallet = risk.address ? `${risk.address.slice(0, 6)}...${risk.address.slice(-4)}` : 'Unknown';
          const notional = this.formatLargeNumber(risk.notional || 0);
          message += `• ${risk.asset} ${risk.side} ${risk.distancePercent.toFixed(1)}% away\n`;
          message += `  ${wallet} | $${notional}\n`;
        });
    }

    try {
      await this.alertManager.sendTelegramMessage(message);
    } catch (error) {
      console.error('Error sending Telegram digest:', error.message);
    }
  }

  /**
   * Send digest to Discord
   */
  async sendDiscordDigest() {
    if (!this.alertManager.config.discordWebhook) {
      return;
    }

    const duration = (this.digest.endTime - this.digest.startTime) / 60000;
    
    const embed = {
      title: `📊 ${duration.toFixed(0)}-Minute Whale Activity Digest`,
      color: 0x00ff41,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: { text: 'Hyperliquid Liquidation Monitor' }
    };

    // Summary
    embed.fields.push({
      name: '📈 Summary',
      value: 
        `🟢 Longs: ${this.digest.stats.totalLongsOpened} ($${this.formatNumber(this.digest.stats.totalLongValue)})\n` +
        `🔴 Shorts: ${this.digest.stats.totalShortsOpened} ($${this.formatNumber(this.digest.stats.totalShortValue)})\n` +
        `⚡ Max Leverage: ${this.digest.stats.highestLeverage.toFixed(1)}x\n` +
        `⚠️ At Risk: ${this.digest.liquidationRisks.length}`,
      inline: false
    });

    // Top positions
    if (this.digest.newLongs.length > 0) {
      const topLongs = this.digest.newLongs
        .sort((a, b) => b.notional - a.notional)
        .slice(0, 3)
        .map(p => `${p.asset} $${this.formatNumber(p.notional)} ${p.leverage.toFixed(1)}x`)
        .join('\n');
      embed.fields.push({ name: `🟢 Top Longs (${this.digest.newLongs.length})`, value: topLongs, inline: true });
    }

    if (this.digest.newShorts.length > 0) {
      const topShorts = this.digest.newShorts
        .sort((a, b) => b.notional - a.notional)
        .slice(0, 3)
        .map(p => `${p.asset} $${this.formatNumber(p.notional)} ${p.leverage.toFixed(1)}x`)
        .join('\n');
      embed.fields.push({ name: `🔴 Top Shorts (${this.digest.newShorts.length})`, value: topShorts, inline: true });
    }

    try {
      await this.alertManager.sendDiscordAlert({ type: 'DIGEST', ...embed });
    } catch (error) {
      console.error('Error sending Discord digest:', error.message);
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
  }

  formatLargeNumber(num) {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' BILLION';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + ' MILLION';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
  }

  /**
   * Get current digest stats for dashboard
   */
  getCurrentStats() {
    const stats = this.digest.stats;
    const volume = stats.totalLongValue + stats.totalShortValue;
    const longsCount = stats.totalLongsOpened;
    const shortsCount = stats.totalShortsOpened;
    const maxLeverage = stats.highestLeverage;
    const atRiskCount = this.digest.liquidationRisks.length;
    
    // Get closest to liquidation positions
    const closestToLiq = this.digest.liquidationRisks
      .sort((a, b) => a.percentFromLiquidation - b.percentFromLiquidation)
      .slice(0, 5);
    
    // Get top positions (deduplicated by address+asset combination)
    const allPositions = [...this.digest.newLongs, ...this.digest.newShorts];
    const positionMap = new Map();
    
    // Deduplicate positions by combining address+asset+side as key
    allPositions.forEach(pos => {
      const key = `${pos.address}_${pos.asset}_${pos.side}`;
      if (!positionMap.has(key) || positionMap.get(key).notional < pos.notional) {
        positionMap.set(key, pos);
      }
    });
    
    // Sort by notional value and get top 5
    const topPositions = Array.from(positionMap.values())
      .sort((a, b) => b.notional - a.notional)
      .slice(0, 5);
    
    // Debug logging for troubleshooting
    console.log(`📊 Digest Stats: ${longsCount} longs, ${shortsCount} shorts, ${topPositions.length} top positions`);
    if (topPositions.length > 0) {
      console.log('🔥 Top positions:', topPositions.map(p => 
        `${p.asset} ${p.side} $${Math.round(p.notional)} (${p.address.slice(0, 6)}...)`
      ));
    }
    
    return {
      volume,
      longsCount,
      shortsCount,
      longsValue: stats.totalLongValue,
      shortsValue: stats.totalShortValue,
      maxLeverage,
      atRiskCount,
      closestToLiq,
      topPositions,
      totalLiquidatedValue: this.digest.stats.totalLiquidatedValue
    };
  }
}

