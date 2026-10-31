const { createHash, timingSafeEqual } = require('node:crypto');

function equal(a, b) {
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function createAuth(env = process.env) {
  const username = env.BASIC_AUTH_USER;
  const password = env.BASIC_AUTH_PASSWORD;
  if (!username && !password && env.NODE_ENV !== 'production') {
    return (req, res, next) => next();
  }
  if (!username || !password || username.includes(':')) {
    throw new Error('Set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD before starting production');
  }
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const header = req.headers.authorization || '';
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
    const supplied = match ? Buffer.from(match[1], 'base64').toString('utf8') : '';
    if (equal(supplied, `${username}:${password}`)) return next();
    res.setHeader('WWW-Authenticate', 'Basic realm="Home Haven", charset="UTF-8"');
    res.status(401).send('请使用家庭账号和密码登录');
  };
}

module.exports = { createAuth };
