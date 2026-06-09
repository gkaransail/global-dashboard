import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtNum(v, d = 2) { return v == null ? '—' : Number(v).toFixed(d) }

const CONSENSUS_MAP = {
  strongBuy:  { label: 'Strong Buy',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)' },
  buy:        { label: 'Buy',         color: '#86efac', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.18)' },
  hold:       { label: 'Hold',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  sell:       { label: 'Sell',        color: '#f87171', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.18)' },
  strongSell: { label: 'Strong Sell', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)' },
}

function normalizeConsensus(raw) {
  if (!raw) return null
  const r = raw.toLowerCase().replace(/[_\s]/g, '')
  if (r === 'strongbuy')  return 'strongBuy'
  if (r === 'buy')        return 'buy'
  if (r === 'hold' || r === 'neutral') return 'hold'
  if (r === 'sell')       return 'sell'
  if (r === 'strongsell') return 'strongSell'
  return null
}

export default function AnalystRatings() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/sentiment/analysts/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading analyst ratings for {ticker}...</span>
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

  const strongBuy  = data.strong_buy  ?? data.strongBuy  ?? 0
  const buy        = data.buy         ?? 0
  const hold       = data.hold        ?? 0
  const sell       = data.sell        ?? 0
  const strongSell = data.strong_sell ?? data.strongSell ?? 0
  const total      = strongBuy + buy + hold + sell + strongSell || 1

  const currentPrice  = data.current_price  ?? data.price
  const analystTarget = data.target_mean    ?? data.analyst_target ?? data.targetMeanPrice ?? data.target_price
  const targetHigh    = data.target_high    ?? data.targetHighPrice
  const targetLow     = data.target_low     ?? data.targetLowPrice

  const consensusRaw  = data.consensus ?? data.recommendation ?? data.analyst_consensus
  const consensusKey  = normalizeConsensus(consensusRaw)
  const consensusStyle = consensusKey ? CONSENSUS_MAP[consensusKey] : CONSENSUS_MAP['hold']

  const upside = (analystTarget && currentPrice && currentPrice > 0)
    ? ((analystTarget - currentPrice) / currentPrice) * 100 : null

  const bars = [
    { label: 'Strong Buy',  count: strongBuy,  color: '#22c55e' },
    { label: 'Buy',         count: buy,         color: '#86efac' },
    { label: 'Hold',        count: hold,        color: '#f59e0b' },
    { label: 'Sell',        count: sell,        color: '#f87171' },
    { label: 'Strong Sell', count: strongSell,  color: '#ef4444' },
  ]

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          ⭐ Analyst Ratings — {ticker}
        </h2>
        {consensusKey && (
          <span style={{
            background: consensusStyle.bg, border: `1px solid ${consensusStyle.border}`,
            color: consensusStyle.color, fontSize: 11, fontWeight: 700,
            padding: '3px 14px', borderRadius: 20, marginLeft: 'auto',
          }}>
            Consensus: {consensusStyle.label}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* Distribution bar chart */}
        <div className="card" style={{ flex: 2, minWidth: 260 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16 }}>
            Rating Distribution ({total} analysts)
          </div>

          {/* Horizontal stacked bar */}
          <div style={{ height: 20, display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--border)' }}>
            {bars.map(({ label, count, color }) => {
              const pct = (count / total) * 100
              if (pct <= 0) return null
              return (
                <div
                  key={label}
                  style={{ width: `${pct}%`, background: color, transition: 'width .4s' }}
                  title={`${label}: ${count} (${pct.toFixed(1)}%)`}
                />
              )
            })}
          </div>

          {/* Individual bars */}
          {bars.map(({ label, count, color }) => {
            const pct = Math.round((count / total) * 100)
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', width: 88, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>
                  {count} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>

        {/* Price target box */}
        {(analystTarget != null || currentPrice != null) && (
          <div className="card" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Price Targets
            </div>

            {currentPrice != null && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Current Price</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>${fmtNum(currentPrice, 2)}</div>
              </div>
            )}

            {analystTarget != null && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mean Target</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: upside >= 0 ? '#22c55e' : '#ef4444' }}>
                  ${fmtNum(analystTarget, 2)}
                </div>
                {upside != null && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: upside >= 0 ? '#22c55e' : '#ef4444' }}>
                    {upside >= 0 ? '+' : ''}{fmtNum(upside, 1)}% upside
                  </div>
                )}
              </div>
            )}

            {(targetHigh != null || targetLow != null) && (
              <div style={{ display: 'flex', gap: 12 }}>
                {targetHigh != null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>High</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>${fmtNum(targetHigh, 2)}</div>
                  </div>
                )}
                {targetLow != null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Low</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>${fmtNum(targetLow, 2)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Range bar */}
            {currentPrice != null && analystTarget != null && targetHigh != null && targetLow != null && (
              <div>
                <div style={{ position: 'relative', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'visible' }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(to right, #ef4444, #22c55e)',
                    borderRadius: 4, opacity: 0.5,
                    position: 'absolute', inset: 0,
                  }} />
                  {/* Current price marker */}
                  {(() => {
                    const range = targetHigh - targetLow || 1
                    const pos = Math.max(0, Math.min(100, ((currentPrice - targetLow) / range) * 100))
                    return (
                      <div style={{
                        position: 'absolute', top: -2, left: `${pos}%`, transform: 'translateX(-50%)',
                        width: 4, height: 12, background: '#3b82f6', borderRadius: 2,
                        border: '1px solid #fff',
                      }} />
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
                  <span style={{ color: '#ef4444' }}>Low</span>
                  <span style={{ color: '#3b82f6' }}>Current</span>
                  <span style={{ color: '#22c55e' }}>High</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
