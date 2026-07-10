import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import NotFound from './pages/NotFound'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import Profile from './pages/Profile'

function App() {
  const [token, setToken] = useState(localStorage.getItem('tl_token'))

  useEffect(() => {
    if (token) localStorage.setItem('tl_token', token)
    else localStorage.removeItem('tl_token')
  }, [token])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<Login setToken={setToken} />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/profile/:userId" element={<Profile />} />
      <Route path="*" element={<NotFound />} />
      <Route
        path="/dashboard/*"
        element={token ? <Dashboard token={token} setToken={setToken} /> : <Navigate to="/login" />}
      />
    </Routes>
  )
}

export default App
