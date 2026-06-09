import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import NewsSentiment from './NewsSentiment'
import AnalystRatings from './AnalystRatings'
import SentimentOverview from './SentimentOverview'

const TABS = [
  { path: 'news',     label: '📰 News Sentiment' },
  { path: 'analysts', label: '⭐ Analyst Ratings' },
  { path: 'overview', label: '💬 Overview' },
]

export default function SentimentFeature() {
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
          <Route path="news"     element={<NewsSentiment />} />
          <Route path="analysts" element={<AnalystRatings />} />
          <Route path="overview" element={<SentimentOverview />} />
          <Route path="*"        element={<Navigate to="news" replace />} />
        </Routes>
      </div>
    </div>
  )
}
