import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmt(v, d = 2) { return v == null ? '—' : Number(v).toFixed(d) }

function ScoreBar({ label, score, color, description }) {
  const s = Math.max(-1, Math.min(1, score ?? 0))
  // Map -1..+1 to 0..100 for bar display
  const pct = ((s + 1) / 2) * 100
  const c = color ?? (s > 0.1 ? '#22c55e' : s < -0.1 ? '#ef4444' : '#f59e0b')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
          {description && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{description}</div>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: c }}>{s >= 0 ? '+' : ''}{s.toFixed(2)}</span>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        {/* Center line */}
        <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: 'var(--surface2)', zIndex: 1 }} />
        {/* Fill from center */}
        <div style={{
          position: 'absolute',
          height: '100%',
          background: c,
          borderRadius: 4,
          transition: 'all .4s',
          ...(s >= 0
            ? { left: '50%', width: `${pct - 50}%` }
            : { left: `${pct}%`, width: `${50 - pct}%` }
          ),
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--muted)' }}>
        <span style={{ color: '#ef4444' }}>-1</span>
        <span>0</span>
        <span style={{ color: '#22c55e' }}>+1</span>
      </div>
    </div>
  )
}

export default function SentimentOverview() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/sentiment/overview/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading sentiment overview for {ticker}...</span>
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

  const composite    = data.composite_score ?? data.sentiment_score ?? data.score ?? 0
  const newsScore    = data.news_score    ?? data.news_sentiment    ?? null
  const analystScore = data.analyst_score ?? data.analyst_sentiment ?? null
  const socialScore  = data.social_score  ?? data.social_sentiment  ?? null
  const fearGreed    = data.fear_greed    ?? data.fear_and_greed    ?? null

  const compColor = composite > 0.1 ? '#22c55e' : composite < -0.1 ? '#ef4444' : '#f59e0b'
  const compLabel = composite > 0.4 ? 'Very Bullish' : composite > 0.1 ? 'Bullish' : composite > -0.1 ? 'Neutral' : composite > -0.4 ? 'Bearish' : 'Very Bearish'

  const components = [
    newsScore    != null ? { label: 'News Sentiment',    score: newsScore,    color: '#3b82f6',  description: 'NLP analysis of recent news articles' } : null,
    analystScore != null ? { label: 'Analyst Sentiment', score: analystScore, color: '#f59e0b',  description: 'Analyst recommendations & upgrades/downgrades' } : null,
    socialScore  != null ? { label: 'Social Sentiment',  score: socialScore,  color: '#ec4899',  description: 'Social media signals and retail sentiment' } : null,
  ].filter(Boolean)

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        💬 Sentiment Overview — {ticker}
      </h2>

      {/* Composite score */}
      <div className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
          Composite Sentiment Score
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, color: compColor, lineHeight: 1 }}>
          {composite >= 0 ? '+' : ''}{fmt(composite, 2)}
        </div>
        <span style={{
          display: 'inline-block', marginTop: 12,
          background: `${compColor}18`, border: `1px solid ${compColor}33`,
          color: compColor, fontSize: 14, fontWeight: 700,
          padding: '5px 20px', borderRadius: 20,
        }}>
          {compLabel}
        </span>

        {/* Wide gauge bar */}
        <div style={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden', margin: '20px auto 0', maxWidth: 480,
          background: 'linear-gradient(to right, #ef4444, #94a3b8 50%, #22c55e)',
          border: '1px solid var(--border)' }}>
          <div style={{
            position: 'absolute', top: -1,
            left: `${((composite + 1) / 2) * 100}%`, transform: 'translateX(-50%)',
            width: 5, height: 14, background: '#fff', borderRadius: 3,
            boxShadow: '0 0 6px rgba(255,255,255,0.5)', transition: 'left .5s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--muted)', maxWidth: 480, margin: '6px auto 0' }}>
          <span style={{ color: '#ef4444' }}>Very Bearish (-1)</span>
          <span>Neutral (0)</span>
          <span style={{ color: '#22c55e' }}>Very Bullish (+1)</span>
        </div>
      </div>

      {/* Component scores */}
      {components.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-title">Sentiment Components</div>
          {components.map(comp => (
            <ScoreBar key={comp.label} {...comp} />
          ))}
        </div>
      )}

      {/* Fear & Greed */}
      {fearGreed != null && (
        <div className="card">
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Fear & Greed Index
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              fontSize: 40, fontWeight: 800,
              color: fearGreed >= 60 ? '#22c55e' : fearGreed >= 40 ? '#f59e0b' : '#ef4444',
            }}>
              {Math.round(fearGreed)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {fearGreed >= 75 ? 'Extreme Greed' : fearGreed >= 60 ? 'Greed' : fearGreed >= 40 ? 'Neutral' : fearGreed >= 25 ? 'Fear' : 'Extreme Fear'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Market sentiment gauge (0-100)</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${fearGreed}%`, height: '100%', borderRadius: 4, transition: 'width .5s',
                  background: `linear-gradient(to right, #ef4444, #f59e0b 50%, #22c55e)`,
                }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {data.article_count != null && (
        <div className="card-grid-4">
          {[
            { label: 'Articles Analyzed', value: data.article_count ?? '—', color: '#3b82f6' },
            { label: 'Analyst Coverage',  value: data.analyst_count ?? '—', color: '#f59e0b' },
            { label: 'Positive Signals',  value: data.positive_count ?? '—', color: '#22c55e' },
            { label: 'Negative Signals',  value: data.negative_count ?? '—', color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card card-sm" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
