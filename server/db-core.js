const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createRemoteDatabase } = require('./remote-database');
const { hashPassword } = require('./passwords');
const DEFAULT_CATEGORIES = [['食品', '#ef4444', '🍎'], ['衣物', '#8b5cf6', '👕'], ['电器', '#3b82f6', '💻'], ['书籍', '#f59e0b', '📚'], ['日用品', '#10b981', '🧴'], ['其他', '#6b7280', '📦']];
function categoryStatements(home) {
  return DEFAULT_CATEGORIES.map(([name, color, icon]) => ({ sql: 'INSERT INTO categories (name, color, icon, household_id) VALUES (?, ?, ?, ?)', args: [name, color, icon, home] }));
}
function createDatabase(env = process.env) {
  if (!!env.TURSO_DATABASE_URL !== !!env.TURSO_AUTH_TOKEN) throw new Error('Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  const db = env.TURSO_DATABASE_URL ? createRemoteDatabase(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN) : new DatabaseSync(env.DATABASE_PATH || path.join(__dirname, 'database.sqlite'));
  if (!env.TURSO_DATABASE_URL) {
    db.batch = async statements => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(({ sql, args = [] }) => db.prepare(sql).all(...args));
        db.exec('COMMIT');
        return results;
      } catch (err) { db.exec('ROLLBACK'); throw err; }
    };
  }
  db.ready = (async () => {
    if (!env.TURSO_DATABASE_URL) await db.exec('PRAGMA journal_mode = WAL');
    await db.exec('PRAGMA foreign_keys = ON');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS memberships (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('owner', 'member')), PRIMARY KEY(user_id, household_id));
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, active_household_id TEXT REFERENCES households(id));
      CREATE TABLE IF NOT EXISTS invites (token_hash TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, created_by TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL, consumed_by TEXT REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#6366f1', icon TEXT DEFAULT '📦', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, parent_id INTEGER REFERENCES locations(id) ON DELETE SET NULL, type TEXT DEFAULT 'room', description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, quantity INTEGER DEFAULT 1, unit TEXT DEFAULT '个', location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
    for (const table of ['categories', 'locations', 'items']) {
      const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
      if (!columns.some(column => column.name === 'household_id')) await db.exec(`ALTER TABLE ${table} ADD COLUMN household_id TEXT REFERENCES households(id)`);
      await db.exec(`CREATE INDEX IF NOT EXISTS ${table}_household ON ${table}(household_id)`);
    }
    await db.exec('CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)');
    let legacyCount = 0;
    for (const table of ['categories', 'locations', 'items']) legacyCount += (await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE household_id IS NULL`).get()).count;
    const legacyHome = 'home-legacy';
    const migrated = await db.prepare('SELECT id FROM households WHERE id = ?').get(legacyHome);
    if (!migrated && (legacyCount || (env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD))) {
      if (!env.BASIC_AUTH_USER || !env.BASIC_AUTH_PASSWORD) throw new Error('Existing records require BASIC_AUTH_USER and BASIC_AUTH_PASSWORD for owner migration');
      const username = env.BASIC_AUTH_USER.trim().toLowerCase();
      const ownerId = randomUUID();
      const passwordHash = await hashPassword(env.BASIC_AUTH_PASSWORD);
      const statements = [
        { sql: 'INSERT INTO households (id, name) VALUES (?, ?)', args: [legacyHome, '我的收纳房间'] },
        { sql: 'INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)', args: [ownerId, username, '家庭管理员', passwordHash] },
        { sql: "INSERT INTO memberships (user_id, household_id, role) VALUES (?, ?, 'owner')", args: [ownerId, legacyHome] },
        ...['categories', 'locations', 'items'].map(table => ({ sql: `UPDATE ${table} SET household_id = ? WHERE household_id IS NULL`, args: [legacyHome] })),
      ];
      if (!legacyCount) statements.push(...categoryStatements(legacyHome));
      await db.batch(statements);
    }
    if (await db.prepare('SELECT id FROM households WHERE id = ?').get(legacyHome)) {
      // During a rolling deploy the old version can briefly insert rows without a room.
      for (const table of ['categories', 'locations', 'items']) {
        await db.prepare(`CREATE TRIGGER IF NOT EXISTS ${table}_legacy_room AFTER INSERT ON ${table} WHEN NEW.household_id IS NULL BEGIN UPDATE ${table} SET household_id = 'home-legacy' WHERE id = NEW.id; END`).run();
      }
      await db.batch(['categories', 'locations', 'items'].map(table => ({ sql: `UPDATE ${table} SET household_id = ? WHERE household_id IS NULL`, args: [legacyHome] })));
    }
    const now = Date.now();
    await db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    await db.prepare('DELETE FROM auth_limits WHERE expires_at < ?').run(now);
  })();
  return db;
}
module.exports = { createDatabase, categoryStatements };
