import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import Modal from '../components/Modal'

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
  const [dialog, setDialog] = useState(null)
  const [draft, setDraft] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [managedMembers, setManagedMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    let active = true
    setInvitation(null)
    setMembers([])
    if (account.activeRoom) api.rooms.members(account.activeRoom.id).then(rows => { if (active) setMembers(rows) }).catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [account.activeRoom?.id])

  useEffect(() => {
    if (dialog?.type !== 'members') return
    let active = true
    setMembersLoading(true)
    setManagedMembers([])
    api.rooms.members(dialog.room.id).then(rows => { if (active) setManagedMembers(rows) }).catch(err => { if (active) setDialogError(err.message) }).finally(() => { if (active) setMembersLoading(false) })
    return () => { active = false }
  }, [dialog?.type, dialog?.room.id])

  async function run(action) {
    setBusy(true); setMessage(''); setError('')
    try { await action() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  function submit(e, action) { e.preventDefault(); run(action) }
  function openDialog(type, room) { setDialog({ type, room }); setDraft(type === 'edit' ? room.name : ''); setDialogError(''); setRemoving(null) }
  function closeDialog() { if (!busy) { setDialog(null); setDialogError(''); setRemoving(null) } }
  async function saveDialog(e) {
    e.preventDefault(); setBusy(true); setDialogError('')
    try {
      const result = dialog.type === 'edit' ? await api.rooms.update(dialog.room.id, draft) : await api.rooms.delete(dialog.room.id, draft)
      // Retain this tab’s room if it still exists; otherwise adopt the server fallback.
      accept(result, true)
      setDialog(null)
      setMessage(dialog.type === 'edit' ? '房间名称已更新' : '房间及其中的数据已删除')
    } catch (err) { setDialogError(err.message) } finally { setBusy(false) }
  }
  async function removeMember(member) {
    setBusy(true); setDialogError('')
    try {
      await api.rooms.removeMember(dialog.room.id, member.id)
      setInvitation(null)
      const updated = await api.rooms.members(dialog.room.id)
      setManagedMembers(updated)
      if (dialog.room.id === account.activeRoom?.id) setMembers(updated)
      setRemoving(null)
    } catch (err) { setDialogError(err.message) } finally { setBusy(false) }
  }

  return <div className="haven-page">
    <header className="haven-page-heading">
      <div><p className="haven-eyebrow">一起整理，各有所属</p><h1>账号与房间</h1><p className="haven-subtitle">你好，{account.user.display_name} · @{account.user.username}</p></div>
      <button className="haven-button" disabled={busy} onClick={() => run(logout)}>退出登录</button>
    </header>
    {error && <p role="alert" className="haven-form-error">{error}</p>}
    {message && <p role="status" className="haven-form-success">{message}</p>}
    <div className="haven-account-grid">
      <section className="haven-panel haven-account-section">
        <h2>我的房间</h2><p>切换房间后，只展示该房间的物品、分类和位置。创建者可以编辑房间、管理成员或删除房间。</p>
        {!account.rooms.length && <div className="haven-no-rooms">还没有房间。新建一个，或使用邀请码加入家人的房间。</div>}
        <div className="haven-room-list">
          {account.rooms.map(room => <div key={room.id} className="haven-room-card">
            <div className="haven-room-row"><div><strong>{room.name}</strong><small>{room.role === 'owner' ? '房间创建者' : '共享成员'}</small></div><button className="haven-button" disabled={busy || room.id === account.activeRoom?.id} onClick={() => run(async () => accept(await api.rooms.switch(room.id)))}>{room.id === account.activeRoom?.id ? '当前房间' : '切换'}</button></div>
            {room.role === 'owner' && <div className="haven-room-actions"><button disabled={busy} onClick={() => openDialog('edit', room)}>编辑名称</button><button disabled={busy} onClick={() => openDialog('members', room)}>管理成员</button><button disabled={busy} className="haven-danger-text" onClick={() => openDialog('delete', room)}>删除房间</button></div>}
          </div>)}
        </div>
        <form className="haven-account-form" onSubmit={e => submit(e, async () => { accept(await api.rooms.create(roomName)); setRoomName(''); setMessage('新房间已创建，并已切换到该房间') })}>
          <label>新建房间<input required maxLength={60} value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="例如：客厅、主卧、书房" /></label><button className="haven-button" disabled={busy}>创建房间</button>
        </form>
        <form className="haven-account-form haven-form-divider" onSubmit={e => submit(e, async () => { accept(await api.rooms.join(joinCode)); setJoinCode(''); setMessage('已加入房间') })}>
          <label>加入他人的房间<input required maxLength={100} autoComplete="off" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="粘贴房间邀请码" /></label><button className="haven-button" disabled={busy}>加入房间</button>
        </form>
      </section>
      {account.activeRoom && <section className="haven-panel haven-account-section">
        <h2>{account.activeRoom.name} · 成员</h2><p>房间成员共同管理这里的物品、分类和位置。</p>
        <ul className="haven-members">{members.map(member => <li key={member.id}><span>{member.display_name}<small>@{member.username}</small></span><span>{member.role === 'owner' ? '创建者' : '成员'}</span></li>)}</ul>
        {account.activeRoom.role === 'owner' && <>
          <div className="haven-room-management-buttons"><button className="haven-button" disabled={busy} onClick={() => openDialog('members', account.activeRoom)}>管理成员</button><button className="haven-button haven-button-primary" disabled={busy} onClick={() => run(async () => setInvitation(await api.rooms.invite(account.activeRoom.id)))}>生成成员邀请码</button></div>
          <p className="haven-small-note">邀请码 7 天有效，仅能使用一次。新用户可在注册时填写，已有账号可直接加入。</p>
          {invitation && <div className="haven-invite"><label>邀请码<input readOnly value={invitation.code} onFocus={e => e.target.select()} /></label><button className="haven-button" type="button" onClick={() => run(async () => { await navigator.clipboard.writeText(invitation.code); setMessage('邀请码已复制') })}>复制</button></div>}
        </>}
      </section>}
      <section className="haven-panel haven-account-section">
        <h2>修改密码</h2><p>更新后，其他设备上的登录会失效。</p>
        <form className="haven-account-form" onSubmit={e => submit(e, async () => { accept(await api.auth.password(password), true); setPassword({ current_password: '', new_password: '' }); setMessage('密码已更新，其他设备已退出登录') })}>
          <label>当前密码<input required type="password" autoComplete="current-password" maxLength={128} value={password.current_password} onChange={e => setPassword(p => ({ ...p, current_password: e.target.value }))} /></label>
          <label>新密码<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password.new_password} onChange={e => setPassword(p => ({ ...p, new_password: e.target.value }))} placeholder="至少 12 个字符" /></label><button className="haven-button" disabled={busy}>更新密码</button>
        </form>
      </section>
    </div>
    {dialog && <Modal title={`${dialog.type === 'edit' ? '编辑房间' : dialog.type === 'delete' ? '删除房间' : '管理成员'} · ${dialog.room.name}`} onClose={closeDialog}>
      {dialogError && <p role="alert" className="haven-form-error">{dialogError}</p>}
      {dialog.type === 'members' ? <>
        <p className="haven-small-note">移除成员只会取消对这个房间的访问，不会删除对方的账号或其在其他房间的数据。房间创建者不能被移除。</p>
        {membersLoading && <p role="status" className="haven-small-note">正在加载成员…</p>}
        <ul className="haven-members">{managedMembers.map(member => <li key={member.id} className="haven-managed-member"><span>{member.display_name}<small>@{member.username}</small></span>{member.role === 'owner' ? <span>创建者</span> : <button className="haven-danger-text" disabled={busy} onClick={() => setRemoving(member)}>移除成员</button>}</li>)}</ul>
        {removing && <div className="haven-remove-confirm"><p>确认移除「{removing.display_name}」？该成员将无法访问此房间，未使用的邀请码也会失效。</p><div className="haven-room-management-buttons"><button className="haven-button" disabled={busy} onClick={() => setRemoving(null)}>取消</button><button className="haven-button haven-button-danger" disabled={busy} onClick={() => removeMember(removing)}>{busy ? '移除中…' : '确认移除'}</button></div></div>}
      </> : <form className="haven-account-form" onSubmit={saveDialog}>
        {dialog.type === 'delete' && <p className="haven-delete-warning">此操作无法撤销，会永久删除这个房间及其中全部物品、分类、位置、邀请码和成员关系。所有成员都会失去访问权限，其他房间和用户账号不受影响。建议先导出数据。</p>}
        <label>{dialog.type === 'edit' ? '房间名称' : `输入完整房间名称「${dialog.room.name}」确认`}<input required autoFocus maxLength={60} value={draft} onChange={e => setDraft(e.target.value)} autoComplete="off" /></label>
        <div className="haven-dialog-actions"><button type="button" className="haven-button" disabled={busy} onClick={closeDialog}>取消</button><button className={`haven-button ${dialog.type === 'delete' ? 'haven-button-danger' : 'haven-button-primary'}`} disabled={busy || !draft.trim() || (dialog.type === 'delete' && draft !== dialog.room.name)}>{busy ? '处理中…' : dialog.type === 'delete' ? '永久删除房间' : '保存修改'}</button></div>
      </form>}
    </Modal>}
  </div>
}
