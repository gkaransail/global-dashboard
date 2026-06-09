import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import InsiderTransactions from './InsiderTransactions'
import InsiderSentiment from './InsiderSentiment'
import InsiderSignals from './InsiderSignals'

const TABS = [
  { path: 'transactions', label: '📰 Transactions' },
  { path: 'sentiment',    label: '🎯 Insider Sentiment' },
  { path: 'signals',      label: '🚦 Buy/Sell Signals' },
]

export default function InsiderFeature() {
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
          <Route path="transactions" element={<InsiderTransactions />} />
          <Route path="sentiment"    element={<InsiderSentiment />} />
          <Route path="signals"      element={<InsiderSignals />} />
          <Route path="*"            element={<Navigate to="transactions" replace />} />
        </Routes>
      </div>
    </div>
  )
}
