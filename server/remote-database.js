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
