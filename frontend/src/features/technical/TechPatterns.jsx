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

const PATTERN_ICONS = {
  'Head and Shoulders':         '📉',
  'Inverse Head and Shoulders': '📈',
  'Double Top':                 '🏔',
  'Double Bottom':              '⛰',
  'Cup and Handle':             '☕',
  'Bull Flag':                  '🟢',
  'Bear Flag':                  '🔴',
  'Triangle':                   '📐',
  'Wedge':                      '🔷',
  'Channel':                    '〰',
}

export default function TechPatterns() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/technical/patterns/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Detecting chart patterns for {ticker}...</span>
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

  const patterns = data.patterns ?? []
  const sorted   = [...patterns].sort((a, b) => (b.strength ?? b.confidence ?? 0) - (a.strength ?? a.confidence ?? 0))

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          📐 Chart Patterns — {ticker}
        </h2>
        <span style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          color: 'var(--muted)', fontSize: 11, fontWeight: 600,
          padding: '3px 12px', borderRadius: 20, marginLeft: 'auto',
        }}>
          {sorted.length} pattern{sorted.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          color: 'var(--muted)', fontSize: 13,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No Patterns Detected</div>
          <div>No significant chart patterns found for {ticker} in the current timeframe.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((pat, i) => {
            const dir      = pat.direction ?? pat.type_direction ?? 'neutral'
            const color    = DIR_COLOR[dir] ?? '#94a3b8'
            const icon     = DIR_ICON[dir] ?? '⚪'
            const patIcon  = PATTERN_ICONS[pat.name] ?? '📊'
            const strength = pat.strength ?? pat.confidence ?? pat.reliability ?? 0
            const strPct   = Math.round(strength * 100)

            return (
              <div key={i} style={{
                background: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 10,
                padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${color}18`, border: `1px solid ${color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {patIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{pat.name}</span>
                      <span style={{
                        background: `${color}18`, border: `1px solid ${color}33`,
                        color, fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 20,
                        textTransform: 'uppercase', letterSpacing: '.5px',
                      }}>
                        {icon} {dir}
                      </span>
                      {pat.timeframe && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', padding: '2px 8px', background: 'var(--surface2)', borderRadius: 20 }}>
                          {pat.timeframe}
                        </span>
                      )}
                    </div>

                    {pat.description && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
                        {pat.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)', width: 60, flexShrink: 0 }}>Reliability</span>
                      <div style={{ flex: 1, maxWidth: 200, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${strPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{strPct}%</span>
                    </div>

                    {(pat.target_price != null || pat.stop_loss != null) && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                        {pat.target_price != null && (
                          <div style={{ fontSize: 11 }}>
                            <span style={{ color: 'var(--muted)' }}>Target: </span>
                            <span style={{ color: '#22c55e', fontWeight: 700 }}>${Number(pat.target_price).toFixed(2)}</span>
                          </div>
                        )}
                        {pat.stop_loss != null && (
                          <div style={{ fontSize: 11 }}>
                            <span style={{ color: 'var(--muted)' }}>Stop: </span>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>${Number(pat.stop_loss).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
