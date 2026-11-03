const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, '')
export function locationPaths(locations = []) {
  const index = new Map(locations.map(row => [String(row.id), row]))
  const result = new Map()
  for (const row of locations) {
    const parts = [], seen = new Set(); let current = row
    while (current && !seen.has(String(current.id))) {
      seen.add(String(current.id)); parts.unshift(current.name); current = index.get(String(current.parent_id))
    }
    result.set(String(row.id), parts.join(' › '))
  }
  return result
}
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1
}
function matchesField(raw, token) {
  const field = normalize(raw)
  if (field.includes(token)) return true
  if (token.length >= 2) {
    // Allow nearby non-contiguous characters, e.g. 卧柜 → 卧室衣柜.
    for (let start = field.indexOf(token[0]); start >= 0; start = field.indexOf(token[0], start + 1)) {
      let pos = start + 1, index = 1
      while (index < token.length && pos - start <= token.length * 3) { if (field[pos] === token[index]) index++; pos++ }
      if (index === token.length) return true
    }
  }
  if (/^[a-z]{4,32}$/.test(token)) {
    return String(raw ?? '').normalize('NFKC').toLowerCase().split(/[^a-z]+/).some(word => word.length <= 33 && oneEdit(word, token))
  }
  return false
}
export function matchesItem(item, query, location = '') {
  const tokens = String(query ?? '').trim().slice(0, 200).split(/[\s,，;；]+/u).map(normalize).filter(Boolean)
  if (!tokens.length) return true
  const fields = [item.name, location || item.location_name, item.category_name, item.description, item.notes]
  return tokens.every(token => fields.some(field => matchesField(field, token)))
}
