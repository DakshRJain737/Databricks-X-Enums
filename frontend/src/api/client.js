import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('campusai_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Endpoints where a 401 means "wrong credentials / bad OTP", not "your
// session expired" -- these should just show an inline error, never
// force-redirect to /login (which would wipe that error off the screen).
const AUTH_ENDPOINTS = ['/auth/login', '/auth/send-otp', '/auth/verify-otp', '/auth/reset-password', '/auth/signup']

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => url.includes(p))
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('campusai_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api