import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import Locations from './pages/Locations'
import Categories from './pages/Categories'
import Login from './pages/Login'
import Account from './pages/Account'
function Protected() {
  const { account, loading, error, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <div className="haven-auth-loading" role="status">正在检查登录状态…</div>
  if (error) return <div className="haven-auth-loading" role="alert"><p>{error}</p><button className="haven-button" onClick={refresh}>重新连接</button></div>
  if (account && !account.activeRoom && location.pathname !== '/account') return <Navigate to="/account" replace />
  return account ? <Layout /> : <Navigate to="/login" replace />
}
export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<Protected />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="items" element={<Items />} />
      <Route path="locations" element={<Locations />} />
      <Route path="categories" element={<Categories />} />
      <Route path="account" element={<Account />} />
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
