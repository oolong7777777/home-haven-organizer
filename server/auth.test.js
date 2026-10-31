const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuth } = require('./auth');

test('production requires credentials', () => {
  assert.throws(() => createAuth({ NODE_ENV: 'production' }));
});

test('only valid credentials can access family data', () => {
  const auth = createAuth({ NODE_ENV: 'production', BASIC_AUTH_USER: 'haven', BASIC_AUTH_PASSWORD: 'test:password' });
  for (const value of ['', 'Bearer abc', 'Basic !!!', `Basic ${Buffer.from('haven:wrong').toString('base64')}`, `Basic ${Buffer.from('haven:test:password').toString('base64')}`]) {
    let allowed = false;
    let status;
    const headers = {};
    const res = { setHeader(k, v) { headers[k] = v; }, status(code) { status = code; return this; }, send() {} };
    auth({ headers: { authorization: value } }, res, () => { allowed = true; });
    assert.equal(allowed, value === `Basic ${Buffer.from('haven:test:password').toString('base64')}`);
    if (!allowed) { assert.equal(status, 401); assert.ok(headers['WWW-Authenticate']); }
    assert.equal(headers['Cache-Control'], 'no-store');
  }
});
