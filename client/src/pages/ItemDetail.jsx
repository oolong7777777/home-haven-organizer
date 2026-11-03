import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../api'
import ItemPhoto from '../components/ItemPhoto'
import { locationPaths } from '../../../shared/item-search.mjs'

export default function ItemDetail() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qr, setQr] = useState('')
  const [qrError, setQrError] = useState('')
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  function fill(item) { return { name: item.name, description: item.description || '', notes: item.notes || '', quantity: item.quantity, unit: item.unit || '个', category_id: item.category_id ? String(item.category_id) : '', location_id: item.location_id ? String(item.location_id) : '', photo_data: undefined } }
  function setField(key, value) { setForm(current => ({ ...current, [key]: value })); setDirty(true); setMessage('') }
  const link = `${window.location.origin}/items/${encodeURIComponent(id)}`
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setRecord(null); setQr(''); setQrError('')
    api.items.details(id).then(data => { if (active) { setRecord(data); setForm(fill(data.item)); setDirty(false) } }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])
  useEffect(() => {
    if (!record) return
    let active = true
    QRCode.toDataURL(link, { errorCorrectionLevel: 'M', width: 600, margin: 4, color: { dark: '#000000', light: '#ffffff' } }).then(value => { if (active) setQr(value) }).catch(() => { if (active) setQrError('二维码生成失败，请刷新后重试') })
    return () => { active = false }
  }, [record?.item.id, link])
  async function save(e) {
    e.preventDefault()
    if (busy || photoBusy) return
    const quantity = Number(form.quantity)
    if (!Number.isSafeInteger(quantity) || quantity < 0) { setError('数量必须是非负整数'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const item = await api.items.update(record.item.id, { ...form, quantity, name: form.name.trim(), location_id: form.location_id ? Number(form.location_id) : null, category_id: form.category_id ? Number(form.category_id) : null }, record.room.id)
      setRecord(current => ({ ...current, item })); setForm(fill(item)); setDirty(false); setMessage('已保存')
    } catch (err) { setError(err.message || '保存失败，请重试') } finally { setBusy(false) }
  }
  function reset() { setForm(fill(record.item)); setDirty(false); setError(''); setMessage('已恢复为保存前的内容') }
  async function download() {
    setBusy(true); setError('')
    try {
      const image = new Image(); image.src = qr; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 780
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
      const anchor = document.createElement('a'); anchor.href = canvas.toDataURL('image/png'); anchor.download = `物品标签-${record.item.id}.png`; anchor.click()
    } catch (err) { setError(err.message || '下载失败，请重试') } finally { setBusy(false) }
  }
  if (loading) return <div className="haven-page haven-state" role="status">正在读取物品…</div>
  if (!record) return <div className="haven-page haven-state"><p role="alert">{error || '物品不存在或你无权查看'}</p><p className="haven-small-note">请确认登录了正确账号，并已加入物品所属房间。物品删除后，原二维码将失效。</p><Link to="/account" className="haven-button">管理我的房间</Link><Link to="/items" className="haven-text-link">返回物品列表</Link></div>
  const { item, room, locations, categories = [] } = record
  const paths = locationPaths(locations)
  return <div className="haven-page haven-item-detail">
    <header className="haven-page-heading haven-detail-header"><div><p className="haven-eyebrow">{room.name} · 物品 #{item.id}</p><h1>{item.name}</h1><p className="haven-subtitle">直接编辑物品信息，二维码始终对应同一件物品。</p></div><Link to="/items" className="haven-button" onClick={e => { if ((dirty && !window.confirm('有尚未保存的修改，确认返回？')) || busy || photoBusy) e.preventDefault() }}>返回物品列表</Link></header>
    {error && <p className="haven-form-error" role="alert">{error}</p>}
    {message && <p role="status" className="haven-form-success">{message}</p>}
    <div className="haven-detail-grid">
      <section className="haven-panel haven-detail-record">
        <form className="haven-detail-editor haven-account-form" onSubmit={save}>
          <div className="haven-editor-heading"><h2>物品信息</h2><span>{dirty ? '有未保存的修改' : '已同步'}</span></div>
          <ItemPhoto value={form.photo_data} existingUrl={item.photo_url} onChange={value => setField('photo_data', value)} onBusy={setPhotoBusy} disabled={busy} />
          <label>物品名称<input required maxLength={120} value={form.name} disabled={busy} onChange={e => setField('name', e.target.value)} /></label>
          <div className="haven-editor-row"><label>数量<input type="number" min="0" step="1" max={Number.MAX_SAFE_INTEGER} required value={form.quantity} disabled={busy} onChange={e => setField('quantity', e.target.value)} /></label><label>单位<input maxLength={20} value={form.unit} disabled={busy} onChange={e => setField('unit', e.target.value)} /></label></div>
          <label>存放位置<select value={form.location_id} disabled={busy} onChange={e => setField('location_id', e.target.value)}><option value="">未指定位置</option>{locations.map(location => <option key={location.id} value={String(location.id)}>{paths.get(String(location.id))}</option>)}</select></label>
          <label>分类<select value={form.category_id} disabled={busy} onChange={e => setField('category_id', e.target.value)}><option value="">未分类</option>{categories.map(category => <option key={category.id} value={String(category.id)}>{category.icon} {category.name}</option>)}</select></label>
          <label>描述<textarea rows={3} maxLength={5000} value={form.description} disabled={busy} onChange={e => setField('description', e.target.value)} /></label>
          <label>备注<textarea rows={3} maxLength={5000} value={form.notes} disabled={busy} onChange={e => setField('notes', e.target.value)} /></label>
          <div className="haven-editor-actions"><button type="button" className="haven-button" disabled={!dirty || busy || photoBusy} onClick={reset}>撤销修改</button><button className="haven-button haven-button-primary" disabled={!dirty || !form.name.trim() || busy || photoBusy}>{busy ? '保存中…' : '保存修改'}</button></div>
        </form>
      </section>
      <aside className="haven-panel haven-qr-panel">
        <div className="haven-qr-heading"><h2>物品二维码标签</h2><p>可使用普通纸打印，裁剪后粘贴。</p></div>
        <div className="haven-qr-label">{qr ? <img src={qr} alt={`物品 ${item.name} 的二维码`} /> : <p role="status">{qrError || '正在生成二维码…'}</p>}<strong>{item.name}</strong></div>
        <div className="haven-qr-actions"><button className="haven-button haven-button-primary" disabled={!qr || busy || photoBusy || dirty} onClick={() => window.print()}>打印标签</button><button className="haven-button" disabled={!qr || busy || photoBusy || dirty} onClick={download}>下载标签 PNG</button><button className="haven-button" onClick={async () => { try { await navigator.clipboard.writeText(link) } catch { setError('复制失败，请复制下方物品链接') } }}>复制物品链接</button></div>
        {dirty && <p className="haven-qr-note">修改后请先保存，再打印或下载最新名称的标签。</p>}
        <p className="haven-qr-note">手机使用系统相机或扫码工具识别后，在浏览器打开链接。未登录会先进入登录页；二维码不会绕过房间权限。</p><input className="haven-qr-link" aria-label="物品链接" readOnly value={link} onFocus={e => e.target.select()} />
      </aside>
    </div>
  </div>
}
