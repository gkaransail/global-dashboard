import { useState, useEffect } from 'react'
import { api } from '../../core/api'

const SCORING_WEIGHTS = [
  { key: 'options',      label: 'Options Flow',    weight: '30%', color: '#3b82f6', highlight: true },
  { key: 'insider',      label: 'Insider Trading', weight: '25%', color: '#f59e0b', highlight: true },
  { key: 'technical',    label: 'Technical',       weight: '20%', color: '#22c55e', highlight: false },
  { key: 'fundamental',  label: 'Fundamental',     weight: '15%', color: '#a855f7', highlight: false },
  { key: 'sentiment',    label: 'Sentiment',       weight: '5%',  color: '#ec4899', highlight: false },
  { key: 'macro',        label: 'Macro',           weight: '5%',  color: '#94a3b8', highlight: false },
]

const CAT_COLORS = {
  options:     '#3b82f6',
  insider:     '#f59e0b',
  technical:   '#22c55e',
  fundamental: '#a855f7',
  sentiment:   '#ec4899',
  macro:       '#94a3b8',
}

function fmt2(v) { return v == null ? '—' : Number(v).toFixed(2) }
function fmtPrice(v) { return v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function CategoryScoreBars({ scores }) {
  if (!scores) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      {SCORING_WEIGHTS.map(({ key, label, color }) => {
        const val = scores[key] ?? 0
        const pct = Math.min(100, Math.round(val * 100))
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--muted)', width: 60, textTransform: 'uppercase', letterSpacing: '.4px', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
            </div>
            <span style={{ fontSize: 9, color: color, width: 26, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

function StockCard({ stock, rank }) {
  const isBull = stock.direction === 'bullish'
  const dirColor = isBull ? '#22c55e' : '#ef4444'
  const dirBg    = isBull ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
  const dirBorder= isBull ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'
  const confPct  = Math.round((stock.confidence ?? 0) * 100)
  const changePct = stock.predicted_change_pct ?? 0
  const changeStr = changePct >= 0 ? `+${changePct.toFixed(1)}%` : `${changePct.toFixed(1)}%`

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${dirBorder}`,
      borderLeft: `3px solid ${dirColor}`,
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      transition: 'border-color .15s',
    }}>
      {/* Rank + ticker row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--surface2)', color: 'var(--muted)',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {rank}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
          {stock.ticker}
        </span>
        <span style={{
          marginLeft: 'auto',
          background: dirBg,
          border: `1px solid ${dirBorder}`,
          color: dirColor,
          fontSize: 9, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20,
          textTransform: 'uppercase', letterSpacing: '.5px',
        }}>
          {isBull ? '🟢 BULLISH' : '🔴 BEARISH'}
        </span>
      </div>

      {/* Prices row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Current: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtPrice(stock.current_price)}</span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>→</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: dirColor, lineHeight: 1 }}>
            {fmtPrice(stock.predicted_price)}
          </div>
          <div style={{ fontSize: 11, color: dirColor, marginTop: 1 }}>
            {changeStr} · 30-day target
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Confidence</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: dirColor }}>{confPct}%</span>
        </div>
        <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${confPct}%`, height: '100%', background: dirColor, borderRadius: 3, transition: 'width .5s' }} />
        </div>
      </div>

      {/* Category score mini-bars */}
      <CategoryScoreBars scores={stock.category_scores} />

      {/* Key signals */}
      {stock.key_signals && stock.key_signals.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
          {stock.key_signals.slice(0, 3).map((sig, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
              <span style={{ color: dirColor, fontSize: 10, marginTop: 1, flexShrink: 0 }}>•</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{sig}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StockColumn({ title, stocks, dirColor, emptyMsg }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 12, paddingBottom: 10,
        borderBottom: `2px solid ${dirColor}`,
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: dirColor }}>{title}</span>
        <span style={{
          background: `${dirColor}18`, border: `1px solid ${dirColor}33`,
          color: dirColor, fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20,
        }}>
          {stocks.length} stocks
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stocks.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            {emptyMsg}
          </div>
        ) : (
          stocks.map((stock, i) => (
            <StockCard key={stock.ticker} stock={stock} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  )
}

export default function Top10Dashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => { fetchData(false) }, [])

  async function fetchData(forceRefresh) {
    setLoading(true)
    setError(null)
    try {
      const url = forceRefresh
        ? '/dashboard/top10?force_refresh=true'
        : '/dashboard/top10'
      const d = await api.get(url)
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 20 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <div className="spinner" style={{ width: 56, height: 56, borderWidth: 4 }} />
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 20 }}>🏆</span>
        </div>
        <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600 }}>Scanning 50 stocks across 6 factors...</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Analyzing options flow · insider activity · technicals · fundamentals · sentiment · macro
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {SCORING_WEIGHTS.map(({ key, label, color }) => (
            <span key={key} style={{
              background: `${color}18`, border: `1px solid ${color}33`,
              color, fontSize: 10, fontWeight: 600,
              padding: '3px 10px', borderRadius: 20,
            }}>
              {label}
            </span>
          ))}
        </div>
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

  const bullish = data.bullish ?? []
  const bearish = data.bearish ?? []
  const scanTime = data.scan_time ? new Date(data.scan_time).toLocaleString() : '—'
  const stocksScanned = data.stocks_scanned ?? '—'

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            🏆 Top 10 Stocks — Multi-Factor AI Scoring
          </h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Last scan: {scanTime} · {stocksScanned} stocks analyzed
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Scoring weight badges */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 16px',
      }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
          Scoring Weights
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SCORING_WEIGHTS.map(({ key, label, weight, color, highlight }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: highlight ? `${color}18` : 'var(--surface2)',
              border: `1px solid ${highlight ? `${color}44` : 'var(--border)'}`,
              borderRadius: 20, padding: '4px 12px',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: highlight ? color : 'var(--muted)', fontWeight: highlight ? 700 : 500 }}>
                {label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: highlight ? color : 'var(--text)',
                marginLeft: 2,
              }}>
                {weight}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <StockColumn
          title="Top 10 Bullish"
          stocks={bullish}
          dirColor="#22c55e"
          emptyMsg="No bullish stocks found in current scan."
        />
        <StockColumn
          title="Top 10 Bearish"
          stocks={bearish}
          dirColor="#ef4444"
          emptyMsg="No bearish stocks found in current scan."
        />
      </div>
    </div>
  )
}
