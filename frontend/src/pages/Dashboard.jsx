import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

const features = [
  { to: '/placement', tag: '01', title: 'Placement Readiness', desc: 'Upload your resume, get an eligibility check and skill-gap plan against real drives.', bg: '#ffde59' },
  { to: '/pdf-qa', tag: '02', title: 'PDF Doubt-Clearing', desc: 'Upload lecture notes or a chapter PDF and ask questions grounded in that exact document.', bg: '#7cf5b6' },
  { to: '/leaderboard', tag: '03', title: 'CP / GitHub Leaderboard', desc: 'Compare your GitHub & Codeforces stats against your batch, live from public APIs.', bg: '#ff9de2' },
  { to: '/facility', tag: '04', title: 'Facility Utilisation', desc: 'See which lab is free right now (simulated occupancy stream).', bg: '#8ecbff' },
]

export default function Dashboard() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    api.get('/health').then((r) => setHealth(r.data)).catch(() => {})
  }, [])

  return (
    <div className="cai-page">
      <style>{`
        .cai-page {
          position: relative;
          background-color: #f4f1e9;
          background-image: radial-gradient(#c9c4b4 1.5px, transparent 1.5px);
          background-size: 20px 20px;
          color: #111;
          min-height: 100%;
          padding: 6px 2px;
          font-family: 'Helvetica Neue', Arial, sans-serif;
        }

        .cai-eyebrow {
          display: inline-block;
          background: #111;
          color: #ffde59;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.03em;
          padding: 4px 10px;
          border: 2px solid #111;
        }
        .cai-title {
          font-size: 40px;
          font-weight: 900;
          margin: 14px 0 6px;
          letter-spacing: -0.02em;
          text-transform: uppercase;
        }
        .cai-sub {
          color: #111;
          font-size: 16px;
          font-weight: 500;
          max-width: 480px;
          border-left: 4px solid #111;
          padding-left: 10px;
        }

        .status-card {
          position: relative;
          margin-top: 24px;
          background: #fff;
          border: 3px solid #111;
          box-shadow: 6px 6px 0 #111;
          padding: 16px 18px;
          max-width: 340px;
        }
        .status-card h2 {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 10px;
          font-weight: 800;
        }
        .pill {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          padding: 5px 10px;
          border: 2px solid #111;
        }
        .pill.ok { background: #7cf5b6; color: #05341c; }
        .pill.mock { background: #e9e6da; color: #333; }

        .cai-grid {
          margin-top: 32px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 22px;
        }
        @media (max-width: 640px) {
          .cai-grid { grid-template-columns: 1fr; }
        }

        .feature-link { text-decoration: none; color: inherit; }
        .feature-card {
          position: relative;
          background: var(--card-bg, #fff);
          border: 3px solid #111;
          box-shadow: 7px 7px 0 #111;
          padding: 22px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .feature-card:hover {
          transform: translate(4px, 4px);
          box-shadow: 3px 3px 0 #111;
        }
        .feature-tag {
          display: inline-block;
          font-size: 13px;
          font-weight: 900;
          background: #111;
          color: #fff;
          padding: 2px 8px;
          margin-bottom: 12px;
        }
        .feature-title {
          font-size: 19px;
          font-weight: 900;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
        }
        .feature-desc {
          color: #111;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.5;
          margin: 0;
        }
        .arrow {
          font-weight: 900;
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .feature-card:hover .arrow { opacity: 1; transform: translateX(0); }
      `}</style>

      <span className="cai-eyebrow">campus.ai — dashboard</span>
      <h2 className="cai-title">Welcome to Campus.AI</h2>
      <p className="cai-sub">
        One conversational layer across your student journeys — grounded in real data.
      </p>

      {health && (
        <div className="status-card">
          <h2>System status</h2>
          <span className={`pill ${health.databricks_genie_live ? 'ok' : 'mock'}`}>
            {health.databricks_genie_live ? 'Databricks Genie: live' : 'Databricks Genie: not configured (mock mode)'}
          </span>
        </div>
      )}

      <div className="cai-grid">
        {features.map((f) => (
          <Link key={f.to} to={f.to} className="feature-link">
            <div className="feature-card" style={{ '--card-bg': f.bg }}>
              <span className="feature-tag">{f.tag}</span>
              <div className="feature-title">
                {f.title}
                <span className="arrow">→</span>
              </div>
              <p className="feature-desc">{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}