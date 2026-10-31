import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState({ items: 0, categories: 0, locations: 0, today: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.stats(), api.items.list()])
      .then(([s, items]) => { setStats(s); setRecent(items.slice(0, 6)); setLoading(false) })
      .catch(err => { setError(err.message || '加载失败，请重试'); setLoading(false) })
  }, [])

  const cards = [
    { label: '物品总数', value: stats.items, emoji: '📦', tone: 'blue', to: '/items' },
    { label: '收纳分类', value: stats.categories, emoji: '🏷️', tone: 'purple', to: '/categories' },
    { label: '存放位置', value: stats.locations, emoji: '📍', tone: 'green', to: '/locations' },
    { label: '今日新增', value: stats.today, emoji: '✨', tone: 'amber', to: '/items' },
  ]

  if (loading) return <div className="haven-page haven-state" role="status">正在整理你的收纳概览…</div>
  if (error) return <div role="alert" className="haven-page haven-state"><p>{error}</p><button className="haven-button" onClick={() => window.location.reload()}>重新加载</button></div>

  return (
    <div className="haven-page haven-dashboard">
      <header className="haven-page-heading">
        <div><p className="haven-eyebrow">我的家 · 一目了然</p><h1>收纳概览</h1><p className="haven-subtitle">让物品有归处，让生活更有序。</p></div>
        <Link to="/items?add=1" className="haven-button haven-button-primary">＋ 添加物品</Link>
      </header>

      <section className="haven-stat-grid" aria-label="收纳统计">
        {cards.map(card => (
          <Link key={card.label} to={card.to} className={`haven-stat haven-tone-${card.tone}`}>
            <span className="haven-stat-icon" aria-hidden="true">{card.emoji}</span>
            <span className="haven-stat-label">{card.label}</span>
            <strong className="haven-stat-value">{card.value.toLocaleString()}</strong>
          </Link>
        ))}
      </section>

      <div className="haven-overview-grid">
        <section className="haven-panel haven-recent">
          <header className="haven-panel-heading"><div><h2>最近添加</h2><p>常用物品，随时找到</p></div><Link to="/items" className="haven-text-link">查看全部 →</Link></header>
          {recent.length === 0 ? (
            <div className="haven-empty"><span aria-hidden="true">📦</span><h3>从第一件物品开始</h3><p>记下它的名字和位置，下次寻找就更轻松。</p><Link to="/items?add=1" className="haven-button haven-button-primary">添加第一件物品</Link></div>
          ) : (
            <div className="haven-recent-list">
              {recent.map(item => (
                <Link to="/items" key={item.id} className="haven-recent-row">
                  <span className="haven-item-icon" style={{ backgroundColor: (item.category_color || '#6366f1') + '18' }} aria-hidden="true">{item.category_icon || '📦'}</span>
                  <div className="haven-item-copy"><h3 title={item.name}>{item.name}</h3><div className="haven-item-meta"><span>{item.category_name || '未分类'}</span><span aria-hidden="true">·</span><span>{item.location_name || '未指定位置'}</span></div></div>
                  <span className="haven-item-quantity">{item.quantity} <small>{item.unit}</small></span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="haven-panel haven-quick">
          <header className="haven-panel-heading"><div><h2>快速整理</h2><p>为家里的物品安排一个位置</p></div></header>
          <div className="haven-quick-list">
            <Link to="/items?add=1" className="haven-quick-link"><span className="haven-quick-icon" aria-hidden="true">📦</span><div><strong>记录新物品</strong><small>名称、数量与存放位置</small></div><span aria-hidden="true">↗</span></Link>
            <Link to="/locations" className="haven-quick-link"><span className="haven-quick-icon" aria-hidden="true">📍</span><div><strong>管理收纳位置</strong><small>房间、柜子、收纳盒</small></div><span aria-hidden="true">↗</span></Link>
            <Link to="/categories" className="haven-quick-link"><span className="haven-quick-icon" aria-hidden="true">🏷️</span><div><strong>整理物品分类</strong><small>按生活习惯分门别类</small></div><span aria-hidden="true">↗</span></Link>
          </div>
          <p className="haven-quick-tip">小建议：位置可以细化到“客厅 → 电视柜 → 第一层”，找东西会更轻松。</p>
        </section>
      </div>
    </div>
  )
}
