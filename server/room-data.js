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
  const itemJoin = `SELECT i.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon, l.name AS location_name FROM items i LEFT JOIN categories c ON c.id = i.category_id AND c.household_id = i.household_id LEFT JOIN locations l ON l.id = i.location_id AND l.household_id = i.household_id`;
  async function itemSave(home, data, id) {
    if (id) await own('items', id, home);
    const quantity = data.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw problem(400, '数量必须是非负整数');
    if (data.category_id) await own('categories', data.category_id, home);
    if (data.location_id) await own('locations', data.location_id, home);
    const values = [name(data.name), typeof data.description === 'string' ? data.description.slice(0, 5000) : null, quantity, typeof data.unit === 'string' ? data.unit.slice(0, 20) : '个', data.location_id || null, data.category_id || null, typeof data.notes === 'string' ? data.notes.slice(0, 5000) : null];
    if (id) await db.prepare('UPDATE items SET name = ?, description = ?, quantity = ?, unit = ?, location_id = ?, category_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?').run(...values, id, home);
    else id = (await db.prepare('INSERT INTO items (name, description, quantity, unit, location_id, category_id, notes, household_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(...values, home)).lastInsertRowid;
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
    if (filters.q) { conditions.push('(i.name LIKE ? OR i.description LIKE ? OR i.notes LIKE ?)'); args.push(...Array(3).fill(`%${String(filters.q).slice(0, 200)}%`)); }
    return db.prepare(itemJoin + ' WHERE ' + conditions.join(' AND ') + ' ORDER BY i.updated_at DESC, i.id DESC').all(...args);
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
  return { categories, locations, items, categorySave, itemSave, locationSave, remove, stats, backup };
}
module.exports = { createRoomData };
