import { AlertManager } from './alertManager.js';
import { HyperlensAPI } from '../api/hyperlens.js';
import { EnhancedWhaleTracker } from '../trackers/enhancedWhaleTracker.js';

export class EnhancedAlertManager extends AlertManager {
  constructor(config = {}) {
    super(config);
    this.hyperlensAPI = new HyperlensAPI();
    this.enhancedWhaleTracker = new EnhancedWhaleTracker();
    this.attributionCounter = 0;
    this.liquidationThresholds = {
      small: 10000,    // $10k
      medium: 100000,  // $100k
      large: 1000000,  // $1M
      massive: 10000000 // $10M
    };
    this.riskLevels = {
      low: 20,     // >20% from liquidation
      medium: 10,  // 10-20% from liquidation
      high: 5,     // 5-10% from liquidation
      critical: 2  // <5% from liquidation
    };
  }

  /**
   * Enhanced liquidation alert with Hyperlens.io data
   */
  async sendEnhancedLiquidationAlert(position, liquidationData) {
    // Get additional data from Hyperlens
    const hyperlensData = await this.hyperlensAPI.getAddressLiquidationsByCoin(
      position.address, 
      position.asset
    );

    const alert = {
      type: 'ENHANCED_LIQUIDATION',
      timestamp: Date.now(),
      asset: position.asset,
      side: position.side,
      address: position.address,
      notional: Math.abs(position.size * position.entryPrice),
      liquidationPrice: position.liquidationPx,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      pnl: position.unrealizedPnL || 0,
      
      // Enhanced data from Hyperlens
      hyperlensData: hyperlensData,
      liquidationCount: hyperlensData?.length || 0,
      isRepeatLiquidation: (hyperlensData?.length || 0) > 1,
      
      // Liquidation severity
      severity: this.getLiquidationSeverity(Math.abs(position.size * position.entryPrice)),
      
      // Additional context
      timeToLiquidation: this.calculateTimeToLiquidation(position),
      whaleRiskScore: await this.getWhaleRiskScore(position.address),
      
      message: this.formatEnhancedLiquidationMessage(position, hyperlensData)
    };

    await this.sendAlert(alert, alert.severity === 'massive');
  }

  /**
   * New alert type: Liquidation cascade warning
   */
  async sendCascadeWarningAlert(affectedAssets, estimatedImpact) {
    const alert = {
      type: 'CASCADE_WARNING',
      timestamp: Date.now(),
      affectedAssets: affectedAssets,
      estimatedImpact: estimatedImpact,
      severity: estimatedImpact > 50000000 ? 'critical' : 'high',
      message: this.formatCascadeWarningMessage(affectedAssets, estimatedImpact)
    };

    await this.sendAlert(alert, true); // Always pin cascade warnings
  }

  /**
   * New alert type: Whale behavior pattern detected
   */
  async sendWhalePatternAlert(whale, pattern) {
    const alert = {
      type: 'WHALE_PATTERN',
      timestamp: Date.now(),
      address: whale.address,
      pattern: pattern,
      whaleStats: whale,
      message: this.formatWhalePatternMessage(whale, pattern)
    };

    await this.sendAlert(alert);
  }

  /**
   * New alert type: Market volatility spike
   */
  async sendVolatilityAlert(asset, volatilityData) {
    const alert = {
      type: 'VOLATILITY_SPIKE',
      timestamp: Date.now(),
      asset: asset,
      volatilityData: volatilityData,
      severity: volatilityData.spikeLevel,
      message: this.formatVolatilityMessage(asset, volatilityData)
    };

    await this.sendAlert(alert, volatilityData.spikeLevel === 'extreme');
  }

  /**
   * New alert type: Liquidation cluster formation
   */
  async sendClusterAlert(clusterData) {
    const alert = {
      type: 'LIQUIDATION_CLUSTER',
      timestamp: Date.now(),
      clusterData: clusterData,
      severity: clusterData.riskLevel,
      message: this.formatClusterMessage(clusterData)
    };

    await this.sendAlert(alert, clusterData.riskLevel === 'critical');
  }

