import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

const DIR_COLOR = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#94a3b8',
}

const DIR_ICON = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '⚪',
}

export default function SmartMoneySignals() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/smart_money/signals/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading smart money signals for {ticker}...</span>
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

  const signals = data.signals ?? []
  const sorted  = [...signals].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
  const overall = data.overall_direction ?? data.direction ?? null
  const overallScore = data.composite_score ?? data.score ?? null

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          🌊 Smart Money Signals — {ticker}
        </h2>
        {overall && (
          <span style={{
            background: `${DIR_COLOR[overall] ?? '#94a3b8'}18`,
            border: `1px solid ${DIR_COLOR[overall] ?? '#94a3b8'}33`,
            color: DIR_COLOR[overall] ?? '#94a3b8',
            fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, marginLeft: 'auto',
          }}>
            {DIR_ICON[overall] ?? '⚪'} Overall: {overall.toUpperCase()}
          </span>
        )}
      </div>

      {/* Overall score */}
      {overallScore != null && (
        <div className="card">
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                Smart Money Composite Score
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, color: DIR_COLOR[overall] ?? '#94a3b8', lineHeight: 1 }}>
                {Number(overallScore).toFixed(2)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.abs(overallScore) * 100)}%`,
                  height: '100%',
                  background: DIR_COLOR[overall] ?? '#94a3b8',
                  borderRadius: 4, transition: 'width .5s',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {sorted.length} signal{sorted.length !== 1 ? 's' : ''} detected
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signals */}
      {sorted.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No smart money signals detected for {ticker}.
        </div>
      ) : (
        <div className="signals-panel">
          <div className="signals-panel-header">
            {sorted.length} Signal{sorted.length !== 1 ? 's' : ''} Detected
          </div>
          {sorted.map((sig, i) => {
            const dir   = sig.direction ?? 'neutral'
            const color = DIR_COLOR[dir] ?? '#94a3b8'
            const icon  = DIR_ICON[dir] ?? '⚪'
            const strPct = Math.round((sig.strength ?? 0) * 100)

            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '8px 1fr auto',
                gap: 12,
                padding: '14px 16px',
                borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'start',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, marginTop: 5, flexShrink: 0,
                }} />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {icon} {sig.name}
                    </span>
                    <span style={{
                      background: `${color}18`, border: `1px solid ${color}33`,
                      color, fontSize: 9, fontWeight: 700,
                      padding: '1px 8px', borderRadius: 20,
                      textTransform: 'uppercase', letterSpacing: '.5px',
                    }}>
                      {dir}
                    </span>
                    {sig.category && <span className="signal-cat">{sig.category}</span>}
                  </div>

                  {sig.explanation && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>
                      {sig.explanation}
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', width: 52, flexShrink: 0 }}>Strength</span>
                    <div style={{ flex: 1, maxWidth: 160, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${strPct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{strPct}%</span>
                  </div>
                </div>

                {sig.value != null && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {sig.value}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
