import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import Top10Dashboard from './Top10Dashboard'
import MethodologyPage from './MethodologyPage'

const TABS = [
  { path: 'top10',       label: '🏆 Top 10 Stocks' },
  { path: 'methodology', label: '📐 Methodology' },
]

export default function DashboardFeature() {
  return (
    <div className="feature-root">
      <nav className="sub-tabs">
        {TABS.map(t => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) => `sub-tab${isActive ? ' active' : ''}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="sub-content">
        <Routes>
          <Route path="top10"       element={<Top10Dashboard />} />
          <Route path="methodology" element={<MethodologyPage />} />
          <Route path="*"           element={<Navigate to="top10" replace />} />
        </Routes>
      </div>
    </div>
  )
}
