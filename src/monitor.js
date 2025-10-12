import dotenv from 'dotenv';
import chalk from 'chalk';
import { HyperliquidAPI } from './api/hyperliquid.js';
import { WhaleTracker } from './trackers/whaleTracker.js';
import { LiquidationAnalyzer } from './analyzers/liquidationAnalyzer.js';
import { HeatmapGenerator } from './analyzers/heatmapGenerator.js';
import { AlertManager } from './alerts/alertManager.js';
import { DigestManager } from './alerts/digestManager.js';

dotenv.config();

class LiquidationMonitor {
  constructor() {
    this.api = new HyperliquidAPI(process.env.HYPERLIQUID_API_URL);
    this.whaleTracker = new WhaleTracker();
    this.liquidationAnalyzer = new LiquidationAnalyzer();
    this.heatmapGenerator = new HeatmapGenerator();
    this.alertManager = new AlertManager({
      minPositionSize: parseFloat(process.env.MIN_POSITION_SIZE_USD) || 50000,
      enableConsole: false  // Disable individual console alerts
    });
    
    // Enable digest mode (5-minute summaries)
    this.digestManager = new DigestManager(this.alertManager, 5);

    this.knownAddresses = new Set();
    this.currentPrices = {};
    this.lastHeatmap = null;
    
    this.pollInterval = parseInt(process.env.POLL_INTERVAL_MS) || 5000;
    this.whaleThreshold = parseFloat(process.env.WHALE_THRESHOLD_USD) || 100000;
    this.discoveryInterval = 60 * 60 * 1000; // Run discovery every hour
    
    this.isRunning = false;
    this.lastDiscovery = null;
    this.stats = {
      totalScans: 0,
      totalAlertsS: 0,
      whalesTracked: 0,
      positionsMonitored: 0,
      lastUpdate: null
    };
  }

  /**
   * Initialize the monitor
   */
  async initialize() {
    console.log(chalk.cyan.bold('\n🚀 Hyperliquid Liquidation Monitor Starting...\n'));

    // Load initial whale addresses from tracker
    const existingWhales = this.whaleTracker.getWhaleAddresses();
    existingWhales.forEach(addr => this.knownAddresses.add(addr));

    // If no addresses, start with some well-known ones or discover via API
    if (this.knownAddresses.size === 0) {
      console.log(chalk.yellow('No existing whale addresses found. Starting discovery...'));
      await this.discoverInitialAddresses();
    }

    console.log(chalk.green(`✓ Monitoring ${this.knownAddresses.size} addresses`));
    console.log(chalk.green(`✓ Poll interval: ${this.pollInterval}ms`));
    console.log(chalk.green(`✓ Whale threshold: $${this.whaleThreshold.toLocaleString()}`));
    console.log(chalk.green(`✓ Min position size: $${this.alertManager.config.minPositionSize.toLocaleString()}\n`));
  }

  /**
   * Discover initial addresses to monitor
   */
  async discoverInitialAddresses() {
    console.log(chalk.yellow('No whale addresses found. Running auto-discovery...\n'));
    await this.discoverNewWhales();
  }

