const express = require('express');
const path = require('path');
const fs = require('fs');

const db = require('./database');
const app = express();
const PORT = process.env.PORT || 3001;

const { createAuth } = require('./auth');
const wrap = require('./wrap');
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use(createAuth());
app.use(express.json());

app.use('/api/categories', require('./routes/categories'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/items', require('./routes/items'));

app.get('/api/stats', wrap(async (req, res) => {
  const items = await db.prepare('SELECT COUNT(*) as count FROM items').get();
  const categories = await db.prepare('SELECT COUNT(*) as count FROM categories').get();
  const locations = await db.prepare('SELECT COUNT(*) as count FROM locations').get();
  const today = await db.prepare("SELECT COUNT(*) as count FROM items WHERE date(created_at) = date('now', 'localtime')").get();
  res.json({
    items: items.count,
    categories: categories.count,
    locations: locations.count,
    today: today.count,
  });
}));

app.get('/api/storage', (req, res) => res.json({ cloud: !!process.env.TURSO_DATABASE_URL, temporary: process.env.RENDER === 'true' && !process.env.TURSO_DATABASE_URL }));

app.get('/api/backup', wrap(async (req, res) => {
  const categories = await db.prepare('SELECT * FROM categories').all();
  const locations = await db.prepare('SELECT * FROM locations').all();
  const items = await db.prepare('SELECT * FROM items').all();
  res.attachment('home-haven-backup.json').json({ version: 1, exported_at: new Date().toISOString(), categories, locations, items });
}));

const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Request failed:', err.message);
  res.status(500).json({ error: '操作失败，请稍后重试' });
});

db.ready.then(() => {
  app.listen(PORT, () => console.log(`服务器已启动: http://localhost:${PORT}`));
}).catch(err => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
