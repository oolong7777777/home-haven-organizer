const express = require('express');
const router = express.Router();
const db = require('../database');
const wrap = require('../wrap');

const ITEM_JOIN = `
  SELECT i.*,
    c.name as category_name, c.color as category_color, c.icon as category_icon,
    l.name as location_name
  FROM items i
  LEFT JOIN categories c ON i.category_id = c.id
  LEFT JOIN locations l ON i.location_id = l.id
`;

router.get('/', wrap(async (req, res) => {
  const { q, category_id, location_id } = req.query;
  let query = ITEM_JOIN;
  const params = [];
  const conditions = [];

  if (category_id) { conditions.push('i.category_id = ?'); params.push(category_id); }
  if (location_id) { conditions.push('i.location_id = ?'); params.push(location_id); }
  if (q) {
    conditions.push('(i.name LIKE ? OR i.description LIKE ? OR i.notes LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY i.updated_at DESC';

  res.json(await db.prepare(query).all(...params));
}));

router.post('/', wrap(async (req, res) => {
  const { name, description, quantity, unit, location_id, category_id, notes } = req.body;
  if (!name) return res.status(400).json({ error: '名称不能为空' });
  const result = await db.prepare(`
    INSERT INTO items (name, description, quantity, unit, location_id, category_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || null, quantity ?? 1, unit || '个', location_id || null, category_id || null, notes || null);

  const item = await db.prepare(ITEM_JOIN + ' WHERE i.id = ?').get(result.lastInsertRowid);
  res.json(item);
}));

router.put('/:id', wrap(async (req, res) => {
  const { name, description, quantity, unit, location_id, category_id, notes } = req.body;
  await db.prepare(`
    UPDATE items SET name=?, description=?, quantity=?, unit=?,
    location_id=?, category_id=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description || null, quantity ?? 1, unit || '个', location_id || null, category_id || null, notes || null, req.params.id);

  const item = await db.prepare(ITEM_JOIN + ' WHERE i.id = ?').get(req.params.id);
  res.json(item);
}));

router.delete('/:id', wrap(async (req, res) => {
  await db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
