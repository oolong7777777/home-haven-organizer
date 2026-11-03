const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { hashPassword, verifyPassword } = require('./passwords');
const { categoryStatements } = require('./db-core');
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
function problem(status, message) { return Object.assign(new Error(message), { status }); }
function text(value, max = 80) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function passwordValid(value) { return typeof value === 'string' && value.length >= 12 && value.length <= 128; }
function cookieToken(req) {
  const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('haven_session='))?.slice(14);
  return value && /^[a-zA-Z0-9_-]{43}$/.test(value) ? value : null;
}
function createAccounts(db, env = process.env) {
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  const listRooms = userId => db.prepare('SELECT h.id, h.name, m.role FROM households h JOIN memberships m ON m.household_id = h.id WHERE m.user_id = ? ORDER BY h.created_at, h.id').all(userId);
  async function limit(key, maximum) {
    const now = Date.now();
    const row = await db.prepare(`INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at < ? THEN 1 ELSE count + 1 END,
      expires_at = CASE WHEN expires_at < ? THEN excluded.expires_at ELSE expires_at END RETURNING count`).get(digest(key), now + 15 * 60 * 1000, now, now);
    if (row.count > maximum) throw problem(429, '尝试次数过多，请在 15 分钟后重试');
  }
  async function session(req) {
    const token = cookieToken(req);
    if (!token) throw problem(401, '请先登录');
    const row = await db.prepare(`SELECT s.token_hash, s.active_household_id, u.id, u.username, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(digest(token), Date.now());
    if (!row) throw problem(401, '登录已过期，请重新登录');
    return row;
  }
  async function room(userId, roomId) {
    const row = await db.prepare('SELECT h.id, h.name, m.role FROM households h JOIN memberships m ON m.household_id = h.id WHERE m.user_id = ? AND h.id = ?').get(userId, roomId || '');
    if (!row) throw problem(403, '你不是这个房间的成员');
    return row;
  }
  async function info(row) {
    const rooms = await listRooms(row.id);
    return { user: { id: row.id, username: row.username, display_name: row.display_name }, rooms, activeRoom: rooms.find(r => r.id === row.active_household_id) || rooms[0] || null };
  }
  function setCookie(req, res, value, maxAge = SESSION_MS) {
    res.cookie('haven_session', value, { httpOnly: true, secure: env.NODE_ENV === 'production' || req.secure, sameSite: 'lax', path: '/', maxAge });
  }
  async function issue(req, res, userId, roomId) {
    const token = randomBytes(32).toString('base64url');
    await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, active_household_id) VALUES (?, ?, ?, ?)').run(digest(token), userId, Date.now() + SESSION_MS, roomId);
    setCookie(req, res, token);
    return info({ ...(await db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(userId)), active_household_id: roomId });
  }
  async function register(req, res) {
    await limit(`register:${req.ip}`, 10);
    const username = text(req.body.username, 100).toLowerCase();
    const display = text(req.body.display_name, 40) || username;
    const password = req.body.password;
    const code = text(req.body.invite_code, 100);
    if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)) throw problem(400, '用户名需为 3–32 位英文字母、数字、下划线、点或短横线');
    if (!passwordValid(password)) throw problem(400, '密码需为 12–128 个字符');
    if (await db.prepare('SELECT id FROM users WHERE username = ?').get(username)) throw problem(409, '该用户名已被使用');
    const id = randomUUID();
    const home = randomUUID();
    const hash = await hashPassword(password);
    const statements = [{ sql: 'INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)', args: [id, username, display, hash] }];
    let activeRoom = home;
    if (code) {
      const invite = await db.prepare('SELECT household_id FROM invites WHERE token_hash = ? AND consumed_by IS NULL AND expires_at > ?').get(digest(code), Date.now());
      if (!invite) throw problem(400, '邀请码无效、已使用或已过期');
      activeRoom = invite.household_id;
      statements.push(
        { sql: "INSERT INTO memberships (user_id, household_id, role) VALUES (?, (SELECT household_id FROM invites WHERE token_hash = ? AND consumed_by IS NULL AND expires_at > ?), 'member')", args: [id, digest(code), Date.now()] },
        { sql: 'UPDATE invites SET consumed_by = ? WHERE token_hash = ? AND consumed_by IS NULL', args: [id, digest(code)] },
      );
    } else {
      statements.push(
        { sql: 'INSERT INTO households (id, name) VALUES (?, ?)', args: [home, text(req.body.room_name, 60) || `${display}的房间`] },
        { sql: "INSERT INTO memberships (user_id, household_id, role) VALUES (?, ?, 'owner')", args: [id, home] },
        ...categoryStatements(home),
      );
    }
    try { await db.batch(statements); }
    catch (err) {
      if (await db.prepare('SELECT id FROM users WHERE username = ?').get(username)) throw problem(409, '该用户名已被使用');
      if (code) throw problem(400, '邀请码已使用或失效，请索取新的邀请码');
      throw err;
    }
    res.status(201).json(await issue(req, res, id, activeRoom));
  }
  async function login(req, res) {
    const username = text(req.body.username, 100).toLowerCase();
    await limit(`login-ip:${req.ip}`, 40);
    await limit(`login-user:${username}`, 15);
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const password = typeof req.body.password === 'string' && req.body.password.length <= 128 ? req.body.password : '';
    const valid = await verifyPassword(password, user?.password_hash || await dummyHash);
    if (!user || !valid) throw problem(401, '用户名或密码不正确');
    if (cookieToken(req)) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(cookieToken(req)));
    const rooms = await listRooms(user.id);
    res.json(await issue(req, res, user.id, rooms[0]?.id || null));
  }
  async function logout(req, res) {
    const token = cookieToken(req);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    setCookie(req, res, '', 0);
    res.json({ success: true });
  }
  async function changePassword(req, res) {
    const current = await session(req);
    await limit(`password:${current.id}`, 10);
    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(current.id);
    if (typeof req.body.current_password !== 'string' || req.body.current_password.length > 128 || !await verifyPassword(req.body.current_password, user.password_hash)) throw problem(400, '当前密码不正确');
    if (!passwordValid(req.body.new_password)) throw problem(400, '新密码需为 12–128 个字符');
    const hash = await hashPassword(req.body.new_password);
    await db.batch([{ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hash, current.id] }, { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [current.id] }]);
    res.json(await issue(req, res, current.id, current.active_household_id));
  }
  async function createRoom(req, res) {
    const user = await session(req);
    const name = text(req.body.name, 60);
    if (!name) throw problem(400, '请输入房间名称');
    await limit(`rooms:${user.id}`, 15);
    const id = randomUUID();
    await db.batch([{ sql: 'INSERT INTO households (id, name) VALUES (?, ?)', args: [id, name] }, { sql: "INSERT INTO memberships (user_id, household_id, role) VALUES (?, ?, 'owner')", args: [user.id, id] }, ...categoryStatements(id)]);
    await db.prepare('UPDATE sessions SET active_household_id = ? WHERE token_hash = ?').run(id, user.token_hash);
    res.status(201).json(await info({ ...user, active_household_id: id }));
  }
  async function switchRoom(req, res) {
    const user = await session(req);
    const target = await room(user.id, text(req.body.room_id, 80));
    await db.prepare('UPDATE sessions SET active_household_id = ? WHERE token_hash = ?').run(target.id, user.token_hash);
    res.json(await info({ ...user, active_household_id: target.id }));
  }
  async function joinRoom(req, res) {
    const user = await session(req);
    await limit(`join:${user.id}`, 15);
    const code = text(req.body.invite_code, 100);
    const invite = await db.prepare('SELECT household_id FROM invites WHERE token_hash = ? AND consumed_by IS NULL AND expires_at > ?').get(digest(code), Date.now());
    if (!invite) throw problem(400, '邀请码无效、已使用或已过期');
    const exists = await db.prepare('SELECT user_id FROM memberships WHERE user_id = ? AND household_id = ?').get(user.id, invite.household_id);
    if (!exists) {
      try { await db.batch([
        { sql: "INSERT INTO memberships (user_id, household_id, role) VALUES (?, (SELECT household_id FROM invites WHERE token_hash = ? AND consumed_by IS NULL AND expires_at > ?), 'member')", args: [user.id, digest(code), Date.now()] },
        { sql: 'UPDATE invites SET consumed_by = ? WHERE token_hash = ? AND consumed_by IS NULL', args: [user.id, digest(code)] },
      ]); } catch { throw problem(400, '邀请码已使用或失效，请索取新的邀请码'); }
    }
    await db.prepare('UPDATE sessions SET active_household_id = ? WHERE token_hash = ?').run(invite.household_id, user.token_hash);
    res.json(await info({ ...user, active_household_id: invite.household_id }));
  }
  async function invite(req, res) {
    const user = await session(req);
    const target = await room(user.id, req.params.id);
    if (target.role !== 'owner') throw problem(403, '只有房间创建者可以邀请成员');
    await limit(`invite:${user.id}`, 30);
    const code = randomBytes(24).toString('base64url');
    const expires = Date.now() + SESSION_MS;
    await db.prepare('INSERT INTO invites (token_hash, household_id, created_by, expires_at) VALUES (?, ?, ?, ?)').run(digest(code), target.id, user.id, expires);
    res.status(201).json({ code, expires_at: expires });
  }
  async function members(req, res) {
    const user = await session(req);
    await room(user.id, req.params.id);
    res.json(await db.prepare('SELECT u.id, u.username, u.display_name, m.role FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.household_id = ? ORDER BY m.role DESC, u.created_at').all(req.params.id));
  }
  async function requireOwner(req) {
    const user = await session(req);
    const target = await room(user.id, req.params.id);
    if (target.role !== 'owner') throw problem(403, '只有房间创建者可以管理房间');
    return { user, target };
  }
  async function editRoom(req, res) {
    const { user, target } = await requireOwner(req);
    if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 60) throw problem(400, '房间名称需为 1–60 个字符');
    await db.prepare('UPDATE households SET name = ? WHERE id = ?').run(req.body.name.trim(), target.id);
    res.json(await info(user));
  }
  function fallbackSessions(home, userId) {
    return {
      sql: `UPDATE sessions SET active_household_id = (SELECT m.household_id FROM memberships m JOIN households h ON h.id = m.household_id WHERE m.user_id = sessions.user_id AND m.household_id <> ? ORDER BY h.created_at, h.id LIMIT 1) WHERE active_household_id = ?${userId ? ' AND user_id = ?' : ''}`,
      args: userId ? [home, home, userId] : [home, home],
    };
  }
  async function removeMember(req, res) {
    const { target } = await requireOwner(req);
    const member = await db.prepare('SELECT user_id, role FROM memberships WHERE household_id = ? AND user_id = ?').get(target.id, req.params.userId);
    if (!member) throw problem(404, '该成员已不在房间中');
    if (member.role === 'owner') throw problem(400, '不能移除房间创建者');
    await db.batch([
      fallbackSessions(target.id, member.user_id),
      { sql: 'DELETE FROM memberships WHERE household_id = ? AND user_id = ? AND role = ?', args: [target.id, member.user_id, 'member'] },
      // Old unused invitations should not let a removed member immediately rejoin.
      { sql: 'DELETE FROM invites WHERE household_id = ? AND consumed_by IS NULL', args: [target.id] },
    ]);
    res.json({ success: true });
  }
  async function deleteRoom(req, res) {
    const { user, target } = await requireOwner(req);
    if (req.body.confirm_name !== target.name) throw problem(400, '请输入完整房间名称以确认删除');
    await db.batch([
      fallbackSessions(target.id),
      { sql: 'DELETE FROM items WHERE household_id = ?', args: [target.id] },
      { sql: 'DELETE FROM locations WHERE household_id = ?', args: [target.id] },
      { sql: 'DELETE FROM categories WHERE household_id = ?', args: [target.id] },
      { sql: 'DELETE FROM invites WHERE household_id = ?', args: [target.id] },
      { sql: 'DELETE FROM memberships WHERE household_id = ?', args: [target.id] },
      { sql: 'DELETE FROM households WHERE id = ?', args: [target.id] },
    ]);
    res.json(await info(await session(req)));
  }
  async function authorize(req) {
    req.account = await session(req);
    const requested = req.get('X-Room-Id');
    try { req.room = await room(req.account.id, requested || req.account.active_household_id); }
    catch (err) { err.code = 'ROOM_UNAVAILABLE'; throw err; }
  }
  return { session, info, room, listRooms, register, login, logout, changePassword, createRoom, switchRoom, joinRoom, invite, members, editRoom, removeMember, deleteRoom, authorize };
}
module.exports = { createAccounts, problem };
