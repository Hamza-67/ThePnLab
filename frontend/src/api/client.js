import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

// ── Ajoute le token JWT à chaque requête ──
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('tl_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Si 401 : redirige seulement si token existait (session expirée) ──
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isAuthRoute = err.config?.url?.includes('/api/auth/')
      const token = localStorage.getItem('tl_token')
      if (!isAuthRoute && token) {
        localStorage.removeItem('tl_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default API