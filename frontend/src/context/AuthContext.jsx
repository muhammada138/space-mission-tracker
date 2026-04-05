import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate user from stored tokens on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      api.get('/auth/me/')
        .then(({ data }) => setUser(data))
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    const me = await api.get('/auth/me/')
    setUser(me.data)
    return me.data
  }, [])

  const register = useCallback(async (username, email, password, password2) => {
    await api.post('/auth/register/', { username, email, password, password2 })
    return login(username, password)
  }, [login])

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')
    try {
      if (refresh) await api.post('/auth/logout/', { refresh })
    } catch { /* token may already be expired */ }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
