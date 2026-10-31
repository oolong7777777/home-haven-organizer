const db = require('./database');
const { createApp } = require('./app');
const PORT = process.env.PORT || 3001;
db.ready.then(() => {
  createApp(db).listen(PORT, () => console.log(`服务器已启动: http://localhost:${PORT}`));
}).catch(err => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
