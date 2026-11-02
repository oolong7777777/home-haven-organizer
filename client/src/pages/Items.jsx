import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import Modal from '../components/Modal'
import ItemPhoto from '../components/ItemPhoto'

const INIT = { name: '', description: '', quantity: 1, unit: '个', location_id: '', category_id: '', notes: '', photo_data: null }

export default function Items() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterLoc, setFilterLoc] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [modal, setModal] = useState(() => searchParams.get('add') === '1')
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    Promise.all([api.items.list(), api.categories.list(), api.locations.list()])
      .then(([i, c, l]) => { setItems(i); setCategories(c); setLocations(l); setLoading(false) })
      .catch(err => { console.error('加载失败:', err); setError(err.message); setLoading(false) })
  }, [])

  const filtered = items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) &&
        !(item.description || '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && String(item.category_id) !== filterCat) return false
    if (filterLoc && String(item.location_id) !== filterLoc) return false
    return true
  })

  function closeModal() {
    if (saving || photoBusy) return
    setModal(false)
    if (searchParams.has('add')) {
      const next = new URLSearchParams(searchParams)
      next.delete('add')
      setSearchParams(next, { replace: true })
    }
  }

  function openAdd() {
    setActionError('')
    setForm(INIT)
    setEditItem(null)
    setModal(true)
  }

  function openEdit(item) {
    setActionError('')
    setForm({
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unit: item.unit,
      location_id: item.location_id ? String(item.location_id) : '',
      category_id: item.category_id ? String(item.category_id) : '',
      notes: item.notes || '',
      photo_data: undefined,
    })
    setEditItem(item)
    setModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || photoBusy) return
    setActionError('')
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 0) {
      setActionError('数量必须是大于或等于 0 的整数')
      return
    }
    setSaving(true)
    try {
      const data = {
        ...form,
        quantity,
        location_id: form.location_id ? parseInt(form.location_id) : null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
      }
      if (editItem) {
        const updated = await api.items.update(editItem.id, data)
        setItems(items.map(i => i.id === editItem.id ? updated : i))
      } else {
        const created = await api.items.create(data)
        setItems([created, ...items])
      }
      setModal(false)
      if (searchParams.has('add')) { const next = new URLSearchParams(searchParams); next.delete('add'); setSearchParams(next, { replace: true }) }
    } catch (err) {
      setActionError(err.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`确定删除「${item.name}」吗？`)) return
    try {
      await api.items.delete(item.id)
      setItems(items.filter(i => i.id !== item.id))
      setActionError('')
    } catch (err) {
      setActionError(err.message || '删除失败，请重试')
    }
  }

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>
  if (error) return (
    <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2">
      <div className="text-4xl">⚠️</div>
      <p className="font-medium">加载失败</p>
      <p className="text-sm text-gray-400">{error}</p>
      <p className="text-xs text-gray-400 mt-2">请检查后端服务是否在 http://localhost:3001 运行</p>
    </div>
  )

  return (
    <div className="haven-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">物品管理</h1>
          <p className="text-gray-400 text-sm mt-0.5">共 {filtered.length} 件物品</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + 添加物品
        </button>
      </div>

      {actionError && !modal && <p role="alert" className="text-red-600 mb-4">{actionError}</p>}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="🔍 搜索物品名称..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-gray-700"
        >
          <option value="">全部分类</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
        </select>
        <select
          value={filterLoc}
          onChange={e => setFilterLoc(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-gray-700"
        >
          <option value="">全部位置</option>
          {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
        {(search || filterCat || filterLoc) && (
          <button
            onClick={() => { setSearch(''); setFilterCat(''); setFilterLoc('') }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors bg-white"
          >
            清除筛选
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg font-medium text-gray-500">
            {search || filterCat || filterLoc ? '没有匹配的物品' : '还没有物品'}
          </p>
          {!search && !filterCat && !filterLoc && (
            <button
              onClick={openAdd}
              className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              添加第一件物品
            </button>
          )}
        </div>
      ) : (
        <div className="haven-card-grid">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
              {item.photo_url && <img src={item.photo_url} alt={item.name} loading="lazy" className="haven-item-photo" />}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: (item.category_color || '#6366f1') + '18' }}
                >
                  {item.category_icon || '📦'}
                </div>
                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(item)}
                    title="编辑"
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    title="删除"
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 leading-tight">{item.name}</h3>

              {item.description && (
                <p className="text-xs text-gray-400 mb-2 line-clamp-2">{item.description}</p>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm font-semibold text-indigo-600">
                  {item.quantity} {item.unit}
                </span>
                {item.location_name && (
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg truncate ml-2 max-w-24">
                    📍 {item.location_name}
                  </span>
                )}
              </div>

              {item.category_name && (
                <div className="mt-2.5">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: (item.category_color || '#6366f1') + '18',
                      color: item.category_color || '#6366f1',
                    }}
                  >
                    {item.category_name}
                  </span>
                </div>
              )}

              {item.notes && (
                <p className="text-xs text-gray-400 mt-2 border-t border-gray-50 pt-2 italic truncate">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editItem ? '编辑物品' : '添加物品'} onClose={closeModal}>
          <div className="space-y-4">
            <ItemPhoto value={form.photo_data} existingUrl={editItem?.photo_url} onChange={value => setF('photo_data', value)} onBusy={setPhotoBusy} disabled={saving} />
            {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">物品名称 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setF('name', e.target.value)}
                placeholder="例如：蓝色背包、充电器..."
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
              <textarea
                value={form.description}
                onChange={e => setF('description', e.target.value)}
                placeholder="添加简短描述（可选）"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">数量</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={e => setF('quantity', e.target.value)}
                  min={0}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">单位</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={e => setF('unit', e.target.value)}
                  placeholder="个 / 件 / 瓶..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
              <select
                value={form.category_id}
                onChange={e => setF('category_id', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
              >
                <option value="">不选择分类</option>
                {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">存放位置</label>
              <select
                value={form.location_id}
                onChange={e => setF('location_id', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
              >
                <option value="">未指定位置</option>
                {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
              <textarea
                value={form.notes}
                onChange={e => setF('notes', e.target.value)}
                placeholder="额外备注（可选）"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving || photoBusy}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
