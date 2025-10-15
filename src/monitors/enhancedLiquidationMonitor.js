import { EnhancedAlertManager } from '../alerts/enhancedAlertManager.js';
import { EnhancedWhaleTracker } from '../trackers/enhancedWhaleTracker.js';
import { HyperlensAPI } from '../api/hyperlens.js';
import { HyperliquidAPI } from '../api/hyperliquid.js';

export class EnhancedLiquidationMonitor {
  constructor(config = {}) {
    this.alertManager = new EnhancedAlertManager(config);
    this.whaleTracker = new EnhancedWhaleTracker();
    this.hyperlensAPI = new HyperlensAPI();
    this.hyperliquidAPI = new HyperliquidAPI();
    
    this.isRunning = false;
    this.monitoringInterval = config.monitoringInterval || 30000; // 30 seconds
    this.intervalId = null;
    
    // Liquidation tracking
    this.processedLiquidations = new Set();
    this.liquidationClusters = new Map();
    this.volatilityTracker = new Map();
    
    // Alert thresholds
    this.thresholds = {
      cascadeWarning: 5, // 5+ liquidations in 5 minutes
      volatilitySpike: 5, // 5% price movement in 10 minutes
      clusterFormation: 3, // 3+ liquidations within 2% price range
      patternDetection: 3 // 3+ similar behaviors
    };
  }

