const express = require('express');
const router = express.Router();
const db = require('../database');
const wrap = require('../wrap');

router.get('/', wrap(async (req, res) => {
  const locations = await db.prepare(`
    SELECT l.*, COUNT(i.id) as item_count
    FROM locations l
    LEFT JOIN items i ON i.location_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `).all();
  res.json(locations);
}));

router.get('/tree', wrap(async (req, res) => {
  const locations = await db.prepare(`
    SELECT l.*, COUNT(i.id) as item_count
    FROM locations l
    LEFT JOIN items i ON i.location_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `).all();

  const map = {};
  const roots = [];
  locations.forEach(loc => { map[loc.id] = { ...loc, children: [] }; });
  locations.forEach(loc => {
    if (loc.parent_id && map[loc.parent_id]) {
      map[loc.parent_id].children.push(map[loc.id]);
    } else {
      roots.push(map[loc.id]);
    }
  });
  res.json(roots);
}));

router.post('/', wrap(async (req, res) => {
  const { name, parent_id, type, description } = req.body;
  if (!name) return res.status(400).json({ error: '名称不能为空' });
  const result = await db.prepare('INSERT INTO locations (name, parent_id, type, description) VALUES (?, ?, ?, ?)').run(
    name, parent_id || null, type || 'room', description || null
  );
  res.json({ id: result.lastInsertRowid, name, parent_id: parent_id || null, type: type || 'room', description, item_count: 0 });
}));

router.put('/:id', wrap(async (req, res) => {
  const { name, parent_id, type, description } = req.body;
  await db.prepare('UPDATE locations SET name = ?, parent_id = ?, type = ?, description = ? WHERE id = ?').run(
    name, parent_id || null, type || 'room', description || null, req.params.id
  );
  res.json({ success: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  await db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
