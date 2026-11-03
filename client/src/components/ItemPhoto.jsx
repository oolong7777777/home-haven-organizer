import { useEffect, useRef, useState } from 'react'

async function compressPhoto(file) {
  if (!file || file.size > 20 * 1024 * 1024) throw new Error('请选择不超过 20MB 的照片')
  if (!/^image\//.test(file.type)) throw new Error('请选择图片文件')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => { throw new Error('无法读取这张照片，请改用 JPEG、PNG 或 WebP 图片') })
    const canvas = document.createElement('canvas')
    let scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight))
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('此浏览器暂不支持处理照片')
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(img, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL('image/jpeg', Math.max(.45, .82 - attempt * .1))
      if (data.length < 340000) return data
      scale *= .8
    }
    throw new Error('照片压缩失败，请选择尺寸较小的图片')
  } finally { URL.revokeObjectURL(url) }
}
export default function ItemPhoto({ value, existingUrl, onChange, onBusy, disabled }) {
  const upload = useRef(null), camera = useRef(null), operation = useRef(0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { operation.current++ }, [])
  const preview = value === undefined ? existingUrl : value
  async function pick(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const current = ++operation.current
    setError(''); setProcessing(true); onBusy(true)
    try { const photo = await compressPhoto(file); if (current === operation.current) onChange(photo) }
    catch (err) { if (current === operation.current) setError(err.message) }
    finally { if (current === operation.current) { setProcessing(false); onBusy(false) } }
  }
  return <div className="haven-photo-editor">
    <span className="haven-photo-label">物品照片 <small>选填 · 每件物品一张</small></span>
    {preview ? <img className="haven-photo-preview" src={preview} alt="物品照片预览" /> : <div className="haven-photo-placeholder">📷<span>拍张照片，下次更好找</span></div>}
    <input ref={upload} type="file" accept="image/*" hidden onChange={pick} />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    <div className="haven-photo-actions">
      <button type="button" className="haven-button" disabled={disabled || processing} onClick={() => upload.current.click()}>选择照片</button>
      <button type="button" className="haven-button" disabled={disabled || processing} onClick={() => camera.current.click()}>拍照</button>
      {preview && <button type="button" className="haven-danger-text" disabled={disabled || processing} onClick={() => { onChange(null); setError('') }}>移除照片</button>}
    </div>
    <p className="haven-small-note" role="status">{processing ? '正在压缩照片…' : '自动压缩保存。拍照功能由设备和浏览器支持，电脑可选择本地照片。'}</p>
    {error && <p className="haven-form-error" role="alert">{error}</p>}
  </div>
}
