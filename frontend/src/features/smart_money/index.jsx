import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import SmartMoneyInstitutional from './SmartMoneyInstitutional'
import SmartMoneySignals from './SmartMoneySignals'

const TABS = [
  { path: 'institutional', label: '🏦 Institutional' },
  { path: 'signals',       label: '🌊 Smart Money Signals' },
]

export default function SmartMoneyFeature() {
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
          <Route path="institutional" element={<SmartMoneyInstitutional />} />
          <Route path="signals"       element={<SmartMoneySignals />} />
          <Route path="*"             element={<Navigate to="institutional" replace />} />
        </Routes>
      </div>
    </div>
  )
}
