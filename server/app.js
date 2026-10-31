const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const wrap = require('./wrap');
const { createAccounts, problem } = require('./accounts');
const { createRoomData } = require('./room-data');
function createApp(db, env = process.env) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const accounts = createAccounts(db, env);
  const data = createRoomData(db);
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const expected = env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;
      if (origin && origin !== expected) return next(problem(403, '请求来源不允许'));
      if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '')) return next(problem(415, '请使用 JSON 格式提交'));
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.post('/api/auth/register', wrap(accounts.register));
  app.post('/api/auth/login', wrap(accounts.login));
  app.post('/api/auth/logout', wrap(accounts.logout));
  app.get('/api/auth/me', wrap(async (req, res) => res.json(await accounts.info(await accounts.session(req)))));
  app.post('/api/auth/password', wrap(accounts.changePassword));
  app.get('/api/rooms', wrap(async (req, res) => res.json(await accounts.listRooms((await accounts.session(req)).id))));
  app.post('/api/rooms', wrap(accounts.createRoom));
  app.post('/api/rooms/join', wrap(accounts.joinRoom));
  app.post('/api/rooms/switch', wrap(accounts.switchRoom));
  app.post('/api/rooms/:id/invites', wrap(accounts.invite));
  app.get('/api/rooms/:id/members', wrap(accounts.members));
  app.patch('/api/rooms/:id', wrap(accounts.editRoom));
  app.delete('/api/rooms/:id', wrap(accounts.deleteRoom));
  app.delete('/api/rooms/:id/members/:userId', wrap(accounts.removeMember));
  app.get('/api/storage', wrap(async (req, res) => { await accounts.session(req); res.json({ cloud: !!env.TURSO_DATABASE_URL, temporary: env.RENDER === 'true' && !env.TURSO_DATABASE_URL }); }));
  app.use('/api', wrap(async (req, res, next) => { await accounts.authorize(req); next(); }));
  for (const [resource, save] of [['categories', 'categorySave'], ['locations', 'locationSave'], ['items', 'itemSave']]) {
    app.get(`/api/${resource}`, wrap(async (req, res) => res.json(await data[resource](req.room.id, req.query))));
    app.post(`/api/${resource}`, wrap(async (req, res) => res.status(201).json(await data[save](req.room.id, req.body))));
    app.put(`/api/${resource}/:id`, wrap(async (req, res) => res.json(await data[save](req.room.id, req.body, req.params.id))));
    app.delete(`/api/${resource}/:id`, wrap(async (req, res) => res.json(await data.remove(resource, req.params.id, req.room.id))));
  }
  app.get('/api/locations/tree', wrap(async (req, res) => {
    const nodes = await data.locations(req.room.id);
    const map = new Map(nodes.map(node => [node.id, { ...node, children: [] }]));
    const roots = [];
    for (const node of map.values()) { if (node.parent_id && map.has(node.parent_id)) map.get(node.parent_id).children.push(node); else roots.push(node); }
    res.json(roots);
  }));
  app.get('/api/stats', wrap(async (req, res) => res.json(await data.stats(req.room.id))));
  app.get('/api/backup', wrap(async (req, res) => res.attachment('home-haven-backup.json').json(await data.backup(req.room.id))));
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) { app.use(express.static(clientDist)); app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html'))); }
  app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) console.error('Request failed:', err.message);
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : '操作失败，请稍后重试', ...(err.code === 'ROOM_UNAVAILABLE' ? { code: err.code } : {}) });
  });
  return app;
}
module.exports = { createApp };