  /**
   * Enhanced risk alert with Hyperlens.io insights
   */
  async sendEnhancedRiskAlert(position, riskData) {
    // Get whale performance data from Hyperlens
    const whalePerformance = await this.hyperlensAPI.getAddressPerformanceByCoin(
      position.address,
      position.asset
    );

    const alert = {
      type: 'ENHANCED_RISK',
      timestamp: Date.now(),
      asset: position.asset,
      side: position.side,
      address: position.address,
      riskLevel: riskData.level,
      distanceToLiquidation: riskData.distance,
      positionValue: Math.abs(position.size * position.entryPrice),
      
      // Enhanced data
      whalePerformance: whalePerformance,
      historicalLiquidations: riskData.historicalLiquidations || 0,
      winRate: whalePerformance?.winRate || 0,
      riskScore: riskData.riskScore,
      
      message: this.formatEnhancedRiskMessage(position, riskData, whalePerformance)
    };

    await this.sendAlert(alert, riskData.level === 'critical');
  }

  /**
   * New alert type: Hyperlens.io data insights
   */
  async sendHyperlensInsightAlert(insightType, data) {
    const alert = {
      type: 'HYPERLENS_INSIGHT',
      timestamp: Date.now(),
      insightType: insightType,
      data: data,
      severity: data.severity || 'info',
      message: this.formatHyperlensInsightMessage(insightType, data)
    };

    await this.sendAlert(alert, data.severity === 'critical');
  }

  /**
   * New alert type: HOT position over $1M
   */
  async sendHotPositionAlert(position, whale = null) {
    const alert = {
      type: 'HOT_POSITION',
      timestamp: Date.now(),
      severity: 'hot',
      address: position.address,
      asset: position.asset,
      side: position.side,
      notional: position.notional || position.positionValue,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      liquidationPrice: position.liquidationPx,
      whaleRoi: whale?.roi || 0,
      message: this.formatHotPositionMessage(position, whale)
    };

    // Always pin HOT positions over $1M
    await this.sendAlert(alert, true);
  }

  // Helper methods for enhanced alerts

  getLiquidationSeverity(notionalValue) {
    if (notionalValue >= this.liquidationThresholds.massive) return 'massive';
    if (notionalValue >= this.liquidationThresholds.large) return 'large';
    if (notionalValue >= this.liquidationThresholds.medium) return 'medium';
    return 'small';
  }

  calculateTimeToLiquidation(position) {
    // Estimate time to liquidation based on price movement
    const distance = Math.abs((position.entryPrice - position.liquidationPx) / position.entryPrice * 100);
    // Rough estimate: assume 1% price movement per hour
    return Math.round(distance); // hours
  }

  async getWhaleRiskScore(address) {
    try {
      const whale = this.enhancedWhaleTracker.getWhale ? 
        this.enhancedWhaleTracker.getWhale(address) : 
        null;
      return whale?.riskScore || 0;
    } catch (error) {
      return 0;
    }
  }

  // Enhanced message formatters

  formatEnhancedLiquidationMessage(position, hyperlensData) {
    const severity = this.getLiquidationSeverity(Math.abs(position.size * position.entryPrice));
    const severityEmoji = {
      'massive': '🚨💥',
      'large': '🔥',
      'medium': '⚡',
      'small': '💥'
    };

    const sideEmoji = position.side === 'LONG' ? '🟢' : '🔴';
    const notionalFormatted = this.formatLargeNumber(Math.abs(position.size * position.entryPrice));
    const liquidationCount = hyperlensData?.length || 0;
    const isRepeat = liquidationCount > 1;

    let msg = `${severityEmoji[severity]} ${severity.toUpperCase()} LIQUIDATION\n`;
    msg += `${sideEmoji} #${position.asset} - ${position.side}\n`;
    msg += `💸 Liquidated: $${notionalFormatted}\n`;
    
    if (isRepeat) {
      msg += `⚠️ Repeat liquidation (#${liquidationCount})\n`;
    }
    
    msg += `📊 Leverage: ${position.leverage?.toFixed(1) || 0}x\n`;
    msg += `💰 PnL: ${position.unrealizedPnL >= 0 ? '+' : ''}$${this.formatLargeNumber(Math.abs(position.unrealizedPnL || 0))}\n`;
    
    return msg;
  }

