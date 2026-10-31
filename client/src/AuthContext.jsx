import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  function accept(next, keepCurrent = false) {
    const previous = sessionStorage.getItem('haven_room')
    const activeRoom = keepCurrent && next.rooms?.find(room => room.id === previous) || next.activeRoom
    sessionStorage.setItem('haven_room', activeRoom?.id || '')
    setAccount({ ...next, activeRoom })
    setError('')
    return next
  }
  async function refresh() {
    setLoading(true)
    setError('')
    try { accept(await api.auth.me(), true) }
    catch (err) { if (err.status !== 401) setError(err.message); setAccount(null) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    refresh()
    const expired = () => { sessionStorage.removeItem('haven_room'); setAccount(null) }
    window.addEventListener('haven-session-expired', expired)
    return () => window.removeEventListener('haven-session-expired', expired)
  }, [])
  async function logout() {
    await api.auth.logout()
    sessionStorage.removeItem('haven_room')
    setAccount(null)
  }
  return <AuthContext.Provider value={{ account, loading, error, accept, logout, refresh }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
