import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import FundamentalOverview from './FundamentalOverview'
import Valuation from './Valuation'
import HealthScore from './HealthScore'

const TABS = [
  { path: 'overview',  label: '🏢 Overview' },
  { path: 'valuation', label: '💲 Valuation' },
  { path: 'health',    label: '❤️ Financial Health' },
]

export default function FundamentalFeature() {
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
          <Route path="overview"  element={<FundamentalOverview />} />
          <Route path="valuation" element={<Valuation />} />
          <Route path="health"    element={<HealthScore />} />
          <Route path="*"         element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  )
}
