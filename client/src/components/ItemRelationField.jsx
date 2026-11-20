import { useEffect, useId, useMemo, useState } from 'react'
import { api } from '../api'
import { locationPaths } from '../../../shared/item-search.mjs'
import './ItemRelationField.css'

const TYPES = [['home', '整栋/整层'], ['room', '房间/区域'], ['cabinet', '柜子/衣柜'], ['shelf', '层架'], ['drawer', '抽屉'], ['box', '收纳箱'], ['other', '其他']]
export default function ItemRelationField({ kind, value, rows, onChange, onSaved, onEditing, roomId, disabled }) {
  const id = useId()
  const category = kind === 'categories'
  const label = category ? '分类' : '存放位置'
  const [mode, setMode] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editId, setEditId] = useState(null)
  const selected = rows.find(row => String(row.id) === String(value))
  const paths = useMemo(() => locationPaths(category ? [] : rows), [category, rows])
  useEffect(() => () => onEditing?.(false), [onEditing])
  const excluded = useMemo(() => {
    const blocked = new Set(mode === 'edit' ? [String(editId)] : [])
    if (category || mode !== 'edit') return blocked
    let changed = true
    while (changed) {
      changed = false
      for (const row of rows) if (blocked.has(String(row.parent_id)) && !blocked.has(String(row.id))) { blocked.add(String(row.id)); changed = true }
    }
    return blocked
  }, [mode, editId, category, rows])
  function open(next) {
    if (disabled || saving || (next === 'edit' && !selected)) return
    const row = next === 'edit' ? selected : null
    setMode(next); setEditId(row?.id ?? null); setError(''); setNotice('')
    setDraft(category ? { name: row?.name || '', color: row?.color || '#6366f1', icon: row?.icon || '📦' } : { name: row?.name || '', type: row?.type || 'room', parent_id: row?.parent_id ? String(row.parent_id) : next === 'create' ? String(value || '') : '', description: row?.description || '' })
    onEditing?.(true)
  }
  function close() { if (saving) return; setMode(null); setError(''); onEditing?.(false) }
  function set(key, next) { setDraft(current => ({ ...current, [key]: next })) }
  async function save() {
    if (saving || disabled) return
    if (!draft.name?.trim()) { setError('请输入名称'); return }
    setSaving(true); setError('')
    try {
      const body = category ? { ...draft, name: draft.name.trim() } : { ...draft, name: draft.name.trim(), parent_id: draft.parent_id ? Number(draft.parent_id) : null }
      const result = mode === 'edit' ? await api[kind].update(editId, body, roomId) : await api[kind].create(body, roomId)
      onSaved(result)
      onChange(String(result.id))
      setMode(null); setNotice((category ? '分类' : '位置') + '已保存并选中'); onEditing?.(false)
    } catch (err) { setError(err.message || '保存失败，请重试') }
    finally { setSaving(false) }
  }
  return <div className="haven-relation-field">
    <div className="haven-relation-heading"><label htmlFor={id}>{label}</label><div>
      <button type="button" disabled={disabled || saving || !!mode} onClick={() => open('create')}>＋ 新增</button>
      <button type="button" disabled={disabled || saving || !!mode || !selected} onClick={() => open('edit')}>编辑所选</button>
    </div></div>
    <select id={id} value={value || ''} disabled={disabled || saving || !!mode} onChange={e => { setNotice(''); onChange(e.target.value) }}>
      <option value="">{category ? '不选择分类' : '未指定位置'}</option>
      {rows.map(row => <option key={row.id} value={String(row.id)}>{category ? (row.icon || '📦') + ' ' + row.name : paths.get(String(row.id)) || row.name}</option>)}
    </select>
    {notice && <p className="haven-relation-notice" role="status">{notice}</p>}
    {mode && <section className="haven-relation-editor" aria-label={(mode === 'edit' ? '编辑' : '新增') + label} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}>
      <h3>{mode === 'edit' ? '编辑' : '新增'}{label}</h3>
      <p>保存后会更新当前房间中的{category ? '分类' : '位置'}，并保留正在填写的物品信息。请先保存或取消这里的编辑，再保存物品。</p>
      <label htmlFor={id + '-name'}>名称<input id={id + '-name'} autoFocus maxLength={120} value={draft.name} disabled={saving} onChange={e => set('name', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }} /></label>
      {category ? <div className="haven-relation-two-columns">
        <label htmlFor={id + '-icon'}>图标<input id={id + '-icon'} value={draft.icon} maxLength={24} disabled={saving} onChange={e => set('icon', e.target.value)} placeholder="例如：📚" /></label>
        <label htmlFor={id + '-color'}>颜色<input id={id + '-color'} type="color" value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#6366f1'} disabled={saving} onChange={e => set('color', e.target.value)} /></label>
      </div> : <>
        <label htmlFor={id + '-type'}>位置类型<select id={id + '-type'} disabled={saving} value={draft.type} onChange={e => set('type', e.target.value)}>{TYPES.map(([type, title]) => <option key={type} value={type}>{title}</option>)}</select></label>
        <label htmlFor={id + '-parent'}>上级位置<select id={id + '-parent'} disabled={saving} value={draft.parent_id} onChange={e => set('parent_id', e.target.value)}><option value="">无上级位置</option>{rows.filter(row => !excluded.has(String(row.id))).map(row => <option key={row.id} value={String(row.id)}>{paths.get(String(row.id)) || row.name}</option>)}</select></label>
        <label htmlFor={id + '-description'}>位置备注<input id={id + '-description'} maxLength={2000} disabled={saving} value={draft.description} onChange={e => set('description', e.target.value)} /></label>
      </>}
      {error && <p className="haven-form-error" role="alert">{error}</p>}
      <div className="haven-relation-actions"><button type="button" className="haven-button" disabled={saving} onClick={close}>取消</button><button type="button" className="haven-button haven-button-primary" disabled={saving || !draft.name.trim()} onClick={save}>{saving ? '保存中…' : '保存' + (category ? '分类' : '位置')}</button></div>
    </section>}
  </div>
}
