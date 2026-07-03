async function request(path, options = {}) {
  const { body, ...rest } = options
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
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
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request(`/items${qs ? '?' + qs : ''}`)
    },
    create: (data) => request('/items', { method: 'POST', body: data }),
    update: (id, data) => request(`/items/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  },
}
