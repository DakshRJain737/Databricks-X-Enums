import { createContext, useContext, useState } from 'react'
import api from './api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('campusai_token'))

  const login = async (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('campusai_token', res.data.access_token)
    setToken(res.data.access_token)
  }

  const signup = async (email, password, full_name, branch) => {
    const res = await api.post('/auth/signup', { email, password, full_name, branch })
    localStorage.setItem('campusai_token', res.data.access_token)
    setToken(res.data.access_token)
  }

  const logout = () => {
    localStorage.removeItem('campusai_token')
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
