import { getDb } from '../client.js';

export const PositionsRepo = {
  upsert(snapshot) {
    const db = getDb();
    const id = `${snapshot.address}_${snapshot.asset}`;
    const now = Date.now();
    const insertCurrent = db.prepare(`INSERT INTO positions (id, address, asset, side, size, entry_price, leverage, notional, liquidation_px, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        side=excluded.side,
        size=excluded.size,
        entry_price=excluded.entry_price,
        leverage=excluded.leverage,
        notional=excluded.notional,
        liquidation_px=excluded.liquidation_px,
        updated_at=excluded.updated_at`);

    const insertSnapshot = db.prepare(`INSERT INTO position_snapshots
      (address, asset, side, size, entry_price, leverage, notional, liquidation_px, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const tx = db.transaction(() => {
      insertCurrent.run(
        id,
        snapshot.address,
        snapshot.asset,
        snapshot.side,
        snapshot.size,
        snapshot.entryPrice,
        snapshot.leverage,
        snapshot.positionValue,
        snapshot.liquidationPx,
        now
      );
      insertSnapshot.run(
        snapshot.address,
        snapshot.asset,
        snapshot.side,
        snapshot.size,
        snapshot.entryPrice,
        snapshot.leverage,
        snapshot.positionValue,
        snapshot.liquidationPx,
        now
      );
    });
    tx();
  },

  getLatest(address, asset) {
    const db = getDb();
    return db.prepare('SELECT * FROM positions WHERE id = ?').get(`${address}_${asset}`);
  },

  delete(address, asset) {
    const db = getDb();
    const id = `${address}_${asset}`;
    db.prepare('DELETE FROM positions WHERE id = ?').run(id);
  }
};


