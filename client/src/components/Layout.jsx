import { useEffect, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', emoji: '📊', label: '概览' },
  { to: '/items', emoji: '📦', label: '物品' },
  { to: '/locations', emoji: '📍', label: '位置' },
  { to: '/categories', emoji: '🏷️', label: '分类' },
]

export default function Layout() {
  const [storage, setStorage] = useState(null)
  useEffect(() => {
    fetch('/api/storage').then(response => {
      if (!response.ok) throw new Error('storage status unavailable')
      return response.json()
    }).then(setStorage).catch(() => setStorage({ unknown: true }))
  }, [])
  return (
    <div className="flex flex-col md:flex-row h-dvh bg-gray-50 overflow-hidden">
      <aside className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-3 md:py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg leading-none">
              🏠
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">家物管家</div>
              <div className="text-xs text-gray-400">Home Haven</div>
            </div>
          </div>
        </div>

        <nav aria-label="主导航" className="flex md:block md:flex-1 p-2 md:p-3 gap-1 md:space-y-0.5">
          {navItems.map(({ to, emoji, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 md:flex-none items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base leading-none">{emoji}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center">家物管家 v1.0</p>
        </div>
      </aside>

      <main className="flex-1 min-h-0 min-w-0 overflow-auto">
        <div className="px-4 sm:px-8 py-3 border-b bg-white text-sm flex flex-wrap items-center gap-3">
          <span className={storage?.temporary || storage?.unknown ? 'text-amber-800' : 'text-gray-600'}>
            {!storage ? '正在检查存储状态…' : storage.unknown ? '无法确认数据保存状态，请稍后刷新。' : storage.temporary ? '免费试用：尚未连接云数据库，重启或重新部署可能清空记录，请先导出。' : storage.cloud ? '云数据库已连接，支持跨设备使用。' : '数据保存在当前服务器的 SQLite 文件中。'}
          </span>
          <a href="/api/backup" className="text-indigo-600 underline whitespace-nowrap">导出数据</a>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
