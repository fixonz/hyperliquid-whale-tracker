import { HyperlensAPI } from '../api/hyperlens.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HyperlensWhaleTracker {
  constructor() {
    this.api = new HyperlensAPI();
    this.whalesFile = path.join(__dirname, '../../data/hyperlens-whales.json');
    this.whales = new Map();
    this.lastUpdate = null;
  }

  /**
   * Get real profitable whales from Hyperlens.io
   */
  async fetchRealWhales() {
    try {
      console.log('🐋 Fetching real whales from Hyperlens.io...');
      
      // Try global stats (optional; API may require params)
      try {
        const globalStats = await this.api.getGlobalStats();
        console.log('📊 Global stats:', globalStats);
      } catch (e) {
        console.log('📊 Global stats unavailable:', e?.response?.status || e.message);
      }
      
      // Get recent large fills to find active whales (fetch per coin to satisfy API requirements)
      const coins = ['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'LINK', 'AVAX'];
      let largeFills = [];
      for (const coin of coins) {
        try {
          const fills = await this.api.getFills({ coin, limit: 200 });
          if (Array.isArray(fills)) largeFills.push(...fills);
          // Rate limit a bit
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          // ignore individual coin errors
        }
      }
      
      const whaleAddresses = new Set();
      const whaleData = new Map();
      
      // Process fills to find whale addresses
      if (largeFills && largeFills.length > 0) {
        console.log(`📈 Processing ${largeFills.length} large fills...`);
        
        for (const fill of largeFills) {
          const notional = typeof fill.notional === 'number' ? Math.abs(fill.notional) : Math.abs((fill.sz || fill.size || 0) * (fill.px || fill.price || 0));
          if (fill.user && notional >= 100000) {
            whaleAddresses.add(fill.user);
            
            if (!whaleData.has(fill.user)) {
              whaleData.set(fill.user, {
                address: fill.user,
                totalVolume: 0,
                totalTrades: 0,
                largestTrade: 0,
                assets: new Set(),
                lastActive: fill.time || Date.now(),
                avgTradeSize: 0,
                profitability: 'unknown'
              });
            }
            
            const whale = whaleData.get(fill.user);
            whale.totalVolume += notional;
            whale.totalTrades++;
            whale.largestTrade = Math.max(whale.largestTrade, notional);
            whale.assets.add(fill.coin);
            whale.lastActive = Math.max(whale.lastActive, fill.time || Date.now());
          }
        }
        
        // Calculate average trade size
        for (const [address, whale] of whaleData) {
          whale.avgTradeSize = whale.totalVolume / whale.totalTrades;
          whale.assets = Array.from(whale.assets);
        }
        
        console.log(`🐋 Found ${whaleAddresses.size} potential whale addresses`);
      }
      
      // Get detailed stats for each whale
      const detailedWhales = [];
      let processed = 0;
      
      for (const address of whaleAddresses) {
        try {
          // Get 7-day stats for this address
          const stats = await this.api.getAddressStats(address, { days: 7 });
          
          if (stats && stats.length > 0) {
            const latestStats = stats[0]; // Most recent day
            const whale = whaleData.get(address);
            
            // Calculate profitability score
            const winRate = latestStats.trades > 0 ? 
              (latestStats.winning_trades / latestStats.trades) * 100 : 0;
            const avgWin = latestStats.winning_trades > 0 ? 
              latestStats.total_positive_pnl / latestStats.winning_trades : 0;
            const avgLoss = latestStats.losing_trades > 0 ? 
              Math.abs(latestStats.total_negative_pnl) / latestStats.losing_trades : 0;
            
            const profitabilityScore = winRate * (avgWin / Math.max(avgLoss, 1));
            
            detailedWhales.push({
              address: address,
              totalVolume: whale.totalVolume,
              totalTrades: latestStats.trades,
              winRate: winRate,
              totalPnL: latestStats.total_pnl,
              realizedPnL: latestStats.total_pnl, // Using total PnL as realized
              unrealizedPnL: 0, // Will be updated by position scanning
              roi: profitabilityScore,
              marginUsed: latestStats.total_fees * 10, // Estimate based on fees
              largestTrade: whale.largestTrade,
              avgTradeSize: whale.avgTradeSize,
              assets: whale.assets,
              lastActive: whale.lastActive,
              liquidatedTrades: latestStats.liquidated_trades,
              winningTrades: latestStats.winning_trades,
              losingTrades: latestStats.losing_trades,
              profitability: profitabilityScore > 2 ? 'high' : 
                           profitabilityScore > 1 ? 'medium' : 'low',
              // Hyperlens.io specific data
              hyperlensData: {
                dailyStats: stats,
                lastUpdate: Date.now()
              }
            });
          }
          
          processed++;
          if (processed % 10 === 0) {
            console.log(`📊 Processed ${processed}/${whaleAddresses.size} whales...`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.log(`⚠️ Error fetching stats for ${address}: ${error.message}`);
        }
      }
      
      // Sort by profitability and volume
      detailedWhales.sort((a, b) => {
        // Primary sort: profitability score
        if (Math.abs(a.roi - b.roi) > 0.1) {
          return b.roi - a.roi;
        }
        // Secondary sort: total volume
        return b.totalVolume - a.totalVolume;
      });
      
      console.log(`✅ Found ${detailedWhales.length} profitable whales from Hyperlens.io`);
      
      // Populate in-memory map and persist
      this.whales.clear();
      for (const w of detailedWhales) {
        this.whales.set(w.address, w);
      }
      this.lastUpdate = Date.now();
      await this.saveWhales(detailedWhales);
      
      return detailedWhales;
      
    } catch (error) {
      console.error('Error fetching whales from Hyperlens.io:', error);
      return [];
    }
  }

  /**
   * Save whales to file
   */
  async saveWhales(whales) {
    try {
      const data = {
        whales: whales,
        lastUpdate: Date.now(),
        totalCount: whales.length
      };
      
      await fs.mkdir(path.dirname(this.whalesFile), { recursive: true });
      await fs.writeFile(this.whalesFile, JSON.stringify(data, null, 2));
      
      console.log(`💾 Saved ${whales.length} whales to ${this.whalesFile}`);
    } catch (error) {
      console.error('Error saving whales:', error);
    }
  }

  /**
   * Load whales from file
   */
  async loadWhales() {
    try {
      const data = await fs.readFile(this.whalesFile, 'utf8');
      const parsed = JSON.parse(data);
      
      this.whales.clear();
      parsed.whales.forEach(whale => {
        this.whales.set(whale.address, whale);
      });
      
      this.lastUpdate = parsed.lastUpdate;
      console.log(`📂 Loaded ${this.whales.size} whales from file`);
      
      return parsed.whales;
    } catch (error) {
      console.log('No existing whale file found, will fetch new data');
      return [];
    }
  }

  /**
   * Get top profitable whales
   */
  async getTopWhales(limit = 20) {
    // If no whales loaded yet, try to load from disk then fetch
    if (this.whales.size === 0) {
      const loaded = await this.loadWhales();
      if (!loaded || loaded.length === 0) {
        await this.fetchRealWhales();
      }
    }
    
    let whales = Array.from(this.whales.values());
    if (whales.length === 0) return [];
    
    // Prefer profitable first, then by volume
    whales.sort((a, b) => {
      const roiA = Number(a.roi || 0);
      const roiB = Number(b.roi || 0);
      if (Math.abs(roiB - roiA) > 0.01) return roiB - roiA;
      const volA = Number(a.totalVolume || 0);
      const volB = Number(b.totalVolume || 0);
      return volB - volA;
    });
    whales = whales.slice(0, limit);
    
    console.log(`🐋 HyperlensWhaleTracker: Returning ${whales.length} whales with real data`);
    return whales;
  }

  /**
   * Get whale by address
   */
  async getWhale(address) {
    // If no whales loaded yet, try loading first
    if (this.whales.size === 0) {
      const loaded = await this.loadWhales();
      if (!loaded || loaded.length === 0) {
        await this.fetchRealWhales();
      }
    }
    
    return this.whales.get(address);
  }

  /**
   * Update whale with current position data
   */
  updateWhalePosition(address, positionData) {
    const whale = this.whales.get(address);
    if (whale) {
      whale.unrealizedPnL = positionData.unrealizedPnL || 0;
      whale.currentPositions = positionData.positions || [];
      whale.lastPositionUpdate = Date.now();
    }
  }

  /**
   * Check if whale data is stale (older than 1 hour)
   */
  isStale() {
    return !this.lastUpdate || (Date.now() - this.lastUpdate) > (60 * 60 * 1000);
  }

  /**
   * Refresh whale data if stale
   */
  async refreshIfStale() {
    if (this.isStale()) {
      console.log('🔄 Whale data is stale, refreshing...');
      await this.fetchRealWhales();
    }
  }
}
