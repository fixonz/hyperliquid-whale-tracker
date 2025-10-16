import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Copy Trading Detection System
 * Identifies copy traders by analyzing identical liquidations and position patterns
 */
export class CopyTradingDetector {
  constructor() {
    this.liquidationHistory = new Map(); // Track liquidations by unique key
    this.positionHistory = new Map(); // Track position openings
    this.copyTradingPairs = new Map(); // Known copy trading relationships
    this.dataFile = join(__dirname, '../../data/copy-trading-pairs.json');
    this.loadCopyTradingData();
  }

  /**
   * Load existing copy trading data from file
   */
  async loadCopyTradingData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const pairs = JSON.parse(data);
      this.copyTradingPairs = new Map(pairs);
      console.log(`📊 Loaded ${this.copyTradingPairs.size} copy trading pairs`);
    } catch (error) {
      console.log('📊 No existing copy trading data found, starting fresh');
      this.copyTradingPairs = new Map();
    }
  }

  /**
   * Save copy trading data to file
   */
  async saveCopyTradingData() {
    try {
      const pairs = Array.from(this.copyTradingPairs.entries());
      await fs.writeFile(this.dataFile, JSON.stringify(pairs, null, 2));
    } catch (error) {
      console.error('Error saving copy trading data:', error);
    }
  }

  /**
   * Analyze liquidation for copy trading patterns
   */
  async analyzeLiquidation(liquidation) {
    const liquidationKey = this.createLiquidationKey(liquidation);
    
    // Store this liquidation
    this.liquidationHistory.set(liquidationKey, {
      ...liquidation,
      timestamp: Date.now(),
      liquidationTime: liquidation.time || Date.now()
    });

    // Check for identical liquidations (potential copy trading)
    const identicalLiquidations = this.findIdenticalLiquidations(liquidation);
    
    if (identicalLiquidations.length > 0) {
      return await this.detectCopyTrading(liquidation, identicalLiquidations);
    }

    return null;
  }

  /**
   * Create a unique key for liquidation comparison
   */
  createLiquidationKey(liquidation) {
    return `${liquidation.asset}_${liquidation.side}_${liquidation.liquidationPrice}_${liquidation.notional}_${liquidation.address}`;
  }

  /**
   * Find liquidations with identical parameters (same asset, side, price, amount)
   */
  findIdenticalLiquidations(liquidation) {
    const identical = [];
    
    for (const [key, historicalLiquidation] of this.liquidationHistory) {
      // Skip the same liquidation
      if (key.includes(liquidation.address)) continue;
      
      // Check if parameters match (within 1% tolerance for price/amount)
      if (this.isIdenticalLiquidation(liquidation, historicalLiquidation)) {
        identical.push(historicalLiquidation);
      }
    }
    
    return identical;
  }

  /**
   * Check if two liquidations are identical (copy trading candidates)
   */
  isIdenticalLiquidation(liq1, liq2) {
    // Same asset and side
    if (liq1.asset !== liq2.asset || liq1.side !== liq2.side) return false;
    
    // Same liquidation price (within 0.1% tolerance)
    const priceDiff = Math.abs(liq1.liquidationPrice - liq2.liquidationPrice) / liq2.liquidationPrice;
    if (priceDiff > 0.001) return false;
    
    // Same notional amount (within 1% tolerance)
    const amountDiff = Math.abs(liq1.notional - liq2.notional) / liq2.notional;
    if (amountDiff > 0.01) return false;
    
    // Liquidated within 5 minutes of each other
    const timeDiff = Math.abs(liq1.liquidationTime - liq2.liquidationTime);
    if (timeDiff > 5 * 60 * 1000) return false; // 5 minutes
    
    return true;
  }

  /**
   * Detect copy trading relationship
   */
  async detectCopyTrading(newLiquidation, identicalLiquidations) {
    // Find the earliest liquidation (likely the original trader)
    const originalLiquidation = identicalLiquidations.reduce((earliest, current) => 
      current.liquidationTime < earliest.liquidationTime ? current : earliest
    );

    // Determine if new liquidation is a copy trader
    const isCopyTrader = newLiquidation.liquidationTime > originalLiquidation.liquidationTime;
    
    let copyTrader, originalTrader;
    if (isCopyTrader) {
      copyTrader = newLiquidation.address;
      originalTrader = originalLiquidation.address;
    } else {
      copyTrader = originalLiquidation.address;
      originalTrader = newLiquidation.address;
    }

    // Store the copy trading relationship
    const pairKey = `${copyTrader}_${originalTrader}`;
    const relationship = {
      copyTrader,
      originalTrader,
      asset: newLiquidation.asset,
      side: newLiquidation.side,
      firstDetected: Date.now(),
      lastSeen: Date.now(),
      occurrences: (this.copyTradingPairs.get(pairKey)?.occurrences || 0) + 1,
      liquidationPrice: newLiquidation.liquidationPrice,
      notional: newLiquidation.notional
    };

    this.copyTradingPairs.set(pairKey, relationship);
    await this.saveCopyTradingData();

    console.log(`🔄 Copy trading detected: ${copyTrader.slice(0, 6)}... copying ${originalTrader.slice(0, 6)}...`);

    return {
      isCopyTrader: isCopyTrader,
      copyTrader,
      originalTrader,
      relationship,
      confidence: this.calculateConfidence(relationship)
    };
  }

  /**
   * Calculate confidence score for copy trading relationship
   */
  calculateConfidence(relationship) {
    let confidence = 0.5; // Base confidence
    
    // More occurrences = higher confidence
    confidence += Math.min(relationship.occurrences * 0.1, 0.3);
    
    // Recent activity = higher confidence
    const daysSinceLastSeen = (Date.now() - relationship.lastSeen) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen < 1) confidence += 0.2;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Get copy trading info for an address
   */
  getCopyTradingInfo(address) {
    const relationships = [];
    
    for (const [key, relationship] of this.copyTradingPairs) {
      if (relationship.copyTrader === address) {
        relationships.push({
          type: 'copy_trader',
          target: relationship.originalTrader,
          confidence: relationship.confidence || this.calculateConfidence(relationship),
          occurrences: relationship.occurrences,
          lastSeen: relationship.lastSeen
        });
      } else if (relationship.originalTrader === address) {
        relationships.push({
          type: 'being_copied',
          target: relationship.copyTrader,
          confidence: relationship.confidence || this.calculateConfidence(relationship),
          occurrences: relationship.occurrences,
          lastSeen: relationship.lastSeen
        });
      }
    }
    
    return relationships;
  }

  /**
   * Format copy trading info for alerts
   */
  formatCopyTradingAlert(liquidation, copyTradingInfo) {
    if (!copyTradingInfo) return '';
    
    const { isCopyTrader, copyTrader, originalTrader, confidence } = copyTradingInfo;
    
    if (isCopyTrader) {
      return `\n🔄 COPY TRADER: Following ${originalTrader.slice(0, 6)}...${originalTrader.slice(-4)} (${(confidence * 100).toFixed(0)}% confidence)`;
    } else {
      return `\n👑 BEING COPIED: ${copyTrader.slice(0, 6)}...${copyTrader.slice(-4)} is following (${(confidence * 100).toFixed(0)}% confidence)`;
    }
  }

  /**
   * Clean up old liquidation history (keep last 24 hours)
   */
  cleanupHistory() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, liquidation] of this.liquidationHistory) {
      if (liquidation.timestamp < cutoff) {
        this.liquidationHistory.delete(key);
      }
    }
  }

  /**
   * Get statistics about copy trading activity
   */
  getStats() {
    const totalPairs = this.copyTradingPairs.size;
    let copyTraders = 0;
    let beingCopied = 0;
    
    for (const relationship of this.copyTradingPairs.values()) {
      copyTraders++;
      beingCopied++;
    }
    
    return {
      totalPairs,
      uniqueCopyTraders: new Set(Array.from(this.copyTradingPairs.values()).map(r => r.copyTrader)).size,
      uniqueOriginalTraders: new Set(Array.from(this.copyTradingPairs.values()).map(r => r.originalTrader)).size,
      liquidationHistorySize: this.liquidationHistory.size
    };
  }
}