  /**
   * Start enhanced monitoring
   */
  async start() {
    if (this.isRunning) {
      console.log('Enhanced liquidation monitor is already running');
      return;
    }

    console.log('🚨 Starting Enhanced Liquidation Monitor with Hyperlens.io integration...');
    this.isRunning = true;

    // Initial scan
    await this.performScan();

    // Set up interval monitoring
    this.intervalId = setInterval(async () => {
      try {
        await this.performScan();
      } catch (error) {
        console.error('Error during monitoring scan:', error.message);
      }
    }, this.monitoringInterval);

    console.log(`✅ Enhanced monitoring started (scanning every ${this.monitoringInterval/1000}s)`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Enhanced Liquidation Monitor...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('✅ Enhanced monitoring stopped');
  }

  /**
   * Perform a monitoring scan
   */
  async performScan() {
    try {
      // Get latest data from multiple sources
      const [latestLiquidations, currentPositions, globalStats] = await Promise.allSettled([
        this.hyperlensAPI.getLatestLiquidations(),
        this.getCurrentPositions(),
        this.hyperlensAPI.getGlobalStats()
      ]);

      // Process liquidations
      if (latestLiquidations.status === 'fulfilled' && latestLiquidations.value) {
        await this.processLiquidations(latestLiquidations.value);
      }

      // Analyze positions for risk
      if (currentPositions.status === 'fulfilled' && currentPositions.value) {
        await this.analyzePositionsForRisk(currentPositions.value);
      }

      // Check for volatility spikes
      if (globalStats.status === 'fulfilled' && globalStats.value) {
        await this.checkVolatilitySpikes(globalStats.value);
      }

      // Detect patterns
      await this.detectWhalePatterns();

      // Check for cluster formation
      await this.checkLiquidationClusters();

    } catch (error) {
      console.error('Error in monitoring scan:', error.message);
    }
  }

  /**
   * Process new liquidations
   */
  async processLiquidations(liquidations) {
    for (const liquidation of liquidations) {
      const liquidationKey = `${liquidation.address}_${liquidation.asset}_${liquidation.timestamp}`;
      
      if (this.processedLiquidations.has(liquidationKey)) {
        continue; // Already processed
      }

      this.processedLiquidations.add(liquidationKey);

      // Get position data
      const position = await this.getPositionData(liquidation.address, liquidation.asset);
      
      if (position) {
        // Send enhanced liquidation alert
        await this.alertManager.sendEnhancedLiquidationAlert(position, liquidations);

        // Track for cluster analysis
        this.trackLiquidationForClustering(liquidation, position);

        // Update whale tracker
        await this.whaleTracker.updateWhaleEnhanced(liquidation.address);
      }

      // Clean up old processed liquidations (keep last 1000)
      if (this.processedLiquidations.size > 1000) {
        const toDelete = Array.from(this.processedLiquidations).slice(0, 100);
        toDelete.forEach(key => this.processedLiquidations.delete(key));
      }
    }
  }

  /**
   * Analyze positions for risk alerts
   */
  async analyzePositionsForRisk(positions) {
    for (const position of positions) {
      const riskData = this.calculateRiskMetrics(position);
      
      if (riskData.level === 'critical' || riskData.level === 'high') {
        await this.alertManager.sendEnhancedRiskAlert(position, riskData);
      }
    }
  }

  /**
   * Check for volatility spikes
   */
  async checkVolatilitySpikes(globalStats) {
    // This would integrate with price data to detect volatility spikes
    // For now, we'll simulate based on liquidation frequency
    
    const recentLiquidations = Array.from(this.processedLiquidations)
      .filter(key => {
        const timestamp = key.split('_').pop();
        return Date.now() - parseInt(timestamp) < 600000; // Last 10 minutes
      });

    if (recentLiquidations.length >= this.thresholds.volatilitySpike) {
      const volatilityData = {
        spikeLevel: recentLiquidations.length > 10 ? 'extreme' : 'high',
        priceChange: Math.random() * 10, // Would be real price data
        duration: 15
      };

      await this.alertManager.sendVolatilityAlert('MULTIPLE', volatilityData);
    }
  }

  /**
   * Detect whale behavior patterns
   */
  async detectWhalePatterns() {
    const whales = this.whaleTracker.getWhaleAddresses();
    
    for (const address of whales.slice(0, 50)) { // Check top 50 whales
      const whale = this.whaleTracker.getWhale(address);
      
      if (!whale) continue;

      // Detect dormant whale waking up
      if (whale.justWokeUp && whale.activePositions > 0) {
        await this.alertManager.sendWhalePatternAlert(whale, {
          type: 'dormant_wake',
          daysInactive: this.calculateDaysInactive(whale),
          positionValue: whale.marginUsed
        });
      }

      // Detect liquidation recovery
      const liquidationHistory = this.whaleTracker.getLiquidationHistory(address);
      if (liquidationHistory.length > 0 && whale.totalPnL > 0) {
        const lastLiquidation = liquidationHistory[liquidationHistory.length - 1];
        const timeSinceLiquidation = Date.now() - lastLiquidation.timestamp;
        
        if (timeSinceLiquidation < 24 * 60 * 60 * 1000) { // Within 24 hours
          await this.alertManager.sendWhalePatternAlert(whale, {
            type: 'liquidation_recovery',
            timeSinceLiquidation,
            positionValue: whale.marginUsed
          });
        }
      }

      // Detect profit taking
      if (whale.roi > 50 && whale.activePositions === 0) {
        await this.alertManager.sendWhalePatternAlert(whale, {
          type: 'profit_taking',
          winStreak: this.calculateWinStreak(whale),
          roi: whale.roi
        });
      }
    }
  }

  /**
   * Check for liquidation cluster formation
   */
  async checkLiquidationClusters() {
    for (const [asset, cluster] of this.liquidationClusters.entries()) {
      if (cluster.liquidations.length >= this.thresholds.clusterFormation) {
        const clusterData = {
          asset,
          price: cluster.avgPrice,
          totalRisk: cluster.totalRisk,
          positionCount: cluster.liquidations.length,
          riskLevel: cluster.totalRisk > 1000000 ? 'critical' : 'high',
          cascadeRisk: this.calculateCascadeRisk(cluster)
        };

        await this.alertManager.sendClusterAlert(clusterData);
        
        // Clear cluster after alerting
        this.liquidationClusters.delete(asset);
      }
    }
  }

  // Helper methods

  async getCurrentPositions() {
    // This would get current positions from your existing system
    // For now, return empty array
    return [];
  }

  async getPositionData(address, asset) {
    // This would get specific position data
    // For now, return mock data
    return {
      address,
      asset,
      side: 'LONG',
      size: 10,
      entryPrice: 2500,
      liquidationPx: 2300,
      leverage: 5.0,
      unrealizedPnL: -10000,
      positionValue: 25000
    };
  }

  calculateRiskMetrics(position) {
    const distance = Math.abs((position.entryPrice - position.liquidationPx) / position.entryPrice * 100);
    
    let level = 'low';
    if (distance < 2) level = 'critical';
    else if (distance < 5) level = 'high';
    else if (distance < 10) level = 'medium';

    return {
      level,
      distance,
      riskScore: Math.max(0, 100 - distance * 10),
      historicalLiquidations: 0 // Would be real data
    };
  }

  trackLiquidationForClustering(liquidation, position) {
    const asset = liquidation.asset;
    
    if (!this.liquidationClusters.has(asset)) {
      this.liquidationClusters.set(asset, {
        liquidations: [],
        avgPrice: 0,
        totalRisk: 0
      });
    }

    const cluster = this.liquidationClusters.get(asset);
    cluster.liquidations.push(liquidation);
    cluster.totalRisk += Math.abs(position.size * position.entryPrice);
    cluster.avgPrice = cluster.liquidations.reduce((sum, liq) => sum + liq.price, 0) / cluster.liquidations.length;

    // Clean up old clusters (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    cluster.liquidations = cluster.liquidations.filter(liq => liq.timestamp > oneHourAgo);
    
    if (cluster.liquidations.length === 0) {
      this.liquidationClusters.delete(asset);
    }
  }

  calculateDaysInactive(whale) {
    if (!whale.lastActive) return 0;
    return Math.floor((Date.now() - whale.lastActive) / (24 * 60 * 60 * 1000));
  }

  calculateWinStreak(whale) {
    // This would calculate actual win streak from trade history
    return Math.floor(Math.random() * 10) + 1;
  }

  calculateCascadeRisk(cluster) {
    // Calculate potential cascade risk based on cluster density
    const density = cluster.liquidations.length / cluster.totalRisk * 1000000;
    return Math.min(100, density * 10);
  }
}