  /**
   * Discover new whale addresses from Hyperliquid ledger
   */
  async discoverNewWhales() {
    console.log(chalk.cyan.bold('\n🔍 Auto-discovering new whale addresses...\n'));
    
    try {
      // Fetch ledger updates from a known address
      const response = await this.api.client.post('/info', {
        type: 'userNonFundingLedgerUpdates',
        user: '0x0000000000000000000000000000000000000000'
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        console.log(chalk.yellow('  Could not fetch ledger data'));
        return;
      }
      
      // Extract unique addresses
      const addresses = new Set();
      for (const entry of response.data) {
        if (entry.delta?.user) addresses.add(entry.delta.user.toLowerCase());
        if (entry.user) addresses.add(entry.user.toLowerCase());
      }
      
      console.log(chalk.gray(`  Found ${addresses.size} addresses from ledger`));
      
      // Verify addresses (sample 50 to avoid overwhelming the API)
      const addressArray = Array.from(addresses).filter(a => 
        a.startsWith('0x') && 
        a !== '0x0000000000000000000000000000000000000000'
      );
      
      let newWhales = 0;
      const samplesToCheck = Math.min(200, addressArray.length); // Check up to 200 addresses
      
      console.log(chalk.gray(`  Checking ${samplesToCheck} addresses for activity...\n`));
      
      for (let i = 0; i < samplesToCheck; i++) {
        const address = addressArray[i];
        
        // Skip if already tracking
        if (this.knownAddresses.has(address)) continue;
        
        try {
          const userState = await this.api.getUserState(address);
          
          if (userState && userState.marginSummary) {
            const accountValue = parseFloat(userState.marginSummary.accountValue || 0);
            const positionCount = userState.assetPositions?.length || 0;
            
            // Add ALL addresses - you never know when they'll make a big trade!
            this.addAddress(address);
            newWhales++;
            console.log(chalk.green(`  + ${address.slice(0, 10)}... | $${(accountValue / 1000).toFixed(0)}K | ${positionCount} pos`));
            
            // Send alert for new wallet discovered (only for first few to avoid spam)
            if (newWhales <= 5) {
              const isWhale = accountValue >= 500000; // $500K+
              const label = isWhale ? '🐋 whale' : '💼 wallet';
              await this.alertManager.sendAlert({
                type: isWhale ? 'NEW_WHALE_DISCOVERED' : 'NEW_WALLET_DISCOVERED',
                timestamp: Date.now(),
                address: address,
                message: `${label} discovered: ${address.slice(0, 10)}...${address.slice(-8)} | $${(accountValue / 1000).toFixed(0)}K | ${positionCount} positions`
              });
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          // Skip errors
        }
      }
      
      console.log(chalk.green.bold(`\n✅ Auto-discovery complete: +${newWhales} new whales\n`));
      
      // Also add ALL remaining addresses without individual checks (bulk add)
      let bulkAdded = 0;
      const remainingAddresses = addressArray.slice(samplesToCheck);
      console.log(chalk.cyan(`📦 Bulk adding ${remainingAddresses.length} additional addresses...\n`));
      
      for (const address of remainingAddresses.slice(0, 100)) { // Limit to 100 bulk adds per discovery
        if (!this.knownAddresses.has(address)) {
          this.addAddress(address);
          bulkAdded++;
        }
      }
      
      if (bulkAdded > 0) {
        console.log(chalk.green(`📦 Bulk discovery: +${bulkAdded} additional wallets added\n`));
      }
      
    } catch (error) {
      console.error(chalk.red('Error in auto-discovery:'), error.message);
    }
  }

  /**
   * Main monitoring loop
   */
  async start() {
    await this.initialize();
    this.isRunning = true;

    console.log(chalk.cyan.bold('📊 Monitoring started...\n'));
    
    // Show last digest immediately
    this.showLastDigest();
    
    // Start digest mode
    this.digestManager.start();

    while (this.isRunning) {
      try {
        await this.scan();
        
        // Run whale discovery every hour
        if (!this.lastDiscovery || Date.now() - this.lastDiscovery > this.discoveryInterval) {
          await this.discoverNewWhales();
          this.lastDiscovery = Date.now();
        }
        
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error(chalk.red('Error in monitoring loop:'), error.message);
        await this.sleep(this.pollInterval * 2); // Back off on error
      }
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    this.digestManager.stop();
    console.log(chalk.yellow('\n⏹ Monitoring stopped.'));
  }

  /**
   * Perform a scan cycle
   */
  async scan() {
    const scanStart = Date.now();
    this.stats.totalScans++;

    // 1. Update market prices
    await this.updatePrices();

    // 2. Scan whale positions
    const positions = await this.scanWhalePositions();

    // 3. Analyze positions
    if (positions.length > 0) {
      await this.analyzePositions(positions);
    }

    // 4. Generate heatmap
    if (positions.length > 0) {
      this.lastHeatmap = this.heatmapGenerator.generateHeatmap(positions, this.currentPrices);
      await this.checkForClusters(this.lastHeatmap);
    }

    // 5. Update stats
    this.stats.whalesTracked = this.knownAddresses.size;
    this.stats.positionsMonitored = positions.length;
    this.stats.lastUpdate = Date.now();

    const scanDuration = Date.now() - scanStart;
    
    // Log scan summary
    console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] `) +
      chalk.white(`Scan #${this.stats.totalScans} `) +
      chalk.gray(`| Whales: ${this.stats.whalesTracked} `) +
      chalk.gray(`| Positions: ${this.stats.positionsMonitored} `) +
      chalk.gray(`| Duration: ${scanDuration}ms`));
  }

  /**
   * Update current market prices
   */
  async updatePrices() {
    try {
      const mids = await this.api.getAllMids();
      if (mids) {
        this.currentPrices = mids;
      }
    } catch (error) {
      console.error(chalk.red('Error updating prices:'), error.message);
    }
  }

  /**
   * Scan positions for tracked whale addresses
   */
  async scanWhalePositions() {
    if (this.knownAddresses.size === 0) {
      return [];
    }

    const addresses = Array.from(this.knownAddresses);
    const allPositions = [];
    const currentPositionIds = new Set();

    try {
      // Scan in small batches to avoid rate limits
      const batchSize = 5; // Only 5 at a time
      const batchDelay = 3000; // 3 seconds between batches
      
      console.log(chalk.gray(`  Scanning ${addresses.length} addresses in batches of ${batchSize}...`));
      
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        
        // Process batch sequentially with delays
        for (const address of batch) {
          try {
            const userState = await this.api.getUserState(address);
            if (!userState) continue;
            
            // Check for positions
            if (userState.assetPositions && userState.assetPositions.length > 0) {
              for (const assetPos of userState.assetPositions) {
                const position = assetPos.position;
                const positionValue = Math.abs(parseFloat(position.szi || 0) * parseFloat(position.entryPx || 0));
                
                if (positionValue >= this.alertManager.config.minPositionSize) {
                  const whalePosition = {
                    address,
                    asset: position.coin,
                    size: parseFloat(position.szi || 0),
                    entryPrice: parseFloat(position.entryPx || 0),
                    leverage: parseFloat(position.leverage?.value || 1),
                    positionValue,
                    side: parseFloat(position.szi || 0) > 0 ? 'LONG' : 'SHORT',
                    unrealizedPnl: parseFloat(position.unrealizedPnl || 0),
                    marginUsed: parseFloat(position.marginUsed || 0),
                    liquidationPx: parseFloat(position.liquidationPx || 0),
                    timestamp: Date.now()
                  };
                  
                  const positionId = `${address}_${position.coin}`;
                  currentPositionIds.add(positionId);
                  
                  // Track the position
                  const result = this.whaleTracker.trackPosition(whalePosition);
                  
                  // Add to digest for new positions
                  if (result.isNew && whalePosition.positionValue >= this.whaleThreshold) {
                    const whale = this.whaleTracker.getWhale(address);
                    this.digestManager.addWhaleOpen(whalePosition, whale);
                  }
                  
                  allPositions.push(whalePosition);
                }
              }
            }
            
            // Update whale data with fills (fetch every few scans to reduce API load)
            const shouldFetchFills = !this.whaleTracker.getWhale(address) || 
                                   (Date.now() - this.whaleTracker.getWhale(address)?.lastFillsUpdate || 0) > 300000; // 5 minutes
            
            if (shouldFetchFills) {
              try {
                const fills = await this.api.getUserFills(address);
                await this.whaleTracker.updateWhale(address, userState, fills);
                // Mark when fills were last updated
                const whale = this.whaleTracker.getWhale(address);
                if (whale) {
                  whale.lastFillsUpdate = Date.now();
                }
              } catch (error) {
                // If fills fetch fails, update with empty fills array
                await this.whaleTracker.updateWhale(address, userState, []);
              }
            }
            
          } catch (error) {
            // Skip individual errors
          }
        }
        
        // Delay between batches
        if (i + batchSize < addresses.length) {
          const progress = Math.round((i / addresses.length) * 100);
          console.log(chalk.gray(`  Progress: ${progress}% (${i}/${addresses.length})`));
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      // Check for liquidations (positions that disappeared)
      await this.detectLiquidations(currentPositionIds);

      // Check for woken whales (dormant wallets that became active)
      this.checkForWokenWhales(allPositions);

    } catch (error) {
      console.error(chalk.red('Error scanning whale positions:'), error.message);
    }

    return allPositions;
  }

  /**
   * Check for dormant whales that just woke up
   */
  checkForWokenWhales(currentPositions) {
    const wokenWhales = this.whaleTracker.getWokenWhales();
    
    for (const whale of wokenWhales) {
      // Find their new position
      const newPosition = currentPositions.find(p => p.address === whale.address);
      
      if (newPosition) {
        this.digestManager.addWokenWhale(whale, newPosition);
      }
    }
    
    // Clear the wake-up flags after processing
    if (wokenWhales.length > 0) {
      this.whaleTracker.clearWakeUpFlags();
    }
  }

  /**
   * Detect liquidations by comparing current vs previous positions
   */
  async detectLiquidations(currentPositionIds) {
    const allTrackedPositions = this.whaleTracker.getAllPositions();
    
    for (const position of allTrackedPositions) {
      const positionId = `${position.address}_${position.asset}`;
      
      // Position disappeared and meets threshold - likely liquidated
      if (!currentPositionIds.has(positionId) && position.positionValue >= this.whaleThreshold) {
        const currentPrice = this.currentPrices[position.asset];
        
        // Check if price moved past liquidation price
        if (currentPrice && position.liquidationPx) {
          const wasLiquidated = 
            (position.side === 'LONG' && currentPrice <= position.liquidationPx) ||
            (position.side === 'SHORT' && currentPrice >= position.liquidationPx);
          
          if (wasLiquidated) {
            // Send immediate liquidation alert
            await this.alertManager.sendLiquidationAlert(position, currentPrice);
            
            // Also add to digest
            this.digestManager.addLiquidation(position);
            
            // Remove from tracker
            this.whaleTracker.positions.delete(positionId);
          }
        }
      }
    }
  }

  /**
   * Analyze positions for liquidation risk
   */
  async analyzePositions(positions) {
    const analysis = this.liquidationAnalyzer.analyzePositions(positions, this.currentPrices);

    // Add high-risk positions to digest
    for (const pos of analysis) {
      if (pos.isAtRisk && pos.notionalValue >= this.whaleThreshold) {
        this.digestManager.addLiquidationRisk(pos);
      }
    }
  }

  /**
   * Check for significant liquidation clusters
   */
  async checkForClusters(heatmap) {
    for (const assetData of heatmap.assets) {
      const { asset, clusters } = assetData;
      
      for (const cluster of clusters) {
        // Add large clusters to digest
        if (cluster.totalNotional >= this.whaleThreshold * 2) {
          this.digestManager.addCluster(asset, cluster);
        }
      }
    }
  }

  /**
   * Send whale position alert
   */
  async sendWhaleAlert(position, type = 'WHALE_OPEN') {
    const whale = this.whaleTracker.getWhale(position.address);
    
    await this.alertManager.sendAlert({
      type,
      address: position.address,
      asset: position.asset,
      side: position.side,
      size: Math.abs(position.size),
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      notionalValue: position.positionValue,
      liquidationPrice: position.liquidationPx,
      message: whale ? 
        `Whale with ${whale.roi >= 0 ? '+' : ''}${whale.roi.toFixed(2)}% ROI opened ${position.side} position` :
        `New whale position detected`
    });

    this.stats.totalAlertsS++;
  }

  /**
   * Send liquidation risk alert
   */
  async sendLiquidationRiskAlert(analysis) {
    await this.alertManager.sendAlert({
      type: 'LIQUIDATION_RISK',
      address: analysis.address,
      asset: analysis.asset,
      side: analysis.side,
      size: Math.abs(analysis.size),
      entryPrice: analysis.entryPrice,
      currentPrice: analysis.currentPrice,
      leverage: analysis.leverage,
      notionalValue: analysis.notionalValue,
      liquidationPrice: analysis.liquidationPrice,
      distancePercent: analysis.distancePercent,
      message: `Position at ${analysis.distancePercent.toFixed(2)}% from liquidation`
    });

    this.stats.totalAlertsS++;
  }

  /**
   * Send liquidation cluster alert
   */
  async sendClusterAlert(asset, cluster) {
    await this.alertManager.sendAlert({
      type: 'CLUSTER_ALERT',
      asset,
      notionalValue: cluster.totalNotional,
      priceRange: {
        start: cluster.startPrice,
        end: cluster.endPrice,
        startPercent: cluster.startPercent,
        endPercent: cluster.endPercent
      },
      longNotional: cluster.longNotional,
      shortNotional: cluster.shortNotional,
      positionCount: cluster.positionCount,
      message: `Large liquidation cluster detected: $${cluster.totalNotional.toLocaleString()} between ${cluster.startPercent.toFixed(2)}% and ${cluster.endPercent.toFixed(2)}%`
    });

    this.stats.totalAlertsS++;
  }

  /**
   * Add an address to monitor
   */
  addAddress(address) {
    this.knownAddresses.add(address);
    
    // Also add to whale tracker so it persists
    const whale = this.whaleTracker.getWhale(address);
    if (!whale) {
      this.whaleTracker.whales.set(address, {
        address,
        firstSeen: Date.now(),
        totalTrades: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        marginUsed: 0,
        roi: 0,
        winRate: 0,
        largestPosition: 0,
        activePositions: 0,
        lastUpdated: Date.now(),
        source: 'auto-discovery',
        lastActive: null
      });
      this.whaleTracker.saveWhaleData();
    }
  }

  /**
   * Get current heatmap data
   */
  getHeatmap() {
    return this.lastHeatmap;
  }

  /**
   * Show the last digest report immediately on startup
   */
  showLastDigest() {
    try {
      // Get current data to show immediate status
      const whales = this.whaleTracker.getTopWhales(10);
      const positions = this.whaleTracker.getAllPositions();
      const heatmap = this.heatmapGenerator.generateHeatmap(positions);
      
      console.log(chalk.blue.bold('================================================================================'));
      console.log(chalk.blue.bold('📊 CURRENT WHALE STATUS'));
      console.log(chalk.blue.bold('================================================================================'));
      console.log(chalk.cyan(`🐋 Tracking: ${this.knownAddresses.size} whale addresses`));
      console.log(chalk.cyan(`📈 Active positions: ${positions.length}`));
      console.log(chalk.cyan(`💰 Total volume: $${this.formatNumber(positions.reduce((sum, pos) => sum + pos.notional, 0))}`));
      
      if (whales.length > 0) {
        console.log(chalk.green('\n🟢 TOP PERFORMING WHALES:'));
        whales.slice(0, 5).forEach((whale, index) => {
          console.log(chalk.green(`  #${index + 1} ${whale.address.slice(0, 10)}... | PnL: $${this.formatNumber(whale.totalPnL)} | ROI: ${whale.roi.toFixed(2)}%`));
        });
      }
      
      if (positions.length > 0) {
        const highRisk = positions.filter(pos => pos.liquidationDistance < 10);
        if (highRisk.length > 0) {
          console.log(chalk.red(`\n⚠️  HIGH RISK POSITIONS: ${highRisk.length} positions < 10% from liquidation`));
        }
      }
      
      console.log(chalk.blue.bold('\n================================================================================'));
      console.log(chalk.gray('Next full digest in ~5 minutes...'));
      console.log(chalk.blue.bold('================================================================================\n'));
      
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not generate startup digest:', error.message));
    }
  }

  /**
   * Get monitoring stats
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.lastUpdate ? Date.now() - (this.stats.lastUpdate - this.pollInterval) : 0,
      topWhales: this.whaleTracker.getTopWhales(10)
    };
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the monitor if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new LiquidationMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });

  monitor.start().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { LiquidationMonitor };

