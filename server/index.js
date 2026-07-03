const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./database');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/categories', require('./routes/categories'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/items', require('./routes/items'));

app.get('/api/stats', (req, res) => {
  const items = db.prepare('SELECT COUNT(*) as count FROM items').get();
  const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  const locations = db.prepare('SELECT COUNT(*) as count FROM locations').get();
  const today = db.prepare("SELECT COUNT(*) as count FROM items WHERE date(created_at) = date('now', 'localtime')").get();
  res.json({
    items: items.count,
    categories: categories.count,
    locations: locations.count,
    today: today.count,
  });
});

const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ 服务器已启动: http://localhost:${PORT}`);
});
