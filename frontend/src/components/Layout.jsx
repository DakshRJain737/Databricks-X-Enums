import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth.jsx'
import api from '../api/client'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/placement', label: 'Placement Readiness' },
  { to: '/pdf-qa', label: 'PDF Doubt-Clearing' },
  { to: '/leaderboard', label: 'CP / GitHub Leaderboard' },
  { to: '/facility', label: 'Facility Utilisation' },
]

export default function Layout() {
  const { logout } = useAuth()
  const nav = useNavigate()
  const [me, setMe] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    api.get('/users/me').then((res) => setMe(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="app-shell">
      <style>{TOPBAR_STYLES}</style>
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
        <div className="campusai-topbar">
          <div className="campusai-user-menu" ref={menuRef}>
            <button
              className="campusai-user-avatar"
              onClick={() => setMenuOpen((v) => !v)}
              title={me?.email || 'Account'}
            >
              <span className="campusai-user-icon">
                <span className="campusai-user-icon-head" />
                <span className="campusai-user-icon-body" />
              </span>
            </button>
            {menuOpen && (
              <div className="campusai-user-dropdown">
                <div className="campusai-user-name">{me?.full_name || 'Student'}</div>
                <div className="campusai-user-email">{me?.email}</div>
                <button
                  className="campusai-user-item"
                  onClick={() => { setMenuOpen(false); nav('/profile') }}
                >
                  View / edit profile
                </button>
                <button className="campusai-user-item campusai-user-item-danger" onClick={logout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}

const TOPBAR_STYLES = `
.campusai-topbar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 20px 0;
}
.campusai-user-menu { position: relative; }
.campusai-user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #111111;
  border: 2.5px solid #111111;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  font-family: 'Space Grotesk', 'Inter', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  
}
.campusai-user-icon {
  position: relative;
  width: 34px;
  height: 34px;
  display: block;
}
.campusai-user-icon-head {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #FFFFFF;
  display: block;
}
.campusai-user-icon-body {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 13px;
  border-radius: 12px 12px 0 0;
  background: #FFFFFF;
  display: block;
}
.campusai-user-avatar:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0px #111111; }
.campusai-user-avatar:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0px #111111; }
.campusai-user-dropdown {
  position: absolute;
  top: 48px;
  right: 0;
  min-width: 220px;
  background: #F5F0E1;
  border: 2.5px solid #111111;
  border-radius: 12px;
  box-shadow: 5px 5px 0px #111111;
  padding: 12px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.campusai-user-name {
  font-family: 'Space Grotesk', 'Inter', sans-serif;
  font-weight: 700;
  font-size: 0.92rem;
  color: #111111;
  padding: 2px 8px 0;
}
.campusai-user-email {
  font-size: 0.76rem;
  color: #4A4636;
  font-weight: 600;
  padding: 0 8px 8px;
  border-bottom: 2px solid #11111122;
  margin-bottom: 4px;
  word-break: break-all;
}
.campusai-user-item {
  text-align: left;
  background: none;
  border: none;
  color: #111111;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 9px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}
.campusai-user-item:hover { background: #FFDE59; }
.campusai-user-item-danger:hover { background: #FF8A8A; }
`