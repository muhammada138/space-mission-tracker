import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch user from secure cookies on mount
  useEffect(() => {
    api.get('/auth/me/')
      .then(({ data }) => setUser(data))
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    await api.post('/auth/login/', { username, password })
    const me = await api.get('/auth/me/')
    setUser(me.data)
    return me.data
  }, [])

  const register = useCallback(async (username, email, password, password2) => {
    await api.post('/auth/register/', { username, email, password, password2 })
    return login(username, password)
  }, [login])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/')
    } catch { /* ignore error on logout */ }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
