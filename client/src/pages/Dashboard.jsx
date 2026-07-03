import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState({ items: 0, categories: 0, locations: 0, today: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.stats(), api.items.list()])
      .then(([s, items]) => {
        setStats(s)
        setRecent(items.slice(0, 6))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const statCards = [
    { label: '物品总数', value: stats.items, emoji: '📦', bg: 'bg-blue-50', text: 'text-blue-600' },
    { label: '分类数量', value: stats.categories, emoji: '🏷️', bg: 'bg-purple-50', text: 'text-purple-600' },
    { label: '位置数量', value: stats.locations, emoji: '📍', bg: 'bg-green-50', text: 'text-green-600' },
    { label: '今日新增', value: stats.today, emoji: '✨', bg: 'bg-amber-50', text: 'text-amber-600' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">概览</h1>
        <p className="text-gray-500 mt-1">掌握您家的收纳状况</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, emoji, bg, text }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl mb-3 ${bg}`}>
              {emoji}
            </div>
            <div className={`text-3xl font-bold ${text}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">快速操作</p>
        <div className="flex gap-3 flex-wrap">
          <Link
            to="/items"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + 添加物品
          </Link>
          <Link
            to="/locations"
            className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            📍 管理位置
          </Link>
          <Link
            to="/categories"
            className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            🏷️ 管理分类
          </Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">最近添加的物品</p>
          <Link to="/items" className="text-xs text-indigo-600 hover:underline">查看全部 →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-200">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-400">还没有任何物品</p>
            <Link
              to="/items"
              className="inline-block mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              去添加第一件物品
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-xl px-5 py-3.5 flex items-center gap-4 border border-gray-100 shadow-sm"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: (item.category_color || '#6366f1') + '18' }}
                >
                  {item.category_icon || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate text-sm">{item.name}</div>
                  <div className="text-xs text-gray-400 flex gap-1.5 mt-0.5">
                    {item.category_name && <span>{item.category_name}</span>}
                    {item.category_name && item.location_name && <span>·</span>}
                    {item.location_name && <span>{item.location_name}</span>}
                    {!item.category_name && !item.location_name && <span>未分类</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-500 flex-shrink-0">
                  {item.quantity} {item.unit}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
