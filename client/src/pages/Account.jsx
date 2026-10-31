import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
export default function Account() {
  const { account, accept, logout } = useAuth()
  const [members, setMembers] = useState([])
  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [invitation, setInvitation] = useState(null)
  const [password, setPassword] = useState({ current_password: '', new_password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setInvitation(null)
    if (account.activeRoom) api.rooms.members(account.activeRoom.id).then(rows => { if (active) setMembers(rows) }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [account.activeRoom?.id])
  async function run(action) {
    setBusy(true); setMessage(''); setError('')
    try { await action() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  function submit(e, action) { e.preventDefault(); run(action) }
  return <div className="haven-page">
    <header className="haven-page-heading"><div><p className="haven-eyebrow">一起整理，各有所属</p><h1>账号与房间</h1><p className="haven-subtitle">你好，{account.user.display_name} · @{account.user.username}</p></div><button className="haven-button" disabled={busy} onClick={() => run(logout)}>退出登录</button></header>
    {error && <p role="alert" className="haven-form-error">{error}</p>}{message && <p role="status" className="haven-form-success">{message}</p>}
    <div className="haven-account-grid">
      <section className="haven-panel haven-account-section"><h2>我的房间</h2><p>切换房间后，只展示该房间的物品、分类和位置。</p><div className="haven-room-list">{account.rooms.map(room => <div key={room.id} className="haven-room-row"><div><strong>{room.name}</strong><small>{room.role === 'owner' ? '房间创建者' : '共享成员'}</small></div><button className="haven-button" disabled={busy || room.id === account.activeRoom?.id} onClick={() => run(async () => accept(await api.rooms.switch(room.id)))}>{room.id === account.activeRoom?.id ? '当前房间' : '切换'}</button></div>)}</div>
        <form className="haven-account-form" onSubmit={e => submit(e, async () => { accept(await api.rooms.create(roomName)); setRoomName(''); setMessage('新房间已创建，并已切换到该房间') })}><label>新建房间<input required maxLength={60} value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="例如：客厅、主卧、书房" /></label><button className="haven-button" disabled={busy}>创建房间</button></form>
        <form className="haven-account-form haven-form-divider" onSubmit={e => submit(e, async () => { accept(await api.rooms.join(joinCode)); setJoinCode(''); setMessage('已加入房间') })}><label>加入他人的房间<input required maxLength={100} autoComplete="off" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="粘贴房间邀请码" /></label><button className="haven-button" disabled={busy}>加入房间</button></form>
      </section>
      <section className="haven-panel haven-account-section"><h2>{account.activeRoom?.name || '房间'} · 成员</h2><p>房间成员共同管理这里的物品、分类和位置。</p><ul className="haven-members">{members.map(member => <li key={member.id}><span>{member.display_name}<small>@{member.username}</small></span><span>{member.role === 'owner' ? '创建者' : '成员'}</span></li>)}</ul>
        {account.activeRoom?.role === 'owner' && <><button className="haven-button haven-button-primary" disabled={busy} onClick={() => run(async () => setInvitation(await api.rooms.invite(account.activeRoom.id)))}>生成成员邀请码</button><p className="haven-small-note">邀请码 7 天有效，仅能使用一次。发送给你希望邀请的人；已有账号可直接加入，新用户也可在注册时填写。</p>{invitation && <div className="haven-invite"><label>邀请码<input readOnly value={invitation.code} onFocus={e => e.target.select()} /></label><button className="haven-button" type="button" onClick={() => run(async () => { await navigator.clipboard.writeText(invitation.code); setMessage('邀请码已复制') })}>复制</button></div>}</>}
      </section>
      <section className="haven-panel haven-account-section"><h2>修改密码</h2><p>更新后，其他设备上的登录会失效。</p><form className="haven-account-form" onSubmit={e => submit(e, async () => { accept(await api.auth.password(password), true); setPassword({ current_password: '', new_password: '' }); setMessage('密码已更新，其他设备已退出登录') })}><label>当前密码<input required type="password" autoComplete="current-password" maxLength={128} value={password.current_password} onChange={e => setPassword(p => ({ ...p, current_password: e.target.value }))} /></label><label>新密码<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password.new_password} onChange={e => setPassword(p => ({ ...p, new_password: e.target.value }))} placeholder="至少 12 个字符" /></label><button className="haven-button" disabled={busy}>更新密码</button></form></section>
    </div>
  </div>
}
