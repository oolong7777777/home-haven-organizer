export function validExpiry(value) {
  if (value === null) return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
export function expiryStatus(value, today = shanghaiDate()) {
  if (value == null) return { tone: 'permanent', badge: '永久', text: '永久有效' }
  if (!validExpiry(value)) return { tone: 'unknown', badge: '待确认', text: '期限信息需确认' }
  const days = Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  const date = value.replace(/-0?/g, '/')
  if (days < 0) return { tone: 'expired', badge: '已过期', text: `已于 ${date} 到期` }
  if (days === 0) return { tone: 'soon', badge: '今日到期', text: `有效期至 ${date}（今天）` }
  if (days <= 30) return { tone: 'soon', badge: `剩 ${days} 天`, text: `有效期至 ${date}` }
  return { tone: 'valid', badge: '有效', text: `有效期至 ${date}` }
}
