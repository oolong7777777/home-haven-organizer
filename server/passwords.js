const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [algorithm, salt, hex] = (encoded || '').split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const hash = await derive(password, salt, 64);
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
module.exports = { hashPassword, verifyPassword };
