import { getDb } from '../client.js';

export const AlertsRepo = {
  insert(alert) {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO alerts (type, address, asset, side, notional, message_id, message, pinned, correlation_id, created_at)
      VALUES (@type, @address, @asset, @side, @notional, @message_id, @message, @pinned, @correlation_id, @created_at)`);
    const info = stmt.run({
      type: alert.type,
      address: alert.address || null,
      asset: alert.asset || null,
      side: alert.side || null,
      notional: alert.notional || alert.notionalValue || null,
      message_id: alert.message_id || null,
      message: alert.message || null,
      pinned: alert.pinned ? 1 : 0,
      correlation_id: alert.correlation_id || null,
      created_at: alert.created_at || Date.now()
    });
    return info.lastInsertRowid;
  },

  recentBig(limit = 20) {
    const db = getDb();
    return db.prepare(`SELECT * FROM alerts WHERE type IN ('BIG_POSITION','GROUPED_BIG_POSITIONS','LIQUIDATION') ORDER BY created_at DESC LIMIT ?`).all(limit);
  },

  recentByTypes(types = [], { since = null, limit = 50 } = {}) {
    if (!Array.isArray(types) || types.length === 0) return [];
    const db = getDb();
    const placeholders = types.map(() => '?').join(',');
    const base = `SELECT * FROM alerts WHERE type IN (${placeholders})`;
    const params = [...types];
    let sql = base;
    if (since) {
      sql += ' AND created_at >= ?';
      params.push(since);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params);
  }
};


