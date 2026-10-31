import { useState, useEffect } from 'react'
import { api } from '../api'
import Modal from '../components/Modal'

const TYPE_META = {
  home:    { icon: '🏠', label: '整栋/整层' },
  room:    { icon: '🚪', label: '房间' },
  cabinet: { icon: '🗄️', label: '柜子/衣柜' },
  shelf:   { icon: '📚', label: '层架' },
  drawer:  { icon: '🗃️', label: '抽屉' },
  box:     { icon: '📦', label: '收纳箱' },
  other:   { icon: '📍', label: '其他' },
}

const INIT = { name: '', type: 'room', parent_id: '', description: '' }

function LocationNode({ node, allNodes, onEdit, onDelete, onSelect, selectedId, depth = 0 }) {
  const [open, setOpen] = useState(true)
  const meta = TYPE_META[node.type] || TYPE_META.other
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer group transition-colors ${
          isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${12 + Math.min(depth, 5) * 16}px` }}
        onClick={() => onSelect(node)}
      >
        {node.children.length > 0 ? (
          <button
            onClick={e => { e.stopPropagation(); setOpen(!open) }}
            className="text-gray-400 hover:text-gray-600 w-4 text-xs leading-none"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className="text-base leading-none">{meta.icon}</span>
        <span className={`flex-1 text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
          {node.name}
        </span>
        {node.item_count > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{node.item_count}</span>
        )}
        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(node) }}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-500 text-xs"
          >✏️</button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(node) }}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 text-xs"
          >🗑️</button>
        </div>
      </div>

      {open && node.children.map(child => (
        <LocationNode
          key={child.id}
          node={child}
          allNodes={allNodes}
          onEdit={onEdit}
          onDelete={onDelete}
          onSelect={onSelect}
          selectedId={selectedId}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export default function Locations() {
  const [tree, setTree] = useState([])
  const [flatList, setFlatList] = useState([])
  const [selectedLoc, setSelectedLoc] = useState(null)
  const [locItems, setLocItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [editNode, setEditNode] = useState(null)
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadLocations() }, [])

  async function loadLocations() {
    setLoading(true)
    try {
      const [treeData, flat] = await Promise.all([api.locations.tree(), api.locations.list()])
      setTree(treeData)
      setFlatList(flat)
    } catch (err) {
      console.error('加载失败:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function selectLocation(node) {
    setSelectedLoc(node)
    setLoadingItems(true)
    const items = await api.items.list({ location_id: node.id })
    setLocItems(items)
    setLoadingItems(false)
  }

  function openAdd() {
    setForm(INIT)
    setEditNode(null)
    setModal(true)
  }

  function openEdit(node) {
    setForm({
      name: node.name,
      type: node.type,
      parent_id: node.parent_id ? String(node.parent_id) : '',
      description: node.description || '',
    })
    setEditNode(node)
    setModal(true)
  }

  async function handleDelete(node) {
    if (!confirm(`确定删除「${node.name}」吗？子位置也会失去父级关联。`)) return
    await api.locations.delete(node.id)
    if (selectedLoc?.id === node.id) setSelectedLoc(null)
    await loadLocations()
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data = {
        ...form,
        parent_id: form.parent_id ? parseInt(form.parent_id) : null,
      }
      if (editNode) {
        await api.locations.update(editNode.id, data)
      } else {
        await api.locations.create(data)
      }
      setModal(false)
      await loadLocations()
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
    <div className="haven-page haven-locations">
      {/* Left: tree panel */}
      <div className="haven-location-tree">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">位置层级</h2>
          <button
            onClick={openAdd}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + 添加
          </button>
        </div>

        <div className="haven-location-nodes p-2">
          {tree.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <div className="text-3xl mb-2">🏠</div>
              <p>还没有位置</p>
              <button onClick={openAdd} className="mt-3 text-indigo-600 hover:underline text-xs">
                添加第一个位置
              </button>
            </div>
          ) : (
            tree.map(node => (
              <LocationNode
                key={node.id}
                node={node}
                allNodes={flatList}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSelect={selectLocation}
                selectedId={selectedLoc?.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: items in selected location */}
      <div className="haven-location-detail">
        {!selectedLoc ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">👈</div>
            <p className="text-lg font-medium text-gray-500">选择一个位置</p>
            <p className="text-sm mt-1">查看该位置存放的物品</p>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{TYPE_META[selectedLoc.type]?.icon || '📍'}</span>
                <h1 className="text-2xl font-bold text-gray-900">{selectedLoc.name}</h1>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-400">{TYPE_META[selectedLoc.type]?.label}</span>
                {selectedLoc.description && (
                  <span className="text-sm text-gray-400">· {selectedLoc.description}</span>
                )}
              </div>
            </div>

            {loadingItems ? (
              <div className="text-gray-400 text-sm">加载物品中...</div>
            ) : locItems.length === 0 ? (
              <div className="bg-gray-50 rounded-2xl p-10 text-center border border-dashed border-gray-200">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-400">这里还没有物品</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-4">共 {locItems.length} 件物品</p>
                <div className="haven-card-grid">
                  {locItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ backgroundColor: (item.category_color || '#6366f1') + '18' }}
                        >
                          {item.category_icon || '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{item.quantity} {item.unit}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editNode ? '编辑位置' : '添加位置'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">位置名称 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setF('name', e.target.value)}
                placeholder="例如：主卧、书柜、抽屉..."
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">位置类型</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_META).map(([key, { icon, label }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setF('type', key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
                      form.type === key
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{icon}</span> {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">上级位置（可选）</label>
              <select
                value={form.parent_id}
                onChange={e => setF('parent_id', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
              >
                <option value="">无上级（顶层）</option>
                {flatList
                  .filter(l => !editNode || l.id !== editNode.id)
                  .map(l => (
                    <option key={l.id} value={String(l.id)}>
                      {TYPE_META[l.type]?.icon} {l.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setF('description', e.target.value)}
                placeholder="额外说明（可选）"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="flex gap-3 pt-2">
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
