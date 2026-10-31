const test = require('node:test');
const assert = require('node:assert/strict');
const { createRemoteDatabase } = require('./remote-database');

test('local initialization preserves records and zero quantity', async () => {
  process.env.DATABASE_PATH = ':memory:';
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  const db = require('./database');
  await db.ready;
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM categories').get()).count, 6);
  const inserted = await db.prepare('INSERT INTO items (name, quantity) VALUES (?, ?)').run('测试物品', 0);
  assert.equal((await db.prepare('SELECT * FROM items WHERE id = ?').get(inserted.lastInsertRowid)).quantity, 0);
  db.close();
});

test('cloud adapter binds values and decodes SQLite rows', async () => {
  const db = createRemoteDatabase('libsql://example.turso.io', 'test-token', async (url, options) => {
    assert.equal(String(url), 'https://example.turso.io/v2/pipeline');
    const requests = JSON.parse(options.body).requests;
    assert.equal(requests[0].stmt.sql, 'PRAGMA foreign_keys = ON');
    assert.deepEqual(requests[1].stmt.args, [{ type: 'text', value: '测试' }, { type: 'integer', value: '0' }, { type: 'null' }]);
    assert.equal(requests[2].type, 'close');
    return { ok: true, json: async () => ({ results: [
      { type: 'ok' },
      { type: 'ok', response: { result: { cols: [{ name: 'name' }, { name: 'quantity' }, { name: 'notes' }], rows: [[{ type: 'text', value: '测试' }, { type: 'integer', value: '0' }, { type: 'null' }]], last_insert_rowid: '7', affected_row_count: 1 } } },
      { type: 'ok' },
    ] }) };
  });
  assert.deepEqual(await db.prepare('SELECT ?, ?, ?').get('测试', 0, null), { name: '测试', quantity: 0, notes: null });
});

test('cloud adapter propagates failure without silently using temporary storage', async () => {
  const db = createRemoteDatabase('libsql://example.turso.io', 'test-token', async () => ({ ok: false, status: 401 }));
  await assert.rejects(db.prepare('SELECT 1').get(), /401/);
});
