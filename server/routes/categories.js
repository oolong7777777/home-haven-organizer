const express = require('express');
const router = express.Router();
const db = require('../database');
const wrap = require('../wrap');

router.get('/', wrap(async (req, res) => {
  const categories = await db.prepare(`
    SELECT c.*, COUNT(i.id) as item_count
    FROM categories c
    LEFT JOIN items i ON i.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json(categories);
}));

router.post('/', wrap(async (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: '名称不能为空' });
  const result = await db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)').run(name, color || '#6366f1', icon || '📦');
  res.json({ id: result.lastInsertRowid, name, color: color || '#6366f1', icon: icon || '📦', item_count: 0 });
}));

router.put('/:id', wrap(async (req, res) => {
  const { name, color, icon } = req.body;
  await db.prepare('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?').run(name, color, icon, req.params.id);
  res.json({ success: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  await db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
