import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'db', 'migrations');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
}

function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at INTEGER NOT NULL
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations ORDER BY id').all().map(r => r.name)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const insertMig = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const tx = db.transaction(() => {
      db.exec(sql);
      insertMig.run(file, Date.now());
    });
    tx();
  }
}

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  ensureDirectories();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  runMigrations(db);
  dbInstance = db;
  return dbInstance;
}

export const paths = { DATA_DIR, DB_PATH, MIGRATIONS_DIR };


