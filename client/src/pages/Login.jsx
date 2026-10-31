import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../AuthContext'
export default function Login() {
  const { account, loading, error: startupError, accept, refresh } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', display_name: '', invite_code: '', room_name: '' })
  const [join, setJoin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try { accept(await api.auth[mode]({ ...form, invite_code: join ? form.invite_code : '' })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  if (loading) return <div className="haven-auth-loading" role="status">正在检查登录状态…</div>
  if (account) return <Navigate to="/dashboard" replace />
  return (
    <main className="haven-login-page">
      <div className="haven-login-story"><Link to="/login" className="haven-login-brand">🏠 家物管家</Link><h1>每个房间，<br />都有一起打理的人。</h1><p>记录物品，安排位置。与家人共享同一个房间，也保留自己的收纳空间。</p><div className="haven-login-features"><span>📦 物品有记录</span><span>📍 收纳有位置</span><span>👥 房间可共享</span></div></div>
      <section className="haven-auth-card">
        <div className="haven-auth-tabs" role="group" aria-label="账号操作"><button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button><button type="button" className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setError('') }}>创建账号</button></div>
        <h2>{mode === 'login' ? '欢迎回家' : '开启你的收纳空间'}</h2><p className="haven-auth-description">{mode === 'login' ? '登录后，继续整理你的房间。' : '创建新房间，或通过邀请码与家人一起管理。'}</p>
        {startupError && <div role="alert" className="haven-form-error">{startupError} <button type="button" onClick={refresh}>重新连接</button></div>}
        <form onSubmit={submit} className="haven-account-form">
          <label>用户名<input required name="username" autoComplete="username" value={form.username} onChange={e => set('username', e.target.value)} maxLength={32} placeholder="例如：xiaoming" pattern={mode === 'register' ? '[a-zA-Z0-9][a-zA-Z0-9_.\\-]{2,31}' : undefined} /></label>
          {mode === 'register' && <><small>3–32 位英文字母、数字、下划线、点或短横线</small><label>你的称呼<input name="display_name" autoComplete="nickname" maxLength={40} value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="家人怎么称呼你？（可选）" /></label></>}
          <label>密码<input required type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : undefined} maxLength={128} value={form.password} onChange={e => set('password', e.target.value)} placeholder={mode === 'register' ? '至少 12 个字符' : '请输入密码'} /></label>
          {mode === 'register' && <><label className="haven-checkbox-label"><input type="checkbox" checked={join} onChange={e => setJoin(e.target.checked)} />我有邀请码，加入已有房间</label>{join ? <label>房间邀请码<input required autoComplete="off" value={form.invite_code} maxLength={100} onChange={e => set('invite_code', e.target.value)} placeholder="向房间创建者索取" /></label> : <label>第一个房间名称<input maxLength={60} value={form.room_name} onChange={e => set('room_name', e.target.value)} placeholder="例如：主卧、书房（可选）" /></label>}</>}
          {error && <p role="alert" className="haven-form-error">{error}</p>}
          <button className="haven-button haven-button-primary" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '登录' : '创建账号'}</button>
        </form>
        <p className="haven-auth-footnote">房间里的物品、分类和位置，仅对该房间成员可见。一个账号可加入多个房间。</p>
      </section>
    </main>
  )
}
