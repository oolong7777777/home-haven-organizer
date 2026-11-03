const { matchesItem, locationPaths } = require('../shared/item-search.mjs');
const { randomUUID } = require('node:crypto');
const { problem } = require('./accounts');
function createRoomData(db) {
  async function own(table, id, home) {
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`).get(id, home);
    if (!row) throw problem(404, '记录不存在或不属于当前房间');
    return row;
  }
  function name(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 120) throw problem(400, '名称不能为空，且不能超过 120 个字符');
    return value.trim();
  }
  async function locationParent(id, parent, home) {
    let next = parent;
    const visited = new Set([String(id)]);
    while (next) {
      if (visited.has(String(next))) throw problem(400, '位置不能放在自己或自己的子位置内');
      visited.add(String(next));
      const row = await own('locations', next, home);
      next = row.parent_id;
    }
  }
  async function categorySave(home, data, id) {
    const values = [name(data.name), /^#[a-fA-F0-9]{6}$/.test(data.color || '') ? data.color : '#6366f1', typeof data.icon === 'string' ? data.icon.slice(0, 24) : '📦'];
    if (id) {
      await own('categories', id, home);
      await db.prepare('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND household_id = ?').run(...values, id, home);
    } else {
      const result = await db.prepare('INSERT INTO categories (name, color, icon, household_id) VALUES (?, ?, ?, ?)').run(...values, home);
      id = result.lastInsertRowid;
    }
    return { ...await own('categories', id, home), item_count: (await db.prepare('SELECT COUNT(*) AS count FROM items WHERE category_id = ? AND household_id = ?').get(id, home)).count };
  }
  const itemJoin = `SELECT i.id, i.name, i.description, i.quantity, i.unit, i.location_id, i.category_id, i.notes, i.created_at, i.updated_at, i.household_id, i.sort_order, CASE WHEN i.photo_data IS NOT NULL THEN '/api/items/' || i.id || '/photo?v=' || i.photo_version ELSE NULL END AS photo_url, c.name AS category_name, c.color AS category_color, c.icon AS category_icon, l.name AS location_name FROM items i LEFT JOIN categories c ON c.id = i.category_id AND c.household_id = i.household_id LEFT JOIN locations l ON l.id = i.location_id AND l.household_id = i.household_id`;
  async function itemSave(home, data, id) {
    if (id) await own('items', id, home);
    const hasPhoto = Object.prototype.hasOwnProperty.call(data, 'photo_data');
    if (hasPhoto && data.photo_data !== null) {
      if (typeof data.photo_data !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.photo_data) || data.photo_data.length > 350000) throw problem(400, '照片格式无效，请重新选择照片');
      const bytes = Buffer.from(data.photo_data.split(',')[1], 'base64');
      if (bytes.length > 250 * 1024 || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw problem(400, '照片需为不超过 250KB 的 JPEG 图片');
    }
    const quantity = data.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw problem(400, '数量必须是非负整数');
    if (data.category_id) await own('categories', data.category_id, home);
    if (data.location_id) await own('locations', data.location_id, home);
    const values = [name(data.name), typeof data.description === 'string' ? data.description.slice(0, 5000) : null, quantity, typeof data.unit === 'string' ? data.unit.slice(0, 20) : '个', data.location_id || null, data.category_id || null, typeof data.notes === 'string' ? data.notes.slice(0, 5000) : null];
    if (id) await db.prepare('UPDATE items SET name = ?, description = ?, quantity = ?, unit = ?, location_id = ?, category_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP, photo_data = CASE WHEN ? THEN ? ELSE photo_data END, photo_version = CASE WHEN ? THEN ? ELSE photo_version END WHERE id = ? AND household_id = ?').run(...values, hasPhoto ? 1 : 0, data.photo_data ?? null, hasPhoto ? 1 : 0, randomUUID(), id, home);
    else id = (await db.prepare('INSERT INTO items (name, description, quantity, unit, location_id, category_id, notes, household_id, photo_data, photo_version, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MIN(sort_order), 0) - 1024 FROM items WHERE household_id = ?))').run(...values, home, data.photo_data ?? null, randomUUID(), home)).lastInsertRowid;
    return db.prepare(itemJoin + ' WHERE i.id = ? AND i.household_id = ?').get(id, home);
  }
  async function locationSave(home, data, id) {
    if (id) await own('locations', id, home);
    await locationParent(id, data.parent_id, home);
    const type = ['room', 'cabinet', 'drawer', 'box', 'shelf', 'other'].includes(data.type) ? data.type : 'room';
    const values = [name(data.name), data.parent_id || null, type, typeof data.description === 'string' ? data.description.slice(0, 2000) : null];
    if (id) await db.prepare('UPDATE locations SET name = ?, parent_id = ?, type = ?, description = ? WHERE id = ? AND household_id = ?').run(...values, id, home);
    else id = (await db.prepare('INSERT INTO locations (name, parent_id, type, description, household_id) VALUES (?, ?, ?, ?, ?)').run(...values, home)).lastInsertRowid;
    return own('locations', id, home);
  }
  async function remove(table, id, home) {
    await own(table, id, home);
    await db.prepare(`DELETE FROM ${table} WHERE id = ? AND household_id = ?`).run(id, home);
    return { success: true };
  }
  const categories = home => db.prepare(`SELECT c.*, COUNT(i.id) AS item_count FROM categories c LEFT JOIN items i ON i.category_id = c.id AND i.household_id = c.household_id WHERE c.household_id = ? GROUP BY c.id ORDER BY c.name`).all(home);
  const locations = home => db.prepare(`SELECT l.*, COUNT(i.id) AS item_count FROM locations l LEFT JOIN items i ON i.location_id = l.id AND i.household_id = l.household_id WHERE l.household_id = ? GROUP BY l.id ORDER BY l.name`).all(home);
  async function items(home, filters = {}) {
    const conditions = ['i.household_id = ?']; const args = [home];
    for (const key of ['category_id', 'location_id']) if (filters[key]) { conditions.push(`i.${key} = ?`); args.push(filters[key]); }

    const rows = await db.prepare(itemJoin + ' WHERE ' + conditions.join(' AND ') + (filters.sort === 'recent' ? ' ORDER BY i.created_at DESC, i.id DESC' : ' ORDER BY COALESCE(i.sort_order, -i.id), i.id DESC')).all(...args);
    if (!filters.q) return rows;
    const paths = locationPaths(await locations(home));
    return rows.filter(item => matchesItem(item, filters.q, paths.get(String(item.location_id))));
  }
  async function changeQuantity(home, id, delta) {
    if (delta !== 1 && delta !== -1) throw problem(400, '数量调整必须为加一或减一');
    await own('items', id, home);
    const changed = await db.prepare('UPDATE items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ? AND quantity + ? BETWEEN 0 AND 9007199254740991 RETURNING id').get(delta, id, home, delta);
    if (!changed) throw problem(400, '数量不能小于 0 或超出支持范围');
    return db.prepare(itemJoin + ' WHERE i.id = ? AND i.household_id = ?').get(id, home);
  }
  async function moveItem(home, id, placement) {
    const methods = [placement.edge != null, placement.before_id != null, placement.after_id != null].filter(Boolean).length;
    if (methods !== 1 || (placement.edge != null && !['first', 'last'].includes(placement.edge))) throw problem(400, '请选择有效的移动位置');
    const moving = await own('items', id, home);
    const rows = await db.prepare('SELECT id FROM items WHERE household_id = ? ORDER BY COALESCE(sort_order, -id), id DESC').all(home);
    const ids = rows.map(row => row.id).filter(value => value !== moving.id);
    let index;
    if (placement.edge === 'first') index = 0;
    else if (placement.edge === 'last') index = ids.length;
    else {
      const targetId = placement.before_id ?? placement.after_id;
      if (!Number.isSafeInteger(Number(targetId)) || Number(targetId) <= 0) throw problem(400, '目标物品无效');
      const target = await own('items', targetId, home);
      if (target.id === moving.id) throw problem(400, '不能将物品移动到自身');
      const targetIndex = ids.indexOf(target.id);
      if (targetIndex < 0) throw problem(409, '列表已变化，请刷新后重试');
      index = targetIndex + (placement.before_id != null ? 0 : 1);
    }
    ids.splice(index, 0, moving.id);
    await db.batch(ids.map((value, position) => ({ sql: 'UPDATE items SET sort_order = ? WHERE id = ? AND household_id = ?', args: [position * 1024, value, home] })));
    return items(home);
  }
  async function stats(home) {
    const result = {};
    for (const table of ['items', 'categories', 'locations']) result[table] = (await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE household_id = ?`).get(home)).count;
    result.today = (await db.prepare("SELECT COUNT(*) AS count FROM items WHERE household_id = ? AND date(created_at, '+8 hours') = date('now', '+8 hours')").get(home)).count;
    return result;
  }
  async function backup(home) {
    const result = { version: 2, exported_at: new Date().toISOString(), room: await db.prepare('SELECT id, name FROM households WHERE id = ?').get(home) };
    for (const table of ['categories', 'locations', 'items']) result[table] = await db.prepare(`SELECT * FROM ${table} WHERE household_id = ?`).all(home);
    return result;
  }
  async function itemDetails(userId, id) {
    const room = await db.prepare('SELECT h.id, h.name, m.role FROM items i JOIN households h ON h.id = i.household_id JOIN memberships m ON m.household_id = h.id WHERE i.id = ? AND m.user_id = ?').get(id, userId);
    if (!room) throw problem(404, '物品不存在或你无权访问所属房间');
    const item = await db.prepare(itemJoin + ' WHERE i.id = ? AND i.household_id = ?').get(id, room.id);
    const locations = await db.prepare('SELECT id, name, parent_id FROM locations WHERE household_id = ?').all(room.id);
    const categories = await db.prepare('SELECT id, name, color, icon FROM categories WHERE household_id = ? ORDER BY name').all(room.id);
    return { item, room, locations, categories };
  }
  async function photo(userId, id) {
    const row = await db.prepare('SELECT i.photo_data FROM items i JOIN memberships m ON m.household_id = i.household_id WHERE i.id = ? AND m.user_id = ? AND i.photo_data IS NOT NULL').get(id, userId);
    if (!row) throw problem(404, '照片不存在或无权访问');
    return Buffer.from(row.photo_data.split(',')[1], 'base64');
  }
  return { itemDetails, changeQuantity, moveItem, photo, categories, locations, items, categorySave, itemSave, locationSave, remove, stats, backup };
}
module.exports = { createRoomData };
