import fs from 'fs';
import path from 'path';
import { HyperlensAPI } from '../api/hyperlens.js';
import { HyperliquidAPI } from '../api/hyperliquid.js';

export class EnhancedWhaleTracker {
  constructor() {
    this.whales = new Map(); // address -> whale data
    this.positions = new Map(); // positionId -> position data
    this.profitHistory = new Map(); // address -> historical PnL data
    this.liquidationHistory = new Map(); // address -> liquidation events
    this.dataDir = './data';
    
    // Initialize APIs
    this.hyperlensAPI = new HyperlensAPI();
    this.hyperliquidAPI = new HyperliquidAPI();
    
    this.ensureDataDir();
    this.loadWhaleData();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadWhaleData() {
    try {
      const whalesPath = path.join(this.dataDir, 'whales.json');
      const positionsPath = path.join(this.dataDir, 'positions.json');
      const liquidationHistoryPath = path.join(this.dataDir, 'liquidationHistory.json');

      if (fs.existsSync(whalesPath)) {
        const data = JSON.parse(fs.readFileSync(whalesPath, 'utf-8'));
        this.whales = new Map(Object.entries(data));
      }

      if (fs.existsSync(positionsPath)) {
        const data = JSON.parse(fs.readFileSync(positionsPath, 'utf-8'));
        this.positions = new Map(Object.entries(data));
      }

      if (fs.existsSync(liquidationHistoryPath)) {
        const data = JSON.parse(fs.readFileSync(liquidationHistoryPath, 'utf-8'));
        this.liquidationHistory = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading whale data:', error.message);
    }
  }

  saveWhaleData() {
    try {
      const whalesPath = path.join(this.dataDir, 'whales.json');
      const positionsPath = path.join(this.dataDir, 'positions.json');
      const liquidationHistoryPath = path.join(this.dataDir, 'liquidationHistory.json');

      fs.writeFileSync(whalesPath, JSON.stringify(Object.fromEntries(this.whales), null, 2));
      fs.writeFileSync(positionsPath, JSON.stringify(Object.fromEntries(this.positions), null, 2));
      fs.writeFileSync(liquidationHistoryPath, JSON.stringify(Object.fromEntries(this.liquidationHistory), null, 2));
    } catch (error) {
      console.error('Error saving whale data:', error.message);
    }
  }

  /**
   * Enhanced whale update using both Hyperlens and Hyperliquid APIs
   */
  async updateWhaleEnhanced(address) {
    const now = Date.now();
    
    try {
      // Get comprehensive data from Hyperlens
      const hyperlensData = await this.hyperlensAPI.getWhaleData(address);
      
      // Get additional data from Hyperliquid API
      const [userState, fills] = await Promise.allSettled([
        this.hyperliquidAPI.getUserState(address),
        this.hyperliquidAPI.getUserFills(address)
      ]);

      const userStateData = userState.status === 'fulfilled' ? userState.value : null;
      const fillsData = fills.status === 'fulfilled' ? fills.value : [];

      // Calculate metrics
      const realizedPnL = this.calculateRealizedPnL(fillsData);
      const unrealizedPnL = userStateData?.assetPositions?.reduce((sum, pos) => {
        return sum + parseFloat(pos.position.unrealizedPnl || 0);
      }, 0) || 0;

      const totalPnL = realizedPnL + unrealizedPnL;
      const marginUsed = parseFloat(userStateData?.marginSummary?.accountValue || 0);
      const activePositions = userStateData?.assetPositions?.length || 0;
      const hasActivity = activePositions > 0 || fillsData.length > 0;

      // Enhanced whale data with Hyperlens insights
      const enhancedWhale = {
        address,
        firstSeen: this.whales.get(address)?.firstSeen || now,
        totalTrades: fillsData.length,
        realizedPnL,
        unrealizedPnL,
        totalPnL,
        marginUsed,
        roi: marginUsed > 0 ? (totalPnL / marginUsed) * 100 : 0,
        activePositions,
        lastUpdated: now,
        lastActive: hasActivity ? now : this.whales.get(address)?.lastActive,
        
        // Hyperlens data
        hyperlensStats: hyperlensData?.stats || null,
        hyperlensStatsSummary: hyperlensData?.statsSummary || null,
        hyperlensPortfolio: hyperlensData?.portfolio || null,
        hyperlensPositions: hyperlensData?.positions || null,
        
        // Additional metrics
        winRate: this.calculateWinRate(fillsData),
        largestPosition: this.getLargestPosition(userStateData),
        riskScore: this.calculateRiskScore(userStateData, hyperlensData),
        performanceRank: 0, // Will be calculated when sorting
        wasDormant: this.whales.get(address)?.wasDormant || false,
        dormantSince: this.whales.get(address)?.dormantSince || null,
        justWokeUp: false
      };

      // Update dormancy tracking
      const wasDormant = this.whales.get(address)?.wasDormant || this.isDormant(enhancedWhale);
      
      if (hasActivity) {
        enhancedWhale.lastActive = now;
        
        if (wasDormant && activePositions > (this.whales.get(address)?.activePositions || 0)) {
          enhancedWhale.wasDormant = false;
          enhancedWhale.dormantSince = null;
          enhancedWhale.justWokeUp = true;
        }
      } else if (!enhancedWhale.dormantSince && enhancedWhale.lastActive) {
        const daysSinceActive = (now - enhancedWhale.lastActive) / (24 * 60 * 60 * 1000);
        if (daysSinceActive >= 7) {
          enhancedWhale.dormantSince = enhancedWhale.lastActive;
          enhancedWhale.wasDormant = true;
        }
      }

      this.whales.set(address, enhancedWhale);

      // Update profit history
      this.updateProfitHistory(address, enhancedWhale);

      // Track positions
      if (userStateData?.assetPositions) {
        this.updatePositions(address, userStateData.assetPositions);
      }

      // Check for liquidations
      await this.checkLiquidations(address, hyperlensData);

      this.saveWhaleData();
      return enhancedWhale;

    } catch (error) {
      console.error(`Error updating whale ${address}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate win rate from fills data
   */
  calculateWinRate(fills) {
    if (!fills || fills.length === 0) return 0;
    
    let profitableTrades = 0;
    const positionsByAsset = new Map();
    
    for (const fill of fills) {
      const asset = fill.coin;
      const side = fill.side === 'B' ? 1 : -1;
      const size = parseFloat(fill.sz) * side;
      const price = parseFloat(fill.px);
      
      if (!positionsByAsset.has(asset)) {
        positionsByAsset.set(asset, { size: 0, avgEntry: 0, totalCost: 0 });
      }
      
      const pos = positionsByAsset.get(asset);
      
      if ((pos.size > 0 && size < 0) || (pos.size < 0 && size > 0)) {
        const closingSize = Math.min(Math.abs(size), Math.abs(pos.size));
        const pnl = closingSize * (price - pos.avgEntry) * Math.sign(pos.size);
        
        if (pnl > 0) profitableTrades++;
        
        pos.size += size;
        if (Math.abs(pos.size) < 0.0001) {
          pos.size = 0;
          pos.avgEntry = 0;
          pos.totalCost = 0;
        }
      } else {
        const newTotalCost = pos.totalCost + (Math.abs(size) * price);
        pos.size += size;
        pos.totalCost = newTotalCost;
        pos.avgEntry = Math.abs(pos.size) > 0 ? newTotalCost / Math.abs(pos.size) : 0;
      }
    }
    
    return profitableTrades / fills.length * 100;
  }

  /**
   * Get largest position value
   */
  getLargestPosition(userState) {
    if (!userState?.assetPositions) return 0;
    
    let largest = 0;
    for (const position of userState.assetPositions) {
      const positionValue = Math.abs(parseFloat(position.position.szi) * parseFloat(position.position.entryPx));
      if (positionValue > largest) {
        largest = positionValue;
      }
    }
    
    return largest;
  }

  /**
   * Calculate risk score based on position size, leverage, and liquidation distance
   */
  calculateRiskScore(userState, hyperlensData) {
    if (!userState?.assetPositions) return 0;
    
    let totalRisk = 0;
    let positionCount = 0;
    
    for (const position of userState.assetPositions) {
      const leverage = parseFloat(position.position.leverage?.value || 1);
      const marginUsed = parseFloat(position.position.marginUsed || 0);
      const liquidationPx = parseFloat(position.position.liquidationPx || 0);
      const entryPx = parseFloat(position.position.entryPx || 0);
      
      // Leverage risk (higher leverage = higher risk)
      const leverageRisk = Math.min(leverage * 10, 100);
      
      // Liquidation distance risk
      let liquidationRisk = 50; // Default moderate risk
      if (liquidationPx > 0 && entryPx > 0) {
        const distance = Math.abs((entryPx - liquidationPx) / entryPx) * 100;
        liquidationRisk = Math.max(100 - distance * 2, 0); // Closer to liquidation = higher risk
      }
      
      // Position size risk
      const sizeRisk = Math.min(marginUsed / 10000 * 50, 50); // Larger positions = higher risk
      
      totalRisk += (leverageRisk + liquidationRisk + sizeRisk) / 3;
      positionCount++;
    }
    
    return positionCount > 0 ? totalRisk / positionCount : 0;
  }

  /**
   * Update positions with enhanced data
   */
  updatePositions(address, assetPositions) {
    for (const position of assetPositions) {
      const positionId = `${address}_${position.position.coin}`;
      const positionData = {
        address,
        asset: position.position.coin,
        size: parseFloat(position.position.szi),
        entryPrice: parseFloat(position.position.entryPx),
        leverage: parseFloat(position.position.leverage?.value || 1),
        marginUsed: parseFloat(position.position.marginUsed || 0),
        unrealizedPnl: parseFloat(position.position.unrealizedPnl || 0),
        liquidationPx: parseFloat(position.position.liquidationPx || 0),
        side: parseFloat(position.position.szi) > 0 ? 'LONG' : 'SHORT',
        positionValue: Math.abs(parseFloat(position.position.szi) * parseFloat(position.position.entryPx)),
        trackedSince: this.positions.get(positionId)?.trackedSince || Date.now(),
        lastUpdated: Date.now()
      };

      const existing = this.positions.get(positionId);
      const isNew = !existing;
      const isChanged = existing && (
        existing.size !== positionData.size ||
        existing.side !== positionData.side
      );

      this.positions.set(positionId, positionData);

      if (isNew || isChanged) {
        return { isNew, isChanged, position: positionData };
      }
    }

    return { isNew: false, isChanged: false, position: null };
  }

  /**
   * Check for liquidations using Hyperlens data
   */
  async checkLiquidations(address, hyperlensData) {
    try {
      // Get liquidation history from Hyperlens
      const liquidations = await this.hyperlensAPI.getAddressLiquidationsByCoin(address, 'ALL');
      
      if (liquidations && liquidations.length > 0) {
        if (!this.liquidationHistory.has(address)) {
          this.liquidationHistory.set(address, []);
        }
        
        const existingLiquidations = this.liquidationHistory.get(address);
        const newLiquidations = liquidations.filter(liq => 
          !existingLiquidations.some(existing => existing.id === liq.id)
        );
        
        if (newLiquidations.length > 0) {
          existingLiquidations.push(...newLiquidations.map(liq => ({
            ...liq,
            timestamp: Date.now(),
            detectedAt: new Date().toISOString()
          })));
          
          // Keep only last 100 liquidations per address
          if (existingLiquidations.length > 100) {
            existingLiquidations.splice(0, existingLiquidations.length - 100);
          }
        }
      }
    } catch (error) {
      console.error(`Error checking liquidations for ${address}:`, error.message);
    }
  }

  /**
   * Update profit history
   */
  updateProfitHistory(address, whale) {
    if (!this.profitHistory.has(address)) {
      this.profitHistory.set(address, []);
    }
    
    this.profitHistory.get(address).push({
      timestamp: Date.now(),
      totalPnL: whale.totalPnL,
      realizedPnL: whale.realizedPnL,
      unrealizedPnL: whale.unrealizedPnL,
      marginUsed: whale.marginUsed,
      roi: whale.roi,
      riskScore: whale.riskScore
    });
    
    // Keep only last 1000 data points
    const history = this.profitHistory.get(address);
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Calculate realized PnL from fills (same as original)
   */
  calculateRealizedPnL(fills) {
    let totalPnL = 0;
    const positionsByAsset = new Map();

    for (const fill of fills) {
      const asset = fill.coin;
      const side = fill.side === 'B' ? 1 : -1;
      const size = parseFloat(fill.sz) * side;
      const price = parseFloat(fill.px);
      const fee = parseFloat(fill.fee || 0);

      if (!positionsByAsset.has(asset)) {
        positionsByAsset.set(asset, {
          size: 0,
          avgEntry: 0,
          totalCost: 0
        });
      }

      const pos = positionsByAsset.get(asset);
      
      if ((pos.size > 0 && size < 0) || (pos.size < 0 && size > 0)) {
        const closingSize = Math.min(Math.abs(size), Math.abs(pos.size));
        const pnl = closingSize * (price - pos.avgEntry) * Math.sign(pos.size);
        totalPnL += pnl - fee;

        pos.size += size;
        if (Math.abs(pos.size) < 0.0001) {
          pos.size = 0;
          pos.avgEntry = 0;
          pos.totalCost = 0;
        }
      } else {
        const newTotalCost = pos.totalCost + (Math.abs(size) * price);
        pos.size += size;
        pos.totalCost = newTotalCost;
        pos.avgEntry = Math.abs(pos.size) > 0 ? newTotalCost / Math.abs(pos.size) : 0;
        totalPnL -= fee;
      }
    }

    return totalPnL;
  }

  /**
   * Batch update multiple whales
   */
  async updateBatchWhales(addresses) {
    const results = [];
    
    for (const address of addresses) {
      try {
        const whale = await this.updateWhaleEnhanced(address);
        results.push({ address, success: true, data: whale });
      } catch (error) {
        console.error(`Error updating whale ${address}:`, error.message);
        results.push({ address, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get enhanced whale analytics
   */
  getEnhancedAnalytics() {
    const whales = Array.from(this.whales.values());
    
    return {
      totalWhales: whales.length,
      activeWhales: whales.filter(w => w.activePositions > 0).length,
      dormantWhales: whales.filter(w => w.wasDormant).length,
      profitableWhales: whales.filter(w => w.totalPnL > 0).length,
      totalNotionalValue: whales.reduce((sum, w) => sum + w.marginUsed, 0),
      averageROI: whales.reduce((sum, w) => sum + w.roi, 0) / whales.length,
      averageRiskScore: whales.reduce((sum, w) => sum + w.riskScore, 0) / whales.length,
      totalLiquidations: Array.from(this.liquidationHistory.values())
        .reduce((sum, liquidations) => sum + liquidations.length, 0)
    };
  }

  /**
   * Get top whales with enhanced ranking
   */
  getTopWhalesEnhanced(count = 20, sortBy = 'totalPnL') {
    const whales = Array.from(this.whales.values());
    
    // Calculate performance rank
    const sortedByPnL = [...whales].sort((a, b) => b.totalPnL - a.totalPnL);
    sortedByPnL.forEach((whale, index) => {
      whale.performanceRank = index + 1;
    });
    
    // Sort by specified criteria
    let sorted;
    switch (sortBy) {
      case 'roi':
        sorted = whales.sort((a, b) => b.roi - a.roi);
        break;
      case 'riskScore':
        sorted = whales.sort((a, b) => b.riskScore - a.riskScore);
        break;
      case 'marginUsed':
        sorted = whales.sort((a, b) => b.marginUsed - a.marginUsed);
        break;
      case 'winRate':
        sorted = whales.sort((a, b) => b.winRate - a.winRate);
        break;
      default:
        sorted = whales.sort((a, b) => b.totalPnL - a.totalPnL);
    }
    
    return sorted.slice(0, count).map(whale => ({
      address: whale.address,
      totalPnL: whale.totalPnL,
      roi: whale.roi,
      marginUsed: whale.marginUsed,
      activePositions: whale.activePositions,
      totalTrades: whale.totalTrades,
      winRate: whale.winRate,
      riskScore: whale.riskScore,
      performanceRank: whale.performanceRank,
      lastActive: whale.lastActive,
      wasDormant: whale.wasDormant,
      hyperlensStats: whale.hyperlensStats,
      hyperlensStatsSummary: whale.hyperlensStatsSummary
    }));
  }

  /**
   * Get liquidation history for an address
   */
  getLiquidationHistory(address) {
    return this.liquidationHistory.get(address) || [];
  }

  /**
   * Get all tracked whale addresses
   */
  getWhaleAddresses() {
    return Array.from(this.whales.keys());
  }

  /**
   * Check if whale is dormant
   */
  isDormant(whale) {
    if (!whale.lastActive) return false;
    const now = Date.now();
    const daysSinceActive = (now - whale.lastActive) / (24 * 60 * 60 * 1000);
    return daysSinceActive >= 7;
  }

  /**
   * Get dormant whales
   */
  getDormantWhales() {
    return Array.from(this.whales.values())
      .filter(w => this.isDormant(w))
      .sort((a, b) => a.lastActive - b.lastActive);
  }

  /**
   * Get whales that just woke up
   */
  getWokenWhales() {
    return Array.from(this.whales.values())
      .filter(w => w.justWokeUp);
  }

  /**
   * Clear wake-up flags
   */
  clearWakeUpFlags() {
    for (const whale of this.whales.values()) {
      whale.justWokeUp = false;
    }
    this.saveWhaleData();
  }

  /**
   * Cleanup stale data
   */
  cleanupStaleData() {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup stale positions
    for (const [positionId, position] of this.positions.entries()) {
      if (now - position.lastUpdated > staleThreshold) {
        this.positions.delete(positionId);
      }
    }

    this.saveWhaleData();
  }
}
