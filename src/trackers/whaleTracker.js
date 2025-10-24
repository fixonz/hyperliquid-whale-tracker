import fs from 'fs';
import path from 'path';

export class WhaleTracker {
  constructor() {
    this.whales = new Map(); // address -> whale data
    this.positions = new Map(); // positionId -> position data
    this.profitHistory = new Map(); // address -> historical PnL data
    this.dataDir = './data';
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

      if (fs.existsSync(whalesPath)) {
        const data = JSON.parse(fs.readFileSync(whalesPath, 'utf-8'));
        this.whales = new Map(Object.entries(data));
      }

      // To avoid stale positions on boot, skip loading positions.json by default.
      // Set LOAD_POSITIONS_FILE=true to enable loading, with freshness filter (<= 2 hours).
      if (process.env.LOAD_POSITIONS_FILE === 'true' && fs.existsSync(positionsPath)) {
        const data = JSON.parse(fs.readFileSync(positionsPath, 'utf-8'));
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;
        const entries = Object.entries(data).filter(([id, pos]) => {
          const ts = Number(pos?.lastUpdated || 0);
          return ts > 0 && (now - ts) <= twoHours;
        });
        this.positions = new Map(entries);
      }
    } catch (error) {
      console.error('Error loading whale data:', error.message);
    }
  }

  saveWhaleData() {
    try {
      const whalesPath = path.join(this.dataDir, 'whales.json');
      const positionsPath = path.join(this.dataDir, 'positions.json');

      fs.writeFileSync(whalesPath, JSON.stringify(Object.fromEntries(this.whales), null, 2));
      fs.writeFileSync(positionsPath, JSON.stringify(Object.fromEntries(this.positions), null, 2));
    } catch (error) {
      console.error('Error saving whale data:', error.message);
    }
  }

  /**
   * Calculate realized PnL from user fills
   */
  calculateRealizedPnL(fills) {
    let totalPnL = 0;
    const positionsByAsset = new Map();

    for (const fill of fills) {
      const asset = fill.coin;
      const side = fill.side === 'B' ? 1 : -1; // Buy = 1, Sell = -1
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
      
      // Closing or reducing position
      if ((pos.size > 0 && size < 0) || (pos.size < 0 && size > 0)) {
        const closingSize = Math.min(Math.abs(size), Math.abs(pos.size));
        const pnl = closingSize * (price - pos.avgEntry) * Math.sign(pos.size);
        totalPnL += pnl - fee;

        // Update position
        pos.size += size;
        if (Math.abs(pos.size) < 0.0001) {
          pos.size = 0;
          pos.avgEntry = 0;
          pos.totalCost = 0;
        }
      } else {
        // Opening or adding to position
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
   * Update whale tracking data
   */
  async updateWhale(address, userState, fills) {
    const now = Date.now();
    const realizedPnL = this.calculateRealizedPnL(fills);
    const unrealizedPnL = userState.assetPositions?.reduce((sum, pos) => {
      return sum + parseFloat(pos.position.unrealizedPnl || 0);
    }, 0) || 0;

    const totalPnL = realizedPnL + unrealizedPnL;
    const marginUsed = parseFloat(userState.marginSummary?.accountValue || 0);
    const activePositions = userState.assetPositions?.length || 0;
    const hasActivity = activePositions > 0 || fills.length > 0;

    // Initialize or update whale data
    if (!this.whales.has(address)) {
      this.whales.set(address, {
        address,
        firstSeen: now,
        totalTrades: fills.length,
        realizedPnL,
        unrealizedPnL,
        totalPnL,
        marginUsed,
        roi: marginUsed > 0 ? (totalPnL / marginUsed) * 100 : 0,
        winRate: 0,
        largestPosition: 0,
        activePositions,
        lastUpdated: now,
        lastActive: hasActivity ? now : null,
        wasDormant: false,
        dormantSince: null
      });
    } else {
      const whale = this.whales.get(address);
      const previousActivePositions = whale.activePositions || 0;
      const wasDormant = whale.wasDormant || this.isDormant(whale);
      
      whale.totalTrades = fills.length;
      whale.realizedPnL = realizedPnL;
      whale.unrealizedPnL = unrealizedPnL;
      whale.totalPnL = totalPnL;
      whale.marginUsed = marginUsed;
      whale.roi = marginUsed > 0 ? (totalPnL / marginUsed) * 100 : 0;
      whale.activePositions = activePositions;
      whale.lastUpdated = now;
      
      // Track dormancy
      if (hasActivity) {
        whale.lastActive = now;
        
        // Detect wake-up from dormancy
        if (wasDormant && activePositions > previousActivePositions) {
          whale.wasDormant = false;
          whale.dormantSince = null;
          whale.justWokeUp = true; // Flag for alert
        } else {
          whale.justWokeUp = false;
        }
      } else if (!whale.dormantSince && whale.lastActive) {
        // Start tracking dormancy
        const daysSinceActive = (now - whale.lastActive) / (24 * 60 * 60 * 1000);
        if (daysSinceActive >= 7) { // 7 days = dormant
          whale.dormantSince = whale.lastActive;
          whale.wasDormant = true;
        }
      }
    }

    // Track profit history
    if (!this.profitHistory.has(address)) {
      this.profitHistory.set(address, []);
    }
    this.profitHistory.get(address).push({
      timestamp: now,
      totalPnL,
      realizedPnL,
      unrealizedPnL,
      marginUsed
    });

    // Keep only last 1000 data points
    const history = this.profitHistory.get(address);
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    this.saveWhaleData();
    return this.whales.get(address);
  }

  /**
   * Track a whale position
   */
  trackPosition(positionData) {
    const positionId = `${positionData.address}_${positionData.asset}`;
    const existing = this.positions.get(positionId);

    // Detect new position or position change
    const isNew = !existing;
    const isChanged = existing && (
      existing.size !== positionData.size ||
      existing.side !== positionData.side
    );

    this.positions.set(positionId, {
      ...positionData,
      trackedSince: existing?.trackedSince || Date.now(),
      lastUpdated: Date.now()
    });

    if (isNew || isChanged) {
      this.saveWhaleData();
      return { isNew, isChanged, position: this.positions.get(positionId) };
    }

    return { isNew: false, isChanged: false, position: this.positions.get(positionId) };
  }

  /**
   * Get top profitable whales
   */
  getTopWhales(count = 20) {
    return Array.from(this.whales.values())
      .filter(w => w.totalPnL > 0)
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, count);
  }

  /**
   * Get all tracked positions
   */
  getAllPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Get positions by side
   */
  getPositionsBySide(side) {
    return Array.from(this.positions.values())
      .filter(p => p.side === side);
  }

  /**
   * Get whale data for an address
   */
  getWhale(address) {
    return this.whales.get(address);
  }

  /**
   * Get all tracked whale addresses
   */
  getWhaleAddresses() {
    return Array.from(this.whales.keys());
  }

  /**
   * Get top whales (by total PnL, including negative)
   */
  getTopWhales(count = 20) {
    console.log(`🔍 getTopWhales called: ${this.whales.size} whales in memory`);
    
    if (this.whales.size === 0) {
      console.log('⚠️ No whales in memory - returning empty array');
      return [];
    }
    
    const whales = Array.from(this.whales.values());
    console.log(`📊 Sample whale data:`, whales.slice(0, 2).map(w => ({
      address: w.address?.slice(0, 8) + '...',
      totalPnL: w.totalPnL,
      roi: w.roi,
      marginUsed: w.marginUsed
    })));
    
    return whales
      .sort((a, b) => b.totalPnL - a.totalPnL) // Sort by PnL (highest first)
      .slice(0, count)
      .map(whale => ({
        address: whale.address,
        totalPnL: whale.totalPnL,
        roi: whale.roi,
        marginUsed: whale.marginUsed,
        activePositions: whale.activePositions,
        totalTrades: whale.totalTrades,
        winRate: whale.winRate,
        lastActive: whale.lastActive
      }));
  }

  /**
   * Check if whale is dormant (no activity for 7+ days)
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
   * Clear wake-up flags (call after processing alerts)
   */
  clearWakeUpFlags() {
    for (const whale of this.whales.values()) {
      whale.justWokeUp = false;
    }
    this.saveWhaleData();
  }

  /**
   * Remove stale positions (older than 24 hours with no updates)
   */
  cleanupStalePositions() {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [positionId, position] of this.positions.entries()) {
      if (now - position.lastUpdated > staleThreshold) {
        this.positions.delete(positionId);
      }
    }

    this.saveWhaleData();
  }
}

