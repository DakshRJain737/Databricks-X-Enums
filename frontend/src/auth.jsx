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
  // NEW: OTP login (step 1) -- sends a code to the user's college email
  const sendOtp = async (email) => {
    const res = await api.post('/auth/send-otp', { email })
    return res.data
  }
  // NEW: OTP login (step 2) -- verifies the code and logs the user in
  const verifyOtp = async (email, otp) => {
    const res = await api.post('/auth/verify-otp', { email, otp })
    localStorage.setItem('campusai_token', res.data.access_token)
    setToken(res.data.access_token)
  }
  const signup = async (payload) => {
    const res = await api.post('/auth/signup', payload)
    return res.data // { message: ... } -- account is unverified until OTP is confirmed
  }
  // NEW: Forgot password (step 2) -- verifies the OTP and sets a new password
  const resetPassword = async (email, otp, newPassword) => {
    const res = await api.post('/auth/reset-password', { email, otp, new_password: newPassword })
    return res.data
  }
  const logout = () => {
    localStorage.removeItem('campusai_token')
    setToken(null)
  }
  return (
    <AuthContext.Provider value={{ token, login, signup, logout, sendOtp, verifyOtp, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}
export const useAuth = () => useContext(AuthContext)