import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { FEATURES } from '../features'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeFeature = FEATURES.find(f => location.pathname.startsWith(`/${f.id}`))
  const [expanded, setExpanded] = useState(activeFeature?.id ?? 'reversal')

  function handleFeatureClick(feature) {
    if (feature.status === 'coming_soon') {
      setExpanded(expanded === feature.id ? null : feature.id)
      navigate(`/${feature.id}`)
      return
    }
    setExpanded(feature.id)
    navigate(feature.subOptions[0].path)
  }

  function handleSubClick(sub) {
    navigate(sub.path)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">📈 FinanceIQ</div>
        <div className="sidebar-logo-sub">Intelligence Dashboard</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Analysis Modules</div>
        {FEATURES.map(feature => {
          const isExpanded = expanded === feature.id
          const isActive = activeFeature?.id === feature.id

          return (
            <div key={feature.id} className="sidebar-feature">
              <button
                className={`sidebar-feature-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleFeatureClick(feature)}
              >
                <span className="sidebar-feature-icon">{feature.icon}</span>
                <span className="sidebar-feature-label">{feature.label}</span>
                {feature.status === 'coming_soon' && (
                  <span className="sidebar-coming-soon">Soon</span>
                )}
                <span className={`sidebar-feature-arrow ${isExpanded ? 'open' : ''}`}>›</span>
              </button>

              {isExpanded && (
                <div className="sidebar-sub-options">
                  {feature.subOptions.map(sub => {
                    const isSubActive = location.pathname === sub.path
                    return (
                      <button
                        key={sub.id}
                        className={`sidebar-sub-btn ${isSubActive ? 'active' : ''}`}
                        onClick={() => handleSubClick(sub)}
                      >
                        <span>{sub.icon}</span>
                        <span>{sub.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
