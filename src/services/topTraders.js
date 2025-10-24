import { getDb } from '../db/client.js';
import { AlertsRepo } from '../db/repositories/alerts.js';

export class TopTradersService {
  constructor() {
    this.cache = new Set();
    this.window = 'allTime';
    this.lastRefresh = 0;
    this.refreshIntervalMs = 24 * 60 * 60 * 1000; // daily
  }

  isTopTrader(address) {
    return this.cache.has((address || '').toLowerCase());
  }

  async refresh(fetchFn) {
    // fetchFn should return array of { address, rank, pnl, roi, accountValue }
    const db = getDb();
    const now = Date.now();
    const insert = db.prepare(`INSERT INTO top_traders (address, rank, pnl, roi, account_value, window, last_refreshed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET rank=excluded.rank, pnl=excluded.pnl, roi=excluded.roi, account_value=excluded.account_value, window=excluded.window, last_refreshed=excluded.last_refreshed`);

    const tx = db.transaction((rows) => {
      for (const r of rows) {
        insert.run(r.address, r.rank ?? null, r.pnl ?? null, r.roi ?? null, r.accountValue ?? null, this.window, now);
      }
    });

    const rows = await fetchFn();
    tx(rows);
    this.cache = new Set(rows.map(r => (r.address || '').toLowerCase()));
    this.lastRefresh = now;
  }
}


