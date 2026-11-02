async function request(path, options = {}) {
  const { body, ...rest } = options
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(sessionStorage.getItem('haven_room') ? { 'X-Room-Id': sessionStorage.getItem('haven_room') } : {}) },
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('haven-session-expired'))
    if (data.code === 'ROOM_UNAVAILABLE') window.dispatchEvent(new Event('haven-room-unavailable'))
    const error = new Error(data.error || `请求失败（${res.status}）`)
    error.status = res.status
    throw error
  }
  return res.json()
}

export const api = {
  auth: {
    me: () => request('/auth/me'),
    login: data => request('/auth/login', { method: 'POST', body: data }),
    register: data => request('/auth/register', { method: 'POST', body: data }),
    logout: () => request('/auth/logout', { method: 'POST', body: {} }),
    password: data => request('/auth/password', { method: 'POST', body: data }),
  },
  rooms: {
    update: (id, name) => request(`/rooms/${id}`, { method: 'PATCH', body: { name } }),
    delete: (id, confirm_name) => request(`/rooms/${id}`, { method: 'DELETE', body: { confirm_name } }),
    removeMember: (id, userId) => request(`/rooms/${id}/members/${userId}`, { method: 'DELETE' }),
    create: name => request('/rooms', { method: 'POST', body: { name } }),
    join: invite_code => request('/rooms/join', { method: 'POST', body: { invite_code } }),
    switch: room_id => request('/rooms/switch', { method: 'POST', body: { room_id } }),
    invite: id => request(`/rooms/${id}/invites`, { method: 'POST', body: {} }),
    members: id => request(`/rooms/${id}/members`),
  },
  async downloadBackup() {
    const response = await fetch('/api/backup', { credentials: 'same-origin', headers: { 'X-Room-Id': sessionStorage.getItem('haven_room') || '' } })
    if (!response.ok) throw new Error('导出失败，请确认登录状态后重试')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url; link.download = 'home-haven-backup.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  stats: () => request('/stats'),

  categories: {
    list: () => request('/categories'),
    create: (data) => request('/categories', { method: 'POST', body: data }),
    update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },

  locations: {
    list: () => request('/locations'),
    tree: () => request('/locations/tree'),
    create: (data) => request('/locations', { method: 'POST', body: data }),
    update: (id, data) => request(`/locations/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/locations/${id}`, { method: 'DELETE' }),
  },

  items: {
    quantity: (id, delta) => request(`/items/${id}/quantity`, { method: 'PATCH', body: { delta } }),
    move: (id, placement) => request(`/items/${id}/order`, { method: 'PATCH', body: placement }),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request(`/items${qs ? '?' + qs : ''}`)
    },
    create: (data) => request('/items', { method: 'POST', body: data }),
    update: (id, data) => request(`/items/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  },
}
