function createRemoteDatabase(url, token, request = fetch) {
  const endpoint = new URL(url.replace(/^libsql:/, 'https:'));
  if (endpoint.protocol !== 'https:') throw new Error('Turso requires an HTTPS database URL');
  endpoint.pathname = '/v2/pipeline';
  function arg(value) {
    if (value == null) return { type: 'null' };
    if (typeof value === 'number' && Number.isInteger(value)) return { type: 'integer', value: String(value) };
    if (typeof value === 'number') return { type: 'float', value };
    return { type: 'text', value: String(value) };
  }
  async function execute(sql, params = []) {
    const response = await request(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ requests: [
        { type: 'execute', stmt: { sql: 'PRAGMA foreign_keys = ON' } },
        { type: 'execute', stmt: { sql, args: params.map(arg), want_rows: true } },
        { type: 'close' },
      ] }),
    });
    if (!response.ok) throw new Error(`Cloud database request failed (${response.status})`);
    const payload = await response.json();
    if (payload.results?.some(result => result.type === 'error')) throw new Error('Cloud database query failed');
    const result = payload.results?.[1]?.response?.result;
    if (!result) throw new Error('Invalid cloud database response');
    const rows = (result.rows || []).map(row => Object.fromEntries(row.map((cell, i) => [result.cols[i].name,
      cell.type === 'null' ? null : ['integer', 'float'].includes(cell.type) ? Number(cell.value) : cell.value,
    ])));
    return { rows, changes: result.affected_row_count, lastInsertRowid: result.last_insert_rowid == null ? undefined : Number(result.last_insert_rowid) };
  }
  return {
    async batch(statements) {
      const steps = [{ stmt: { sql: 'BEGIN IMMEDIATE' } }];
      for (const { sql, args = [] } of statements) {
        steps.push({ condition: { type: 'ok', step: steps.length - 1 }, stmt: { sql, args: args.map(arg), want_rows: true } });
      }
      const commit = steps.length;
      steps.push({ condition: { type: 'ok', step: commit - 1 }, stmt: { sql: 'COMMIT' } });
      steps.push({ condition: { type: 'not', cond: { type: 'ok', step: commit } }, stmt: { sql: 'ROLLBACK' } });
      const response = await request(endpoint, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'PRAGMA foreign_keys = ON' } }, { type: 'batch', batch: { steps } }, { type: 'close' }] }),
      });
      if (!response.ok) throw new Error(`Cloud database transaction failed (${response.status})`);
      const payload = await response.json();
      const result = payload.results?.[1]?.response?.result;
      if (payload.results?.some(item => item.type === 'error') || !result || result.step_errors?.some(Boolean)) throw new Error('Cloud database transaction failed');
      return result.step_results?.slice(1, commit);
    },
    async exec(sql) {
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await execute(statement);
    },
    prepare(sql) {
      return {
        async all(...params) { return (await execute(sql, params)).rows; },
        async get(...params) { return (await execute(sql, params)).rows[0]; },
        async run(...params) { return execute(sql, params); },
      };
    },
  };
}
module.exports = { createRemoteDatabase };
