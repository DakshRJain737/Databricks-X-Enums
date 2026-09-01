import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/placement', label: 'Placement Readiness' },
  { to: '/pdf-qa', label: 'PDF Doubt-Clearing' },
  { to: '/leaderboard', label: 'CP / GitHub Leaderboard' },
  { to: '/facility', label: 'Facility Utilisation' },
]

export default function Layout() {
  const { logout } = useAuth()
  return (
    <div className="app-shell">
      <div className="sidebar">
        <h1>CAMPUS<span>.AI</span></h1>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {l.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <button className="secondary" onClick={logout}>Log out</button>
      </div>
      <div className="main">
        <Outlet />
      </div>
    </div>
  )
}
