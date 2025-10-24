import { getDb } from '../db/client.js';
import { AlertsRepo } from '../db/repositories/alerts.js';
import { HyperliquidAPI } from '../api/hyperliquid.js';

export class TopTradersService {
  constructor() {
    this.cache = new Set();
    this.window = 'allTime';
    this.lastRefresh = 0;
    this.refreshIntervalMs = 24 * 60 * 60 * 1000; // daily
    this.api = new HyperliquidAPI();
  }

  isTopTrader(address) {
    return this.cache.has((address || '').toLowerCase());
  }

  /**
   * Fetch leaderboard from Hyperliquid API directly
   */
  async fetchLeaderboardData() {
    try {
      const response = await this.api.client.post('/info', {
        type: 'leaderboard'
      });

      if (!response.data) {
        console.log('⚠️ No leaderboard data returned');
        return [];
      }

      const data = response.data;
      
      if (!Array.isArray(data)) {
        console.log('⚠️ Unexpected leaderboard response format:', typeof data);
        return [];
      }

      // Transform to expected format
      return data.map((entry, index) => ({
        address: entry.ethAddress || entry.user,
        rank: index + 1,
        pnl: parseFloat(entry.pnl || 0),
        roi: parseFloat(entry.roi || 0),
        accountValue: parseFloat(entry.accountValue || 0)
      })).filter(r => r.address && r.address.startsWith('0x'));
      
    } catch (error) {
      console.log(`⚠️ Error fetching leaderboard: ${error.message}`);
      return [];
    }
  }

  async refresh(fetchFn = null) {
    const db = getDb();
    const now = Date.now();
    const insert = db.prepare(`INSERT INTO top_traders (address, rank, pnl, roi, account_value, window, last_refreshed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET rank=excluded.rank, pnl=excluded.pnl, roi=excluded.roi, account_value=excluded.account_value, window=excluded.window, last_refreshed=excluded.last_refreshed`);

    // Use provided fetchFn or fetch directly from API
    const rows = fetchFn ? await fetchFn() : await this.fetchLeaderboardData();
    
    if (rows && rows.length > 0) {
      const tx = db.transaction((rows) => {
        for (const r of rows) {
          insert.run(r.address, r.rank ?? null, r.pnl ?? null, r.roi ?? null, r.accountValue ?? null, this.window, now);
        }
      });
      tx(rows);
      this.cache = new Set(rows.map(r => (r.address || '').toLowerCase()));
      this.lastRefresh = now;
      console.log(`✓ Top traders refreshed: ${rows.length} addresses`);
    } else {
      console.log('⚠️ No top traders data available');
    }
  }
}