  formatCascadeWarningMessage(affectedAssets, estimatedImpact) {
    const impactFormatted = this.formatLargeNumber(estimatedImpact);
    const assetList = affectedAssets.slice(0, 3).join(', ');
    const moreAssets = affectedAssets.length > 3 ? ` +${affectedAssets.length - 3} more` : '';

    let msg = `🌊 LIQUIDATION CASCADE WARNING\n`;
    msg += `💰 Estimated Impact: $${impactFormatted}\n`;
    msg += `🎯 Affected: ${assetList}${moreAssets}\n`;
    msg += `⚠️ Multiple liquidations expected\n`;
    msg += `🔄 Market impact incoming...`;

    return msg;
  }

  formatWhalePatternMessage(whale, pattern) {
    let msg = `🐋 WHALE PATTERN DETECTED\n`;
    msg += `📍 ${pattern.type.toUpperCase()}\n`;
    
    switch (pattern.type) {
      case 'dormant_wake':
        msg += `💤 Whale woke up after ${pattern.daysInactive} days\n`;
        msg += `💰 Opening $${this.formatLargeNumber(pattern.positionValue)} position\n`;
        break;
      case 'liquidation_recovery':
        msg += `🔄 Recovering from recent liquidation\n`;
        msg += `📈 New position: $${this.formatLargeNumber(pattern.positionValue)}\n`;
        break;
      case 'profit_taking':
        msg += `💰 Taking profits after ${pattern.winStreak} wins\n`;
        msg += `📊 ROI: ${whale.roi?.toFixed(2) || 0}%\n`;
        break;
    }
    
    return msg;
  }

  formatVolatilityMessage(asset, volatilityData) {
    const levelEmoji = {
      'extreme': '🌪️',
      'high': '⚡',
      'medium': '🌊'
    };

    let msg = `${levelEmoji[volatilityData.spikeLevel]} VOLATILITY SPIKE\n`;
    msg += `📈 #${asset} - ${volatilityData.spikeLevel.toUpperCase()}\n`;
    msg += `📊 Price Change: ${volatilityData.priceChange?.toFixed(2) || 0}%\n`;
    msg += `⏱️ Duration: ${volatilityData.duration || 0}min\n`;
    msg += `⚠️ Expect liquidations...`;

    return msg;
  }

  formatClusterMessage(clusterData) {
    let msg = `🎯 LIQUIDATION CLUSTER FORMING\n`;
    msg += `📍 Price: $${clusterData.price?.toFixed(2) || 0}\n`;
    msg += `💰 Total Risk: $${this.formatLargeNumber(clusterData.totalRisk)}\n`;
    msg += `👥 Positions: ${clusterData.positionCount}\n`;
    msg += `⚡ Risk Level: ${clusterData.riskLevel.toUpperCase()}\n`;
    msg += `🔄 Cascade potential: ${clusterData.cascadeRisk}%`;

    return msg;
  }

