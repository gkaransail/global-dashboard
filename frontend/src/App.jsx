import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TickerBar from './components/TickerBar'
import ReversalFeature from './features/reversal'
import OptionsFeature from './features/options'
import DashboardFeature from './features/dashboard'
import InsiderFeature from './features/insider'
import SmartMoneyFeature from './features/smart_money'
import TechnicalFeature from './features/technical'
import FundamentalFeature from './features/fundamental'
import SentimentFeature from './features/sentiment'

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <TickerBar />
        <div className="feature-workspace">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard/top10" replace />} />
            <Route path="/dashboard/*"   element={<DashboardFeature />} />
            <Route path="/reversal/*"    element={<ReversalFeature />} />
            <Route path="/options/*"     element={<OptionsFeature />} />
            <Route path="/insider/*"     element={<InsiderFeature />} />
            <Route path="/smart_money/*" element={<SmartMoneyFeature />} />
            <Route path="/technical/*"   element={<TechnicalFeature />} />
            <Route path="/fundamental/*" element={<FundamentalFeature />} />
            <Route path="/sentiment/*"   element={<SentimentFeature />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
