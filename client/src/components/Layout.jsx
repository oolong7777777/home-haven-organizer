import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', emoji: '📊', label: '概览' },
  { to: '/items', emoji: '📦', label: '物品' },
  { to: '/locations', emoji: '📍', label: '位置' },
  { to: '/categories', emoji: '🏷️', label: '分类' },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-100">
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

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, emoji, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
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

        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center">家物管家 v1.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