  formatEnhancedRiskMessage(position, riskData, whalePerformance) {
    const riskEmoji = {
      'critical': '🚨',
      'high': '⚠️',
      'medium': '⚡',
      'low': '💡'
    };

    let msg = `${riskEmoji[riskData.level]} ENHANCED RISK ALERT\n`;
    msg += `📍 #${position.asset} - ${position.side}\n`;
    msg += `📏 Distance: ${riskData.distance?.toFixed(2) || 0}%\n`;
    msg += `💰 Position: $${this.formatLargeNumber(Math.abs(position.size * position.entryPrice))}\n`;
    
    if (whalePerformance) {
      msg += `📊 Win Rate: ${whalePerformance.winRate?.toFixed(1) || 0}%\n`;
    }
    
    if (riskData.historicalLiquidations > 0) {
      msg += `⚠️ Previous liquidations: ${riskData.historicalLiquidations}\n`;
    }
    
    msg += `🎯 Risk Score: ${riskData.riskScore?.toFixed(1) || 0}/100`;

    return msg;
  }

  formatHyperlensInsightMessage(insightType, data) {
    let msg = `🔍 HYPERLENS INSIGHT\n`;
    msg += `📊 Type: ${insightType.replace(/_/g, ' ').toUpperCase()}\n`;
    
    switch (insightType) {
      case 'whale_discovery':
        msg += `🆕 New whale discovered\n`;
        msg += `💰 Initial position: $${this.formatLargeNumber(data.positionValue)}\n`;
        break;
      case 'performance_anomaly':
        msg += `📈 Unusual performance detected\n`;
        msg += `🎯 ROI: ${data.roi?.toFixed(2) || 0}%\n`;
        break;
      case 'liquidation_trend':
        msg += `📉 Liquidation trend identified\n`;
        msg += `📊 Trend: ${data.trend}\n`;
        break;
    }
    
    return msg;
  }

  /**
   * Format HOT position alert message
   */
  formatHotPositionMessage(position, whale) {
    const side = position.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
    const leverage = position.leverage ? `${position.leverage.toFixed(1)}x` : 'Unknown';
    const notional = position.notional || position.positionValue;
    const whaleInfo = whale ? `\n🐋 Whale ROI: ${(whale.roi || 0).toFixed(1)}%` : '';
    
    return `🔥 <b>HOT POSITION ALERT</b> 🔥

${side} ${position.asset}
💰 Value: $${this.formatLargeNumber(notional)}
⚡ Leverage: ${leverage}
📍 Entry: $${(position.entryPrice || 0).toFixed(2)}
🎯 Liq Price: $${(position.liquidationPx || 0).toFixed(2)}${whaleInfo}

⚠️ <b>Position over $1M - Monitor closely!</b>

💡 <i>Data powered by Hyperliquid API & Hyperlens.io</i>`;
  }

  // Override the base formatTelegramMessage to handle new alert types
  formatTelegramMessage(alert) {
    // Handle new alert types with enhanced formatting
    switch (alert.type) {
      case 'ENHANCED_LIQUIDATION':
      case 'CASCADE_WARNING':
      case 'WHALE_PATTERN':
      case 'VOLATILITY_SPIKE':
      case 'LIQUIDATION_CLUSTER':
      case 'ENHANCED_RISK':
      case 'HYPERLENS_INSIGHT':
        return this.formatEnhancedTelegramMessage(alert);
      default:
        return super.formatTelegramMessage(alert);
    }
  }

  formatEnhancedTelegramMessage(alert) {
    const baseMessage = alert.message || '';
    const address = (alert.address || '').replace(/[<>&]/g, '');
    
    let msg = baseMessage;
    
    if (address) {
      msg += `\n\n🔗 <a href="https://hyperliquid-alerts.onrender.com/summary/${address}">${address.slice(0, 6)}...${address.slice(-4)}</a>`;
    }
    
    // Add API attribution every 5th alert to avoid spam
    this.attributionCounter++;
    if (this.attributionCounter % 5 === 0 && 
        (alert.type.includes('ENHANCED') || alert.type === 'HYPERLENS_INSIGHT' || alert.type === 'HOT_POSITION')) {
      msg += `\n\n💡 <i>Data powered by Hyperliquid API & Hyperlens.io</i>`;
    }
    
    return msg;
  }
}
