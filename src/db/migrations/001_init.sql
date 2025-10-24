-- Whales (tracked addresses)
CREATE TABLE IF NOT EXISTS whales (
  address TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_updated INTEGER NOT NULL,
  source TEXT,
  roi REAL DEFAULT 0,
  total_pnl REAL DEFAULT 0,
  win_rate REAL DEFAULT 0,
  account_value REAL DEFAULT 0
);

-- Top traders (leaderboard membership)
CREATE TABLE IF NOT EXISTS top_traders (
  address TEXT PRIMARY KEY,
  rank INTEGER,
  pnl REAL,
  roi REAL,
  account_value REAL,
  window TEXT DEFAULT 'allTime',
  last_refreshed INTEGER NOT NULL
);

-- Current positions (materialized latest)
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY, -- address_asset
  address TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  entry_price REAL NOT NULL,
  leverage REAL,
  notional REAL NOT NULL,
  liquidation_px REAL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_positions_address ON positions(address);
CREATE INDEX IF NOT EXISTS idx_positions_asset ON positions(asset);

-- Position snapshots (history)
CREATE TABLE IF NOT EXISTS position_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  entry_price REAL NOT NULL,
  leverage REAL,
  notional REAL NOT NULL,
  liquidation_px REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_addr_asset ON position_snapshots(address, asset, created_at DESC);

-- Alerts sent (for history and de-dupe)
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  address TEXT,
  asset TEXT,
  side TEXT,
  notional REAL,
  message_id INTEGER,
  message TEXT,
  pinned INTEGER DEFAULT 0,
  correlation_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_recent ON alerts(created_at DESC);

-- Position events (open/reduce/close/liquidated)
CREATE TABLE IF NOT EXISTS position_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  address TEXT NOT NULL,
  asset TEXT NOT NULL,
  from_size REAL,
  to_size REAL,
  change_abs REAL,
  change_pct REAL,
  notional REAL,
  related_alert_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_addr_asset ON position_events(address, asset, created_at DESC);

-- Leaderboard snapshots (raw fetches)
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  window TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);


