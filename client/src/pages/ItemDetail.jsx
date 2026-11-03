import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../api'
import { useAuth } from '../AuthContext'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { accept } = useAuth()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState('')
  const [busy, setBusy] = useState(false)
  const link = `${window.location.origin}/items/${encodeURIComponent(id)}`
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setRecord(null); setQr(''); setQrError('')
    api.items.details(id).then(data => { if (active) setRecord(data) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])
  useEffect(() => {
    if (!record) return
    let active = true
    QRCode.toDataURL(link, { errorCorrectionLevel: 'M', width: 600, margin: 4, color: { dark: '#000000', light: '#ffffff' } }).then(value => { if (active) setQr(value) }).catch(() => { if (active) setQrError('二维码生成失败，请刷新后重试') })
    return () => { active = false }
  }, [record?.item.id, link])
  async function quantity(delta) {
    setBusy(true); setError('')
    try { const item = await api.items.quantity(record.item.id, delta, record.room.id); setRecord(current => ({ ...current, item })) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function edit() {
    setBusy(true); setError('')
    try { accept(await api.rooms.switch(record.room.id)); navigate(`/items?edit=${record.item.id}`) }
    catch (err) { setError(err.message); setBusy(false) }
  }
  async function download() {
    setBusy(true); setError('')
    try {
      const image = new Image(); image.src = qr; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 820
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('当前浏览器无法生成标签图片，请使用打印功能')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 60, 20, 600, 600)
      ctx.fillStyle = '#111827'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'
      const lines = []; let line = ''
      for (const char of record.item.name) { if (ctx.measureText(line + char).width > 620) { lines.push(line); line = char } else line += char }
      if (line) lines.push(line)
      const shown = lines.slice(0, 3)
      if (lines.length > 3) shown[2] = shown[2].slice(0, -1) + '…'
      shown.forEach((value, index) => ctx.fillText(value, 360, 658 + index * 40))
      ctx.font = '22px sans-serif'; ctx.fillStyle = '#64748b'; ctx.fillText(`家物管家 · #${record.item.id}`, 360, 795)
      const anchor = document.createElement('a'); anchor.href = canvas.toDataURL('image/png'); anchor.download = `物品标签-${record.item.id}.png`; anchor.click()
    } catch (err) { setError(err.message || '下载失败，请重试') } finally { setBusy(false) }
  }
  if (loading) return <div className="haven-page haven-state" role="status">正在读取物品…</div>
  if (!record) return <div className="haven-page haven-state"><p role="alert">{error || '物品不存在或你无权查看'}</p><p className="haven-small-note">请确认登录了正确账号，并已加入物品所属房间。物品删除后，原二维码将失效。</p><Link to="/account" className="haven-button">管理我的房间</Link><Link to="/items" className="haven-text-link">返回物品列表</Link></div>
  const { item, room, locations } = record
  const path = [], seen = new Set(); let locationId = item.location_id
  while (locationId && !seen.has(locationId)) { seen.add(locationId); const location = locations.find(row => row.id === locationId); if (!location) break; path.unshift(location.name); locationId = location.parent_id }
  return <div className="haven-page haven-item-detail">
    <header className="haven-page-heading haven-detail-header"><div><p className="haven-eyebrow">{room.name} · 物品 #{item.id}</p><h1>{item.name}</h1><p className="haven-subtitle">扫码识别同一件物品，信息更新后无需重印二维码。</p></div><Link to="/items" className="haven-button">返回物品列表</Link></header>
    {error && <p className="haven-form-error" role="alert">{error}</p>}
    <div className="haven-detail-grid">
      <section className="haven-panel haven-detail-record">
        {item.photo_url ? <img className="haven-detail-photo" src={item.photo_url} alt={item.name} /> : <div className="haven-detail-placeholder" aria-hidden="true">{item.category_icon || '📦'}</div>}
        <div className="haven-detail-info"><h2>{item.name}</h2><dl><div><dt>所属房间</dt><dd>{room.name}</dd></div><div><dt>存放位置</dt><dd>{path.join(' › ') || '未指定位置'}</dd></div><div><dt>分类</dt><dd>{item.category_icon} {item.category_name || '未分类'}</dd></div>{item.description && <div><dt>描述</dt><dd>{item.description}</dd></div>}{item.notes && <div><dt>备注</dt><dd>{item.notes}</dd></div>}</dl>
          <div className="haven-product-quantity"><button aria-label="减少数量" disabled={busy || item.quantity <= 0} onClick={() => quantity(-1)}>−</button><output aria-live="polite">{item.quantity}<small>{item.unit}</small></output><button aria-label="增加数量" disabled={busy || item.quantity >= Number.MAX_SAFE_INTEGER} onClick={() => quantity(1)}>＋</button></div>
          <button className="haven-button haven-button-primary" disabled={busy} onClick={edit}>编辑物品 / 位置</button>
        </div>
      </section>
      <aside className="haven-panel haven-qr-panel">
        <div className="haven-qr-heading"><h2>物品二维码标签</h2><p>可使用普通纸打印，裁剪后粘贴。</p></div>
        <div className="haven-qr-label">{qr ? <img src={qr} alt={`物品 ${item.name} 的二维码`} /> : <p role="status">{qrError || '正在生成二维码…'}</p>}<strong>{item.name}</strong><small>家物管家 · #{item.id}</small></div>
        <div className="haven-qr-actions"><button className="haven-button haven-button-primary" disabled={!qr || busy} onClick={() => window.print()}>打印标签</button><button className="haven-button" disabled={!qr || busy} onClick={download}>下载标签 PNG</button><button className="haven-button" onClick={async () => { try { await navigator.clipboard.writeText(link) } catch { setError('复制失败，请复制下方物品链接') } }}>复制物品链接</button></div>
        <p className="haven-qr-note">手机使用系统相机或扫码工具识别后，在浏览器打开链接。未登录会先进入登录页；二维码不会绕过房间权限。</p><input className="haven-qr-link" aria-label="物品链接" readOnly value={link} onFocus={e => e.target.select()} />
      </aside>
    </div>
  </div>
}
