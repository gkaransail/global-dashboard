import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmt(v, d = 1) { return v == null ? '—' : Number(v).toFixed(d) }

function HealthGauge({ score }) {
  const s = Math.max(0, Math.min(100, score ?? 0))
  const color = s >= 70 ? '#22c55e' : s >= 50 ? '#f59e0b' : s >= 30 ? '#f97316' : '#ef4444'
  const label = s >= 70 ? 'Strong' : s >= 50 ? 'Good' : s >= 30 ? 'Fair' : 'Weak'

  // Arc SVG (semi-circle gauge)
  const R = 80
  const CX = 100, CY = 100
  const START_ANGLE = -180
  const SWEEP = 180
  const rad = (deg) => (deg * Math.PI) / 180
  const arcX = (a) => CX + R * Math.cos(rad(a))
  const arcY = (a) => CY + R * Math.sin(rad(a))

  const startA = START_ANGLE
  const endA   = START_ANGLE + (SWEEP * s) / 100

  const dFull  = `M ${arcX(startA)} ${arcY(startA)} A ${R} ${R} 0 1 1 ${arcX(START_ANGLE + SWEEP)} ${arcY(START_ANGLE + SWEEP)}`
  const dFill  = s === 0 ? '' : `M ${arcX(startA)} ${arcY(startA)} A ${R} ${R} 0 ${s > 50 ? 1 : 0} 1 ${arcX(endA)} ${arcY(endA)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={200} height={110} viewBox="0 0 200 110">
        {/* Background arc */}
        <path d={dFull} fill="none" stroke="var(--border)" strokeWidth={14} strokeLinecap="round" />
        {/* Filled arc */}
        {s > 0 && (
          <path d={dFill} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />
        )}
        {/* Score text */}
        <text x={CX} y={CY - 5} textAnchor="middle" fill={color} fontSize={36} fontWeight={800} fontFamily="inherit">
          {Math.round(s)}
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fill="#64748b" fontSize={11} fontFamily="inherit">
          / 100
        </text>
      </svg>
      <span style={{
        background: `${color}18`, border: `1px solid ${color}33`,
        color, fontSize: 13, fontWeight: 700,
        padding: '4px 16px', borderRadius: 20,
      }}>
        {label} Financial Health
      </span>
    </div>
  )
}

function ComponentBar({ label, score, color, description }) {
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const c   = color ?? (pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444')
  const lbl = pct >= 70 ? 'Strong' : pct >= 50 ? 'Good' : pct >= 30 ? 'Fair' : 'Weak'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
          {description && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{description}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{Math.round(pct)}</div>
          <span style={{
            fontSize: 9, fontWeight: 700, color: c,
            background: `${c}18`, border: `1px solid ${c}33`,
            padding: '1px 6px', borderRadius: 20, display: 'inline-block',
          }}>{lbl}</span>
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 4, transition: 'width .5s' }} />
      </div>
    </div>
  )
}

export default function HealthScore() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/fundamental/health/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Calculating health score for {ticker}...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pad">
        <div className="error-box">⚠ {error}</div>
      </div>
    )
  }

  if (!data) return null

  const overallScore  = data.health_score ?? data.score ?? data.overall_score ?? 0
  const profitability = (data.profitability_score  ?? data.components?.profitability  ?? 0) * (data.components ? 100 : 1)
  const growth        = (data.growth_score         ?? data.components?.growth         ?? 0) * (data.components ? 100 : 1)
  const balanceSheet  = (data.balance_sheet_score  ?? data.components?.balance_sheet  ?? 0) * (data.components ? 100 : 1)
  const valuation     = (data.valuation_score      ?? data.components?.valuation      ?? 0) * (data.components ? 100 : 1)

  const components = [
    { label: 'Profitability',  score: profitability, color: '#22c55e',  description: 'Profit margins, ROE, ROA' },
    { label: 'Growth',         score: growth,        color: '#3b82f6',  description: 'Revenue & earnings growth' },
    { label: 'Balance Sheet',  score: balanceSheet,  color: '#a855f7',  description: 'Debt levels, current ratio, cash' },
    { label: 'Valuation',      score: valuation,     color: '#f59e0b',  description: 'PE, PB, EV/EBITDA vs peers' },
  ]

  const explanation = data.explanation ?? data.summary ?? null

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        ❤️ Financial Health Score — {ticker}
      </h2>

      {/* Gauge */}
      <div className="card" style={{ display: 'flex', justifyContent: 'center' }}>
        <HealthGauge score={overallScore} />
      </div>

      {/* Component bars */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="section-title">Component Breakdown</div>
        {components.map(comp => (
          <ComponentBar key={comp.label} {...comp} />
        ))}
      </div>

      {/* Additional metrics from data */}
      {data.metrics && (
        <div>
          <div className="section-title">Supporting Metrics</div>
          <div className="card-grid-4">
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key} className="card card-sm">
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {typeof value === 'number' ? fmt(value, 2) : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div style={{
          background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>Analysis Summary</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{explanation}</div>
        </div>
      )}

    </div>
  )
}
