import { getDb } from '../client.js';

export const WhalesRepo = {
  upsert(whale) {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO whales (address, first_seen, last_updated, source, roi, total_pnl, win_rate, account_value)
      VALUES (@address, @first_seen, @last_updated, @source, @roi, @total_pnl, @win_rate, @account_value)
      ON CONFLICT(address) DO UPDATE SET
        last_updated=excluded.last_updated,
        source=COALESCE(excluded.source, whales.source),
        roi=excluded.roi,
        total_pnl=excluded.total_pnl,
        win_rate=excluded.win_rate,
        account_value=excluded.account_value`);
    stmt.run({
      address: whale.address,
      first_seen: whale.first_seen || Date.now(),
      last_updated: whale.last_updated || Date.now(),
      source: whale.source || null,
      roi: whale.roi ?? 0,
      total_pnl: whale.total_pnl ?? 0,
      win_rate: whale.win_rate ?? 0,
      account_value: whale.account_value ?? 0
    });
  },

  get(address) {
    const db = getDb();
    return db.prepare('SELECT * FROM whales WHERE address = ?').get(address);
  }
};


