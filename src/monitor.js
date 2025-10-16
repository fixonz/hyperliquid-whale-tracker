import dotenv from 'dotenv';
import chalk from 'chalk';
import { HyperliquidAPI } from './api/hyperliquid.js';
import { WhaleTracker } from './trackers/whaleTracker.js';
import { HyperlensWhaleTracker } from './trackers/hyperlensWhaleTracker.js';
import { LiquidationAnalyzer } from './analyzers/liquidationAnalyzer.js';
import { HeatmapGenerator } from './analyzers/heatmapGenerator.js';
import { AlertManager } from './alerts/alertManager.js';
import { DigestManager } from './alerts/digestManager.js';

dotenv.config();

class LiquidationMonitor {
  constructor() {
    this.api = new HyperliquidAPI(process.env.HYPERLIQUID_API_URL);
    this.whaleTracker = new WhaleTracker();
    this.hyperlensWhaleTracker = new HyperlensWhaleTracker();
    this.liquidationAnalyzer = new LiquidationAnalyzer();
    this.heatmapGenerator = new HeatmapGenerator();
    this.alertManager = new AlertManager({
      minPositionSize: parseFloat(process.env.MIN_POSITION_SIZE_USD) || 50000,
      enableConsole: true  // Enable console alerts for real-time notifications
    });
    
    // Enable digest mode (7-minute summaries)
    this.digestManager = new DigestManager(this.alertManager, 7);

    this.knownAddresses = new Set();
    this.currentPrices = {};
    this.lastHeatmap = null;
    
    this.pollInterval = parseInt(process.env.POLL_INTERVAL_MS) || 10000; // 10 seconds for better real-time updates
    this.whaleThreshold = parseFloat(process.env.WHALE_THRESHOLD_USD) || 100000;
    this.discoveryInterval = 60 * 60 * 1000; // Run discovery every hour
    
    this.isRunning = false;
    this.lastDiscovery = null;
    this.lastActiveDiscovery = null;
    this.lastLiquidationCheck = null;
    this.stats = {
      totalScans: 0,
      totalAlertsS: 0,
      whalesTracked: 0,
      positionsMonitored: 0,
      totalLiquidations: 0,
      liquidationVolume: 0,
      lastUpdate: null,
      discoveryStats: {
        lastDiscovery: null,
        totalFound: 0,
        totalAdded: 0,
        lastFound: 0,
        lastAdded: 0
      }
    };
  }

