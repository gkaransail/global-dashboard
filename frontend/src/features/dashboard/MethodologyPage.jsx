import { useState, useEffect } from 'react'
import { api } from '../../core/api'

const FALLBACK_FACTORS = [
  { key: 'options',     label: 'Options Flow',    weight: 0.30, color: '#3b82f6', description: 'Put/call ratios, unusual activity, gamma exposure, and smart money positioning via options markets.' },
  { key: 'insider',     label: 'Insider Trading', weight: 0.25, color: '#f59e0b', description: 'SEC Form 4 cluster buys, net value traded, executive accumulation, and recency-weighted signals.' },
  { key: 'technical',   label: 'Technical',       weight: 0.20, color: '#22c55e', description: 'RSI, MACD, Bollinger Bands, moving average alignment, volume surge, and momentum indicators.' },
  { key: 'fundamental', label: 'Fundamental',     weight: 0.15, color: '#a855f7', description: 'PE ratio, forward PE, PEG, revenue growth, profit margins, ROE, and balance sheet health.' },
  { key: 'sentiment',   label: 'Sentiment',       weight: 0.05, color: '#ec4899', description: 'News NLP sentiment, analyst consensus, price target upgrades, and earnings estimate revisions.' },
  { key: 'macro',       label: 'Macro',           weight: 0.05, color: '#94a3b8', description: 'Sector momentum, market breadth, VIX levels, yield curve, and broad macro environment.' },
]

function WeightBar({ factors }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 28, display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {factors.map(({ key, label, weight, color }) => (
          <div
            key={key}
            style={{
              width: `${weight * 100}%`,
              background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
              overflow: 'hidden', whiteSpace: 'nowrap',
              transition: 'width .4s',
            }}
            title={`${label}: ${(weight * 100).toFixed(0)}%`}
          >
            {weight >= 0.1 ? `${(weight * 100).toFixed(0)}%` : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {factors.map(({ key, label, weight, color }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label} ({(weight * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MethodologyPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/dashboard/methodology')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Build factors from API data or use fallback
  const factors = (() => {
    if (data && data.factors) return data.factors
    if (data && data.scoring_weights) {
      return Object.entries(data.scoring_weights).map(([key, weight]) => {
        const fb = FALLBACK_FACTORS.find(f => f.key === key) || {}
        return { key, label: fb.label || key, weight, color: fb.color || '#94a3b8', description: fb.description || '' }
      })
    }
    return FALLBACK_FACTORS
  })()

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading methodology...</span>
      </div>
    )
  }

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          📐 Scoring Methodology
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
          Each stock is evaluated across 6 independent factor categories. Scores are normalized
          to [0, 1] and combined via weighted average to produce a composite directional score.
        </p>
      </div>

      {error && <div className="error-box">⚠ {error} — showing default weights</div>}

      {/* Visual weight breakdown */}
      <div className="card">
        <div className="section-title">Scoring Weight Distribution</div>
        <WeightBar factors={factors} />
      </div>

      {/* Factor cards */}
      <div>
        <div className="section-title">Factor Definitions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {factors.map(({ key, label, weight, color, description }) => (
            <div key={key} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${color}`,
              borderRadius: 10, padding: '14px 18px',
              display: 'flex', gap: 16, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 10,
                background: `${color}18`, border: `1px solid ${color}33`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color }}>{(weight * 100).toFixed(0)}%</span>
                <span style={{ fontSize: 8, color, textTransform: 'uppercase', letterSpacing: '.4px' }}>weight</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{description}</div>
                <div style={{ marginTop: 8, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 240 }}>
                  <div style={{ width: `${weight * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predicted price explanation */}
      <div className="card">
        <div className="section-title">How Predicted Price Is Calculated</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          {[
            {
              step: '1',
              title: 'Composite Score',
              desc: 'Weighted average of all 6 factor scores produces a raw composite in [-1, +1], where positive = bullish conviction.',
              color: 'var(--accent)',
            },
            {
              step: '2',
              title: 'Expected Move Mapping',
              desc: 'The composite score is mapped to an expected 30-day price move using historical volatility and beta-adjusted momentum.',
              color: '#a855f7',
            },
            {
              step: '3',
              title: 'Predicted Price',
              desc: 'Predicted Price = Current Price × (1 + Expected Move%). The direction (bullish/bearish) determines sign.',
              color: '#22c55e',
            },
            {
              step: '4',
              title: 'Confidence',
              desc: 'Signal agreement across all 6 categories. 100% = all factors agree strongly; lower % = mixed signals.',
              color: '#f59e0b',
            },
          ].map(({ step, title, desc, color }) => (
            <div key={step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `${color}18`, border: `1px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color, flexShrink: 0, marginTop: 1,
              }}>
                {step}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8, padding: '12px 16px',
      }}>
        <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>⚠ Disclaimer</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Predicted prices and scores are for informational purposes only and do not constitute financial advice.
          Past performance of the scoring model does not guarantee future results. Always perform your own due diligence.
        </div>
      </div>

    </div>
  )
}
