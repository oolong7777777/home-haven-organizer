import { useState, useEffect } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#6366f1', '#a855f7',
  '#ec4899', '#6b7280',
]

const PRESET_ICONS = [
  '📦', '🍎', '🥦', '🧃', '🍕', '🧁',
  '👕', '👟', '👗', '🎒', '🧦', '🧥',
  '💻', '📱', '🖥️', '📷', '🔌', '🎮',
  '📚', '📝', '✏️', '🗂️', '📋', '🔖',
  '🧴', '💊', '🪥', '🧹', '🧺', '🪣',
  '🔧', '🔑', '💡', '🪴', '🛋️', '🎁',
]

const INIT = { name: '', color: '#6366f1', icon: '📦' }

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [editCat, setEditCat] = useState(null)
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    setLoading(true)
    try {
      setCategories(await api.categories.list())
    } catch (err) {
      console.error('加载失败:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setForm(INIT)
    setEditCat(null)
    setModal(true)
  }

  function openEdit(cat) {
    setForm({ name: cat.name, color: cat.color, icon: cat.icon })
    setEditCat(cat)
    setModal(true)
  }

  async function handleDelete(cat) {
    if (!confirm(`确定删除分类「${cat.name}」吗？该分类下的物品不会被删除，但会失去分类。`)) return
    await api.categories.delete(cat.id)
    setCategories(categories.filter(c => c.id !== cat.id))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editCat) {
        await api.categories.update(editCat.id, form)
        setCategories(categories.map(c => c.id === editCat.id ? { ...c, ...form } : c))
      } else {
        const created = await api.categories.create(form)
        setCategories([...categories, created])
      }
      setModal(false)
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold text-gray-900">分类管理</h1>
          <p className="text-gray-400 text-sm mt-0.5">共 {categories.length} 个分类</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + 添加分类
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">🏷️</div>
          <p className="text-lg font-medium text-gray-500">还没有分类</p>
          <button
            onClick={openAdd}
            className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            添加第一个分类
          </button>
        </div>
      ) : (
        <div className="haven-category-grid">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative"
            >
              <div
                className="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
              >
                <button
                  onClick={() => openEdit(cat)}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-500 bg-white rounded-lg shadow-sm text-xs"
                >✏️</button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 bg-white rounded-lg shadow-sm text-xs"
                >🗑️</button>
              </div>

              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: cat.color + '20' }}
              >
                {cat.icon}
              </div>

              <div className="font-semibold text-gray-900 text-sm truncate">{cat.name}</div>

              <div className="mt-1 flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs text-gray-400">{cat.item_count} 件物品</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editCat ? '编辑分类' : '添加分类'} onClose={() => setModal(false)}>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">分类名称 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setF('name', e.target.value)}
                placeholder="例如：食品、衣物、电器..."
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择图标</label>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 max-h-36 overflow-y-auto">
                {PRESET_ICONS.map(ico => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setF('icon', ico)}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-xl transition-colors ${
                      form.icon === ico ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-gray-100'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择颜色</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setF('color', color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      form.color === color ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: form.color + '20' }}
              >
                {form.icon}
              </div>
              <div>
                <div className="font-medium text-gray-800 text-sm">{form.name || '分类名称'}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: form.color }} />
                  <span className="text-xs text-gray-400">预览效果</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
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
