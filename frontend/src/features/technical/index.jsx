import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import TechIndicators from './TechIndicators'
import TechPatterns from './TechPatterns'
import TechTargets from './TechTargets'

const TABS = [
  { path: 'indicators', label: '📉 Indicators' },
  { path: 'patterns',   label: '📐 Chart Patterns' },
  { path: 'targets',    label: '🎯 Price Targets' },
]

export default function TechnicalFeature() {
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
          <Route path="indicators" element={<TechIndicators />} />
          <Route path="patterns"   element={<TechPatterns />} />
          <Route path="targets"    element={<TechTargets />} />
          <Route path="*"          element={<Navigate to="indicators" replace />} />
        </Routes>
      </div>
    </div>
  )
}
