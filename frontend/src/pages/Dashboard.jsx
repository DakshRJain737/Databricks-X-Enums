import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function Dashboard() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    api.get('/health').then((r) => setHealth(r.data)).catch(() => {})
  }, [])

  const features = [
    { to: '/placement', title: 'Placement Readiness', desc: 'Upload your resume, get an eligibility check and skill-gap plan against real drives.' },
    { to: '/pdf-qa', title: 'PDF Doubt-Clearing', desc: 'Upload lecture notes or a chapter PDF and ask questions grounded in that exact document.' },
    { to: '/leaderboard', title: 'CP / GitHub Leaderboard', desc: 'Compare your GitHub & Codeforces stats against your batch, live from public APIs.' },
    { to: '/facility', title: 'Facility Utilisation', desc: 'See which lab is free right now (simulated occupancy stream).' },
  ]

  return (
    <div>
      <h2 style={{ fontSize: 22 }}>Welcome to Campus.AI</h2>
      <p style={{ color: '#9aa1af' }}>
        One conversational layer across your student journeys — grounded in real data.
      </p>
      {health && (
        <div className="card">
          <h2>System status</h2>
          <span className={`pill ${health.databricks_genie_live ? 'ok' : 'mock'}`}>
            {health.databricks_genie_live ? 'Databricks Genie: live' : 'Databricks Genie: not configured (mock mode)'}
          </span>
        </div>
      )}
      <div className="grid-2">
        {features.map((f) => (
          <Link key={f.to} to={f.to} style={{ textDecoration: 'none' }}>
            <div className="card">
              <h2>{f.title}</h2>
              <p style={{ color: '#9aa1af', fontSize: 14 }}>{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
