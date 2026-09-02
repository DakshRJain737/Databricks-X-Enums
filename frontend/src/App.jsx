import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Placement from './pages/Placement.jsx'
import PdfQa from './pages/PdfQa.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Facility from './pages/Facility.jsx'
import StudentProfile from './pages/StudentProfile.jsx'
import Profile from './pages/Profile.jsx'

function ProtectedRoute({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="placement" element={<Placement />} />
        <Route path="pdf-qa" element={<PdfQa />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="facility" element={<Facility />} />
        <Route path="students/:usn" element={<StudentProfile />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}