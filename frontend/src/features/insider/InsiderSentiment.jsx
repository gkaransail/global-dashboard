import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtMoney(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function SentimentGauge({ score }) {
  // score: -1 to +1
  const clamped = Math.max(-1, Math.min(1, score ?? 0))
  const pct = ((clamped + 1) / 2) * 100  // 0–100% across the bar
  const color = clamped > 0.2 ? '#22c55e' : clamped < -0.2 ? '#ef4444' : '#f59e0b'
  const label = clamped > 0.5 ? 'Very Bullish'
               : clamped > 0.2 ? 'Bullish'
               : clamped > -0.2 ? 'Neutral'
               : clamped > -0.5 ? 'Bearish'
               : 'Very Bearish'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        Insider Sentiment Score
      </div>
      <div style={{ fontSize: 64, fontWeight: 800, color, lineHeight: 1 }}>
        {clamped >= 0 ? '+' : ''}{clamped.toFixed(2)}
      </div>
      <span style={{
        background: `${color}18`, border: `1px solid ${color}44`,
        color, fontSize: 13, fontWeight: 700,
        padding: '4px 16px', borderRadius: 20,
      }}>
        {label}
      </span>
      {/* Gauge bar */}
      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
        {/* Track */}
        <div style={{
          height: 12, borderRadius: 6, overflow: 'hidden',
          background: 'linear-gradient(to right, #ef4444, #f59e0b 50%, #22c55e)',
          border: '1px solid var(--border)',
        }} />
        {/* Needle */}
        <div style={{
          position: 'absolute', top: -3, left: `${pct}%`,
          transform: 'translateX(-50%)',
          width: 4, height: 18, background: '#fff', borderRadius: 2,
          boxShadow: '0 0 6px rgba(255,255,255,0.4)',
          transition: 'left .5s',
        }} />
        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 10, color: '#ef4444' }}>Very Bearish (-1)</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Neutral (0)</span>
          <span style={{ fontSize: 10, color: '#22c55e' }}>Very Bullish (+1)</span>
        </div>
      </div>
    </div>
  )
}

export default function InsiderSentiment() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/insider/sentiment/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Calculating insider sentiment for {ticker}...</span>
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

  const score = data.sentiment_score ?? data.score ?? 0
  const buyCount  = data.buy_count  ?? data.buys  ?? 0
  const sellCount = data.sell_count ?? data.sells ?? 0
  const buyValue  = data.buy_value  ?? 0
  const sellValue = data.sell_value ?? 0
  const netValue  = data.net_value  ?? (buyValue - sellValue)
  const isCluster = data.cluster_buy ?? (buyCount >= 3)
  const recentBias = data.recent_bias ?? data.bias ?? null

  const netColor = netValue > 0 ? '#22c55e' : netValue < 0 ? '#ef4444' : '#94a3b8'

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        🎯 Insider Sentiment — {ticker}
      </h2>

      {/* Gauge */}
      <div className="card">
        <SentimentGauge score={score} />
      </div>

      {/* Key metrics */}
      <div className="card-grid-4">
        {[
          { label: 'Buy Transactions', value: buyCount, color: '#22c55e' },
          { label: 'Sell Transactions', value: sellCount, color: '#ef4444' },
          { label: 'Total Buy Value',  value: fmtMoney(buyValue),  color: '#22c55e' },
          { label: 'Total Sell Value', value: fmtMoney(sellValue), color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card card-sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              {label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Net value + signals */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            Net Insider Value
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: netColor }}>
            {fmtMoney(netValue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {netValue > 0 ? 'Net buying pressure from insiders' : netValue < 0 ? 'Net selling pressure from insiders' : 'Neutral insider activity'}
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Signal Indicators
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Cluster Buy Signal</span>
              <span style={{
                background: isCluster ? 'rgba(34,197,94,0.12)' : 'var(--surface2)',
                border: `1px solid ${isCluster ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                color: isCluster ? '#22c55e' : 'var(--muted)',
                fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
              }}>
                {isCluster ? '⚡ Active (3+ insiders)' : 'Not Detected'}
              </span>
            </div>
            {recentBias && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Recent Bias</span>
                <span style={{
                  background: recentBias === 'bullish' ? 'rgba(34,197,94,0.12)' : recentBias === 'bearish' ? 'rgba(239,68,68,0.12)' : 'var(--surface2)',
                  border: `1px solid ${recentBias === 'bullish' ? 'rgba(34,197,94,0.3)' : recentBias === 'bearish' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                  color: recentBias === 'bullish' ? '#22c55e' : recentBias === 'bearish' ? '#ef4444' : 'var(--muted)',
                  fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, textTransform: 'capitalize',
                }}>
                  {recentBias}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Buy/Sell Ratio</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: buyCount > sellCount ? '#22c55e' : '#ef4444' }}>
                {sellCount === 0 ? '∞' : (buyCount / sellCount).toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div style={{
        background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)',
        borderRadius: 8, padding: '12px 16px',
      }}>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>ℹ How Insider Sentiment Works</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          Insider sentiment is calculated from SEC Form 4 filings. Scores weight cluster buys (3+ insiders
          buying simultaneously) heavily, as these historically precede significant price moves. Net value
          accounts for the dollar magnitude of transactions, not just counts.
        </div>
      </div>

    </div>
  )
}
