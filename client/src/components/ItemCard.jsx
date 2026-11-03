import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { Link } from 'react-router-dom'
import { expiryStatus } from '../../../shared/item-expiry.mjs'
import { CSS } from '@dnd-kit/utilities'

export default function ItemCard({ item, location, busy, onDelete, onMove, onQuantity }) {
  const expiry = expiryStatus(item.expires_on)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: busy })
  useEffect(() => {
    if (!menu) return
    const outside = e => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    const escape = e => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menu])
  function action(fn) { setMenu(false); fn() }
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`haven-product-card ${isDragging ? 'is-dragging' : ''}`} aria-busy={busy}>
    <div className="haven-product-media">
      {item.photo_url ? <img src={item.photo_url} alt={item.name} loading="lazy" draggable={false} /> : <div className="haven-product-no-photo" style={{ backgroundColor: (item.category_color || '#6366f1') + '10' }}><span aria-hidden="true">{item.category_icon || '📦'}</span><small>暂无照片</small></div>}
      <span className="haven-product-count">×{item.quantity}</span>
      <span className={`haven-expiry-badge is-${expiry.tone}`}>{expiry.badge}</span>
      <button type="button" className="haven-product-drag" {...attributes} {...listeners} aria-label={`拖动调整「${item.name}」的位置，也可按空格后使用方向键`} title="拖动排序" disabled={busy}>⠿</button>
      <div ref={menuRef} className="haven-product-tools">
        <button type="button" className="haven-product-menu-toggle" aria-label={`「${item.name}」更多操作`} aria-expanded={menu} disabled={busy} onClick={() => setMenu(!menu)}>⋮</button>
        {menu && <div className="haven-product-menu" aria-label="物品操作">
          <Link to={`/items/${item.id}`} onClick={() => setMenu(false)}>编辑物品 / 二维码</Link>
          <button type="button" onClick={() => action(() => onMove(item, { edge: 'first' }))}>移到最前</button>
          <button type="button" onClick={() => action(() => onMove(item, { edge: 'last' }))}>移到最后</button>
          <button type="button" className="haven-danger-text" onClick={() => action(() => onDelete(item))}>删除物品</button>
        </div>}
      </div>
    </div>
    <div className="haven-product-content">
      <h3 title={item.name}><Link to={`/items/${item.id}`}>{item.name}</Link></h3>
      <p className="haven-product-summary" title={[item.description, location].filter(Boolean).join(' · ')}>{[item.description, location || '未指定位置'].filter(Boolean).join(' · ')}</p>
      <p className={`haven-product-expiry is-${expiry.tone}`}>{expiry.text}</p>
      <div className="haven-product-meta"><span className="haven-product-category" style={{ color: item.category_color || '#64748b', backgroundColor: (item.category_color || '#64748b') + '12' }}>{item.category_icon || '🏷️'} {item.category_name || '未分类'}</span>{item.notes && <span className="haven-product-brief" title={item.notes}>{item.notes}</span>}</div>
      <div className="haven-product-quantity" aria-label={`${item.name}的数量`}>
        <button type="button" aria-label={`减少「${item.name}」的数量`} disabled={busy || item.quantity <= 0} onClick={() => onQuantity(item, -1)}>−</button>
        <output aria-live="polite">{item.quantity}<small>{item.unit}</small></output>
        <button type="button" aria-label={`增加「${item.name}」的数量`} disabled={busy || item.quantity >= Number.MAX_SAFE_INTEGER} onClick={() => onQuantity(item, 1)}>＋</button>
      </div>
    </div>
  </article>
}
