import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Modal from '../components/Modal'
import ItemPhoto from '../components/ItemPhoto'
import ItemCard from '../components/ItemCard'
import { matchesItem, locationPaths } from '../../../shared/item-search.mjs'
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'

const INIT = { name: '', description: '', quantity: 1, unit: '个', location_id: '', category_id: '', notes: '', photo_data: null }

export default function Items() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterLoc, setFilterLoc] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [modal, setModal] = useState(() => searchParams.get('add') === '1')
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [cardBusy, setCardBusy] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    Promise.all([api.items.list(), api.categories.list(), api.locations.list()])
      .then(([i, c, l]) => { setItems(i); setCategories(c); setLocations(l); setLoading(false) })
      .catch(err => { console.error('加载失败:', err); setError(err.message); setLoading(false) })
  }, [])

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId) navigate(`/items/${encodeURIComponent(editId)}`, { replace: true })
  }, [searchParams.get('edit'), navigate])

  const paths = useMemo(() => locationPaths(locations), [locations])
  const filtered = items.filter(item => {
    if (!matchesItem(item, search, paths.get(String(item.location_id)))) return false
    if (filterCat && String(item.category_id) !== filterCat) return false
    if (filterLoc && String(item.location_id) !== filterLoc) return false
    return true
  })

  function closeModal() {
    if (saving || photoBusy) return
    setModal(false)
    if (searchParams.has('add') || searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams)
      next.delete('add'); next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

  function openAdd() {
    if (cardBusy) return
    setActionError('')
    setForm(INIT)
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
      const created = await api.items.create(data)
      setItems([created, ...items])
      setModal(false)
      if (searchParams.has('add') || searchParams.has('edit')) { const next = new URLSearchParams(searchParams); next.delete('add'); next.delete('edit'); setSearchParams(next, { replace: true }) }
    } catch (err) {
      setActionError(err.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (cardBusy) return
    if (!confirm(`确定删除「${item.name}」吗？`)) return
    setCardBusy(true)
    try {
      await api.items.delete(item.id)
      setItems(items.filter(i => i.id !== item.id))
      setActionError('')
    } catch (err) {
      setActionError(err.message || '删除失败，请重试')
    } finally { setCardBusy(false) }
  }

  function locationPath(item) {
    const parts = [], seen = new Set()
    let id = item.location_id
    while (id && !seen.has(id)) {
      seen.add(id)
      const location = locations.find(row => row.id === id)
      if (!location) break
      parts.unshift(location.name); id = location.parent_id
    }
    return parts.join(' › ')
  }
  async function changeQuantity(item, delta) {
    if (cardBusy) return
    setCardBusy(true); setActionError('')
    try {
      const updated = await api.items.quantity(item.id, delta)
      setItems(rows => rows.map(row => row.id === updated.id ? updated : row))
    } catch (err) { setActionError(err.message || '数量更新失败，请重试') }
    finally { setCardBusy(false) }
  }
  async function moveItem(item, placement) {
    if (cardBusy) return
    const previous = items
    const next = items.filter(row => row.id !== item.id)
    let index = placement.edge === 'first' ? 0 : next.length
    if (placement.before_id != null) index = next.findIndex(row => row.id === placement.before_id)
    if (placement.after_id != null) index = next.findIndex(row => row.id === placement.after_id) + 1
    next.splice(Math.max(0, index), 0, item)
    setItems(next); setCardBusy(true); setActionError('')
    try { setItems(await api.items.move(item.id, placement)) }
    catch (err) { setItems(previous); setActionError(err.message || '顺序保存失败，请重试') }
    finally { setCardBusy(false) }
  }
  function dragEnd({ active, over }) {
    if (!over || active.id === over.id || cardBusy) return
    const from = filtered.findIndex(row => row.id === active.id), to = filtered.findIndex(row => row.id === over.id)
    if (from < 0 || to < 0) return
    const reordered = arrayMove(filtered, from, to)
    const next = reordered[to + 1], prev = reordered[to - 1]
    moveItem(reordered[to], next ? { before_id: next.id } : { after_id: prev.id })
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
          disabled={cardBusy}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + 添加物品
        </button>
      </div>

      {actionError && !modal && <p role="alert" className="text-red-600 mb-4">{actionError}</p>}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="搜索名称、位置、分类、描述或备注…"
          aria-label="智能模糊搜索物品"
          maxLength={200}
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

      <p className="haven-search-help">可用空格组合关键词，例如“客厅 纸巾”；支持位置层级、不连续文字和少量英文拼写容错。</p>
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
        <>
          <p className="haven-card-order-tip">拖动照片右上角的 ⠿ 调整顺序（手机／平板长按后拖动）；也可在 ⋮ 中移到最前或最后。顺序由当前房间成员共享。</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd} accessibility={{ screenReaderInstructions: { draggable: '按空格开始排序，使用方向键移动，再按空格确认，按 Escape 取消。' } }}>
            <SortableContext items={filtered.map(item => item.id)} strategy={rectSortingStrategy}>
              <div className="haven-product-grid">
                {filtered.map(item => <ItemCard key={item.id} item={item} location={locationPath(item)} busy={cardBusy} onDelete={handleDelete} onMove={moveItem} onQuantity={changeQuantity} />)}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {modal && (
        <Modal title="添加物品" onClose={closeModal}>
          <div className="space-y-4">
            <ItemPhoto value={form.photo_data} onChange={value => setF('photo_data', value)} onBusy={setPhotoBusy} disabled={saving} />
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
