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
  const warning = storage?.temporary || storage?.unknown

  return (
    <div className="haven-shell">
      <aside className="haven-sidebar">
        <NavLink to="/dashboard" className="haven-brand" aria-label="家物管家首页">
          <span className="haven-brand-icon" aria-hidden="true">🏠</span>
          <span className="haven-brand-copy"><strong>家物管家</strong><small>Home Haven</small></span>
        </NavLink>
        <nav aria-label="主导航" className="haven-nav">
          {navItems.map(({ to, emoji, label }) => (
            <NavLink key={to} to={to} title={label} className={({ isActive }) => `haven-nav-link ${isActive ? 'is-active' : ''}`}>
              <span aria-hidden="true">{emoji}</span><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="haven-sidebar-note">给每件物品，一个位置。</div>
      </aside>
      <main id="main-content" className="haven-main">
        <div className={`haven-storage ${warning ? 'is-warning' : ''}`}>
          <span className="haven-storage-dot" aria-hidden="true" />
          <span className="haven-storage-message">
            {!storage ? '正在检查存储状态…' : storage.unknown ? '暂时无法确认数据保存状态，请刷新后重试。' : storage.temporary ? '试用存储 · 重启可能清空记录，请及时导出。' : storage.cloud ? '云端存储已连接' : '数据保存在当前服务器'}
          </span>
          <a href="/api/backup" className="haven-export">导出数据 ↗</a>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
