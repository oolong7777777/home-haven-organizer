const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
const { createRemoteDatabase } = require('./remote-database');
if (!!process.env.TURSO_DATABASE_URL !== !!process.env.TURSO_AUTH_TOKEN) {
  throw new Error('Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
}
const db = process.env.TURSO_DATABASE_URL
  ? createRemoteDatabase(process.env.TURSO_DATABASE_URL, process.env.TURSO_AUTH_TOKEN)
  : new DatabaseSync(dbPath);

async function initialize() {

if (!process.env.TURSO_DATABASE_URL) await db.exec('PRAGMA journal_mode = WAL');
await db.exec('PRAGMA foreign_keys = ON');

await db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT '📦',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'room',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit TEXT DEFAULT '个',
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const catCount = await db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (catCount.count === 0) {
  const ins = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
  await ins.run('食品', '#ef4444', '🍎');
  await ins.run('衣物', '#8b5cf6', '👕');
  await ins.run('电器', '#3b82f6', '💻');
  await ins.run('书籍', '#f59e0b', '📚');
  await ins.run('日用品', '#10b981', '🧴');
  await ins.run('其他', '#6b7280', '📦');
}

}
db.ready = initialize();
module.exports = db;
