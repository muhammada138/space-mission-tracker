import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
})

// Attach CSRF token if available
api.interceptors.request.use((config) => {
  const match = document.cookie.match(new RegExp('(^| )csrftoken=([^;]+)'))
  if (match) {
    config.headers['X-CSRFToken'] = match[2]
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    
    // Handle 401 Unauthorized
    if (err.response?.status === 401 && !original._retry && original.url !== '/auth/login/' && original.url !== '/auth/refresh/') {
      original._retry = true
      try {
        await axios.post('/api/auth/refresh/', {}, { withCredentials: true })
        return api(original)
      } catch {
        window.location.href = '/login'
      }
    }

    // Global error logging for 500+ errors
    if (err.response?.status >= 500) {
      console.error(`Server Error (${err.response.status}):`, err.response.data?.detail || err.message)
    }

    return Promise.reject(err)
  }
)

export default api
