import { getDb } from '../client.js';

export const EventsRepo = {
  insert(event) {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO position_events (event_type, address, asset, from_size, to_size, change_abs, change_pct, notional, related_alert_id, created_at)
      VALUES (@event_type, @address, @asset, @from_size, @to_size, @change_abs, @change_pct, @notional, @related_alert_id, @created_at)`);
    stmt.run({
      event_type: event.event_type,
      address: event.address,
      asset: event.asset,
      from_size: event.from_size ?? null,
      to_size: event.to_size ?? null,
      change_abs: event.change_abs ?? null,
      change_pct: event.change_pct ?? null,
      notional: event.notional ?? null,
      related_alert_id: event.related_alert_id ?? null,
      created_at: event.created_at || Date.now()
    });
  }
};


