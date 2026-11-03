const test = require('node:test');
const assert = require('node:assert/strict');
const { createRemoteDatabase } = require('./remote-database');

test('local initialization preserves records and zero quantity', async () => {
  const { createDatabase } = require('./db-core');
  const db = createDatabase({ DATABASE_PATH: ':memory:', BASIC_AUTH_USER: 'haven', BASIC_AUTH_PASSWORD: 'test migration password' });
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

test('cloud transactions guard later steps and roll back SQL errors', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE sample (id TEXT PRIMARY KEY NOT NULL)');
  const db = createRemoteDatabase('libsql://example.turso.io', 'test-token', async (url, options) => {
    const requests = JSON.parse(options.body).requests;
    const steps = requests[1].batch.steps;
    const results = [], errors = [];
    function condition(c) {
      if (!c) return true;
      if (c.type === 'ok') return results[c.step] != null && !errors[c.step];
      if (c.type === 'not') return !condition(c.cond);
      throw Error('Unexpected condition');
    }
    for (const step of steps) {
      let result = null, error = null;
      if (condition(step.condition)) {
        try {
          const args = (step.stmt.args || []).map(a => a.type === 'null' ? null : a.type === 'integer' ? Number(a.value) : a.value);
          const rows = sqlite.prepare(step.stmt.sql).all(...args);
          result = { rows, cols: [] };
        } catch (err) { error = { message: err.message }; }
      }
      results.push(result); errors.push(error);
    }
    return { ok: true, json: async () => ({ results: [{ type: 'ok' }, { type: 'ok', response: { result: { step_results: results, step_errors: errors } } }, { type: 'ok' }] }) };
  });
  await db.batch([{ sql: 'INSERT INTO sample VALUES (?)', args: ['one'] }]);
  await assert.rejects(db.batch([{ sql: 'INSERT INTO sample VALUES (?)', args: ['two'] }, { sql: 'INSERT INTO sample VALUES (?)', args: ['one'] }, { sql: 'INSERT INTO sample VALUES (?)', args: ['three'] }]));
  assert.deepEqual(sqlite.prepare('SELECT id FROM sample').all().map(row => row.id), ['one']);
  sqlite.close();
});


test('smart search covers all fields, ancestor locations and cross-field keywords', async () => {
  const { matchesItem, locationPaths } = require('../shared/item-search.mjs');
  const item = { name: 'Apple 充电器', category_name: '电子设备', description: '白色 USB 电源', notes: '旅行备用' };
  const paths = locationPaths([{ id: 1, name: '主卧室' }, { id: 2, name: '衣柜', parent_id: 1 }, { id: 3, name: '第一层', parent_id: 2 }]);
  const location = paths.get('3');
  for (const query of ['充电器', '主卧', '第一层', '电子', '白色', '旅行', '主卧 旅行', '主卧，旅行', 'ＡＰＰＬＥ', 'aple', '卧柜', '主卧 电子 备用', '   ']) assert.equal(matchesItem(item, query, location), true, query);
  for (const query of ['厨房', '主卧 抽纸', 'grape', '旅行 食品']) assert.equal(matchesItem(item, query, location), false, query);
  assert.doesNotThrow(() => locationPaths([{ id: 1, name: '循环位置', parent_id: 1 }]));
});

test('expiry dates validate calendar days and show Shanghai expiry states', () => {
  const { validExpiry, expiryStatus, shanghaiDate } = require('../shared/item-expiry.mjs');
  for (const date of [null, '2028-02-29', '2026-12-31']) assert.equal(validExpiry(date), true);
  for (const date of ['', '2027-02-29', '2026-04-31', '2026-13-01', '2026-1-2', true, '0000-01-01']) assert.equal(validExpiry(date), false);
  assert.equal(shanghaiDate(new Date('2026-11-03T16:00:00Z')), '2026-11-04');
  assert.equal(expiryStatus(null, '2026-11-03').badge, '永久');
  assert.equal(expiryStatus('2026-11-02', '2026-11-03').tone, 'expired');
  assert.equal(expiryStatus('2026-11-03', '2026-11-03').badge, '今日到期');
  assert.equal(expiryStatus('2026-12-03', '2026-11-03').tone, 'soon');
  assert.equal(expiryStatus('2026-12-04', '2026-11-03').tone, 'valid');
});