  /**
   * Initialize HyperlensWhaleTracker with real whale data
   */
  async initializeHyperlensWhales() {
    try {
      console.log(chalk.cyan('🐋 Initializing HyperlensWhaleTracker...'));
      await this.hyperlensWhaleTracker.fetchRealWhales();
      console.log(chalk.green(`✓ Loaded ${this.hyperlensWhaleTracker.whales.size} real whales from Hyperlens.io`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize HyperlensWhaleTracker:'), error.message);
      console.log(chalk.yellow('⚠️ Falling back to basic whale tracking'));
    }
  }

  /**
   * Initialize the monitor
   */
  async initialize() {
    console.log(chalk.cyan.bold('\n🚀 Hyperliquid Liquidation Monitor Starting...\n'));

    // Initialize HyperlensWhaleTracker with real data first
    await this.initializeHyperlensWhales();

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
   * Detect liquidations from fills data
   */
  async detectLiquidations(address, fills) {
    if (!fills || fills.length === 0) return;
    
    // Get recent fills (last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentFills = fills.filter(fill => {
      const fillTime = fill.time || fill.timestamp || 0;
      return fillTime > fiveMinutesAgo;
    });
    
    for (const fill of recentFills) {
      // Check if this is a liquidation (multiple ways to detect)
      const isLiquidation = fill.isLiquidation || 
                           fill.liquidation || 
                           fill.liquidation?.liquidatedUser || // Has liquidation object
                           (fill.closedPnl < 0 && Math.abs(fill.sz) < 0.001) || // Very small size = liquidation
                           (fill.closedPnl < 0 && fill.dir && fill.dir.includes('Close')); // Close with loss
      
      if (isLiquidation) {
        const asset = fill.coin || fill.asset || 'UNKNOWN';
        const side = (fill.side === 'B' || fill.side === 'BUY') ? 'LONG' : 'SHORT';
        const size = Math.abs(fill.sz || fill.size || 0);
        const price = fill.px || fill.price || 0;
        const notional = size * price;
        
        // Only alert for significant liquidations (over $10K)
        if (notional >= 10000) {
          console.log(chalk.red.bold(`🚨 LIQUIDATION DETECTED: ${asset} ${side} $${this.formatNumber(notional)}`));
          
          // Update liquidation stats
          this.stats.totalLiquidations++;
          this.stats.liquidationVolume += notional;
          
          await this.alertManager.sendAlert({
            type: 'LIQUIDATION',
            timestamp: Date.now(),
            address: address,
            asset: asset,
            side: side,
            notionalValue: notional,
            entryPrice: price,
            message: `#${asset} Liquidated ${side}: $${this.formatNumber(notional)} at $${price.toFixed(2)}`
          });
          
          // Also add to digest
          this.digestManager.addLiquidation({
            address: address,
            asset: asset,
            side: side,
            notionalValue: notional,
            leverage: 1, // We don't have leverage from fills
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Continuously find active addresses from recent trades and Hyperlens.io
   */
  async findActiveAddressesFromTrades() {
    console.log(chalk.cyan('🔍 Finding active addresses from Hyperlens.io and recent trades...'));
    
    try {
      const activeAddresses = new Set();
      let hyperlensAddresses = 0;
      
      // 1. Get addresses from Hyperlens.io
      try {
        const { HyperlensAPI } = await import('./api/hyperlens.js');
        const hyperlensAPI = new HyperlensAPI();
        
        // Get addresses from fills
        const fills = await hyperlensAPI.getFills({ limit: 1000 });
        if (fills && fills.length > 0) {
          for (const fill of fills) {
            if (fill.user && fill.user !== '0x0000000000000000000000000000000000000000') {
              activeAddresses.add(fill.user);
              hyperlensAddresses++;
            }
          }
          console.log(chalk.gray(`  📊 Hyperlens fills: ${fills.length} trades, ${hyperlensAddresses} unique addresses`));
        }
        
        // Get addresses from liquidations
        const liquidations = await hyperlensAPI.getLatestLiquidations();
        if (liquidations && liquidations.length > 0) {
          for (const liq of liquidations) {
            if (liq.user && liq.user !== '0x0000000000000000000000000000000000000000') {
              activeAddresses.add(liq.user);
            }
          }
          console.log(chalk.gray(`  🔥 Hyperlens liquidations: ${liquidations.length} events`));
        }
        
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️ Hyperlens.io discovery error: ${error.message}`));
      }
      
      // 2. Get addresses from Hyperliquid recent trades (fallback)
      const assets = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'XRP', 'DOGE', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM'];
      let hyperliquidAddresses = 0;
      
      for (const asset of assets.slice(0, 6)) { // Limit to top 6 assets to avoid rate limits
        try {
          const response = await this.api.client.post('/info', {
            type: 'recentTrades',
            coin: asset
          });
          
          if (response.data && Array.isArray(response.data)) {
            const tradesToCheck = response.data.slice(0, 500); // Reduced from 2000
            for (const trade of tradesToCheck) {
              for (const user of trade.users) {
                if (user && user !== '0x0000000000000000000000000000000000000000') {
                  activeAddresses.add(user);
                  hyperliquidAddresses++;
                }
              }
            }
            console.log(chalk.gray(`  ${asset}: ${tradesToCheck.length} trades`));
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.log(chalk.yellow(`  ⚠️ Error fetching ${asset} trades: ${error.message}`));
        }
      }
      
      console.log(chalk.green(`📊 Discovery Summary:`));
      console.log(chalk.green(`  🔍 Total unique addresses found: ${activeAddresses.size}`));
      console.log(chalk.green(`  📊 From Hyperlens.io: ${hyperlensAddresses}`));
      console.log(chalk.green(`  🔄 From Hyperliquid: ${hyperliquidAddresses}`));
      
      // Update discovery stats
      this.stats.discoveryStats.lastDiscovery = Date.now();
      this.stats.discoveryStats.lastFound = activeAddresses.size;
      this.stats.discoveryStats.totalFound += activeAddresses.size;
      
      // Add new addresses to tracking
      let newAddresses = 0;
      for (const address of activeAddresses) {
        if (!this.knownAddresses.has(address)) {
          this.addAddress(address);
          newAddresses++;
        }
      }
      
      // Update added stats
      this.stats.discoveryStats.lastAdded = newAddresses;
      this.stats.discoveryStats.totalAdded += newAddresses;
      
      // Update whale tracking count immediately
      this.stats.whalesTracked = this.knownAddresses.size;
      
      if (newAddresses > 0) {
        console.log(chalk.green.bold(`✅ Added ${newAddresses} new active addresses to tracking`));
        console.log(chalk.green(`📊 Total whales now tracked: ${this.stats.whalesTracked}`));
      } else {
        console.log(chalk.gray(`  ℹ️ No new addresses to add (${activeAddresses.size} already tracked)`));
      }
      
      return Array.from(activeAddresses);
      
    } catch (error) {
      console.error(chalk.red('Error finding active addresses:'), error.message);
      return [];
    }
  }

  /**
   * Check for liquidations in recent trades
   */
  async checkRecentLiquidations() {
    console.log(chalk.yellow('🔍 Checking for recent liquidations...'));
    
    try {
      const assets = ['BTC', 'ETH', 'SOL', 'ARB'];
      let liquidationsFound = 0;
      
      for (const asset of assets) {
        try {
          const response = await this.api.client.post('/info', {
            type: 'recentTrades',
            coin: asset
          });
          
          if (response.data && Array.isArray(response.data)) {
            // Look for large trades that might be liquidations
            const recentTrades = response.data.filter(trade => {
              const tradeTime = trade.time || 0;
              const size = Math.abs(parseFloat(trade.sz || 0));
              const price = parseFloat(trade.px || 0);
              const notional = size * price;
              
              // Check if this is a recent large trade (potential liquidation)
              return Date.now() - tradeTime < 5 * 60 * 1000 && // Last 5 minutes
                     notional > 10000; // Over $10K
            });
            
            if (recentTrades.length > 0) {
              console.log(chalk.cyan(`  ${asset}: ${recentTrades.length} large trades in last 5min`));
              
              // Check if any of these are from tracked addresses
              for (const trade of recentTrades) {
                for (const user of trade.users) {
                  if (this.knownAddresses.has(user)) {
                    const notional = Math.abs(parseFloat(trade.sz)) * parseFloat(trade.px);
                    const side = trade.side === 'B' ? 'LONG' : 'SHORT';
                    
                    console.log(chalk.red.bold(`🚨 POTENTIAL LIQUIDATION: ${asset} ${side} $${this.formatNumber(notional)}`));
                    
                    await this.alertManager.sendAlert({
                      type: 'LIQUIDATION',
                      timestamp: Date.now(),
                      address: user,
                      asset: asset,
                      side: side,
                      notionalValue: notional,
                      entryPrice: parseFloat(trade.px),
                      message: `#${asset} Liquidated ${side}: $${this.formatNumber(notional)} at $${parseFloat(trade.px).toFixed(2)}`
                    });
                    
                    liquidationsFound++;
                  }
                }
              }
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.log(chalk.yellow(`  ⚠️ Error checking ${asset} for liquidations: ${error.message}`));
        }
      }
      
      if (liquidationsFound > 0) {
        console.log(chalk.green.bold(`✅ Found ${liquidationsFound} potential liquidations`));
      } else {
        console.log(chalk.gray('  No liquidations found in recent trades'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error checking liquidations:'), error.message);
    }
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
            
            // Only log to console, don't send Telegram alerts for new wallets
            const isWhale = accountValue >= 500000; // $500K+
            const label = isWhale ? '🐋 whale' : '💼 wallet';
            console.log(chalk.cyan(`  + New ${label} discovered: ${address.slice(0, 10)}...${address.slice(-8)} | $${(accountValue / 1000).toFixed(0)}K | ${positionCount} positions`));
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
    
    // Send a test liquidation alert after 30 seconds to verify system works
    setTimeout(() => {
      this.sendTestLiquidationAlert();
    }, 30000);

    while (this.isRunning) {
      try {
        await this.scan();
        
        // Run whale discovery every hour
        if (!this.lastDiscovery || Date.now() - this.lastDiscovery > this.discoveryInterval) {
          await this.discoverNewWhales();
          this.lastDiscovery = Date.now();
        }
        
        // Find active addresses from recent trades every 10 minutes
        if (!this.lastActiveDiscovery || Date.now() - this.lastActiveDiscovery > (10 * 60 * 1000)) {
          await this.findActiveAddressesFromTrades();
          this.lastActiveDiscovery = Date.now();
        }
        
        // Check for liquidations in recent trades every 2 minutes
        const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
        if (!this.lastLiquidationCheck || Date.now() - this.lastLiquidationCheck > twoMinutesAgo) {
          await this.checkRecentLiquidations();
          this.lastLiquidationCheck = Date.now();
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
    
    // 6. Check for recent liquidations more frequently
    if (!this.lastLiquidationCheck || Date.now() - this.lastLiquidationCheck > 30000) { // Every 30 seconds
      await this.checkRecentLiquidations();
      this.lastLiquidationCheck = Date.now();
    }
    
    // 7. Update digest with Hyperlens.io data
    await this.updateDigestWithHyperlensData();

    const scanDuration = Date.now() - scanStart;
    
    // Log scan summary
    console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] `) +
      chalk.white(`Scan #${this.stats.totalScans} `) +
      chalk.gray(`| Whales: ${this.stats.whalesTracked} `) +
      chalk.gray(`| Positions: ${this.stats.positionsMonitored} `) +
      chalk.gray(`| Liquidations: ${this.stats.totalLiquidations} `) +
      chalk.gray(`| Volume: $${this.formatNumber(this.stats.liquidationVolume)} `) +
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
                                   (Date.now() - this.whaleTracker.getWhale(address)?.lastFillsUpdate || 0) > 60000; // 1 minute for liquidation detection
            
            if (shouldFetchFills) {
              try {
                const fills = await this.api.getUserFills(address);
                await this.whaleTracker.updateWhale(address, userState, fills);
                
                // Check for liquidations in recent fills
                await this.detectLiquidations(address, fills);
                
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
   * Analyze positions for liquidation risk and big positions
   */
  async analyzePositions(positions) {
    const analysis = this.liquidationAnalyzer.analyzePositions(positions, this.currentPrices);

    // Check for big positions (100M+) and liquidation risks
    for (const pos of analysis) {
      // Check for massive positions (100M+)
      if (pos.notionalValue >= 100000000) { // 100M threshold
        const whale = this.whaleTracker.getWhale(pos.address);
        await this.alertManager.sendBigPositionAlert(pos, whale);
        console.log(chalk.yellow.bold(`🚨 MASSIVE POSITION: ${pos.asset} ${pos.side} $${this.formatNumber(pos.notionalValue)}`));
        
        // Add to digest as whale activity
        this.digestManager.addWhaleOpen(pos, whale);
      }
      
      // Add high-risk positions to digest
      if (pos.isAtRisk && pos.notionalValue >= this.whaleThreshold) {
        this.digestManager.addLiquidationRisk(pos);
      }
    }
  }

  /**
   * Update digest with Hyperlens.io data
   */
  async updateDigestWithHyperlensData() {
    try {
      const { HyperlensAPI } = await import('./api/hyperlens.js');
      const hyperlensAPI = new HyperlensAPI();
      
      // Get recent fills from Hyperlens.io
      const fills = await hyperlensAPI.getFills({ limit: 100 });
      if (fills && fills.length > 0) {
        for (const fill of fills.slice(0, 50)) { // Process top 50 fills
          if (fill.user && fill.notional && Math.abs(fill.notional) >= this.whaleThreshold) {
            // Add significant fills to digest
            this.digestManager.addWhaleOpen({
              address: fill.user,
              asset: fill.coin || 'UNKNOWN',
              side: fill.side === 'B' ? 'LONG' : 'SHORT',
              size: Math.abs(fill.size || 0),
              entryPrice: fill.px || 0,
              positionValue: Math.abs(fill.notional || 0),
              leverage: 1, // Default leverage
              timestamp: fill.time || Date.now()
            }, null);
          }
        }
      }
      
      // Get recent liquidations from Hyperlens.io
      const liquidations = await hyperlensAPI.getLatestLiquidations();
      if (liquidations && liquidations.length > 0) {
        for (const liq of liquidations.slice(0, 20)) { // Process top 20 liquidations
          if (liq.user && liq.notional) {
            this.digestManager.addLiquidation({
              address: liq.user,
              asset: liq.coin || 'UNKNOWN',
              side: liq.side === 'B' ? 'LONG' : 'SHORT',
              notionalValue: Math.abs(liq.notional || 0),
              leverage: 1,
              timestamp: liq.time || Date.now()
            });
          }
        }
      }
      
    } catch (error) {
      // Silently handle Hyperlens.io errors to avoid spam
      console.log(chalk.gray(`  ℹ️ Hyperlens.io digest update: ${error.message}`));
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
   * Send a test liquidation alert to verify the system is working
   */
  async sendTestLiquidationAlert() {
    console.log(chalk.blue('🧪 Sending test liquidation alert...'));
    
    const testAlert = {
      type: 'LIQUIDATION',
      timestamp: Date.now(),
      address: '0x1234567890abcdef1234567890abcdef12345678',
      asset: 'BTC',
      side: 'LONG',
      notionalValue: 50000,
      liquidationPrice: 45000,
      entryPrice: 50000,
      message: '🧪 TEST LIQUIDATION ALERT\n#BTC - LONG\nLiquidated $50K at $45,000\n-- 0x1234...5678'
    };
    
    await this.alertManager.sendAlert(testAlert);
    
    // Update stats
    this.stats.totalLiquidations++;
    this.stats.liquidationVolume += 50000;
    
    console.log(chalk.green('✅ Test liquidation alert sent!'));
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format large numbers for display
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toFixed(0);
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

