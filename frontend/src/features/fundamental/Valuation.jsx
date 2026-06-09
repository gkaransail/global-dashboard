import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtNum(v, d = 2) { return v == null ? '—' : Number(v).toFixed(d) }

// Valuation benchmarks for cheap/fair/expensive classification
const METRIC_RANGES = {
  pe:         { cheap: [0, 15],   fair: [15, 25],  expensive: [25, Infinity] },
  forward_pe: { cheap: [0, 14],   fair: [14, 22],  expensive: [22, Infinity] },
  peg:        { cheap: [0, 1],    fair: [1, 2],    expensive: [2, Infinity] },
  ps:         { cheap: [0, 2],    fair: [2, 5],    expensive: [5, Infinity] },
  pb:         { cheap: [0, 1.5],  fair: [1.5, 3],  expensive: [3, Infinity] },
  ev_ebitda:  { cheap: [0, 10],   fair: [10, 18],  expensive: [18, Infinity] },
}

function classify(key, value) {
  if (value == null || isNaN(value) || value <= 0) return 'neutral'
  const ranges = METRIC_RANGES[key]
  if (!ranges) return 'neutral'
  if (value >= ranges.expensive[0]) return 'expensive'
  if (value >= ranges.fair[0]) return 'fair'
  return 'cheap'
}

const CLASS_STYLE = {
  cheap:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',  label: 'Cheap' },
  fair:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)', label: 'Fair' },
  expensive: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',  label: 'Expensive' },
  neutral:   { color: '#94a3b8', bg: 'var(--surface2)',        border: 'var(--border)',         label: 'N/A' },
}

const METRIC_DEFS = [
  { key: 'pe',        label: 'P/E Ratio',       description: 'Price / Earnings (TTM). <15 historically cheap; >25 expensive.',          paths: ['pe_ratio', 'trailingPE', 'pe'] },
  { key: 'forward_pe',label: 'Forward P/E',     description: 'Price / Forward Earnings. Based on next-year analyst estimates.',         paths: ['forward_pe', 'forwardPE', 'forward_pe_ratio'] },
  { key: 'peg',       label: 'PEG Ratio',       description: 'P/E / EPS Growth Rate. <1 suggests undervalued relative to growth.',     paths: ['peg_ratio', 'pegRatio', 'peg'] },
  { key: 'ps',        label: 'P/S Ratio',       description: 'Price / Sales. Useful for growth companies without earnings.',           paths: ['price_to_sales', 'priceToSalesTrailing12Months', 'ps'] },
  { key: 'pb',        label: 'P/B Ratio',       description: 'Price / Book Value. <1 means stock trades below asset value.',           paths: ['price_to_book', 'priceToBook', 'pb'] },
  { key: 'ev_ebitda', label: 'EV/EBITDA',       description: 'Enterprise Value / EBITDA. Capital-structure-neutral profitability.',    paths: ['ev_to_ebitda', 'enterpriseToEbitda', 'ev_ebitda'] },
]

function getValue(info, paths) {
  for (const p of paths) {
    if (info[p] != null && !isNaN(info[p])) return Number(info[p])
  }
  return null
}

export default function Valuation() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/fundamental/overview/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading valuation metrics for {ticker}...</span>
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

  const info = data.info ?? data.stock_info ?? data

  const metrics = METRIC_DEFS.map(def => {
    const value = getValue(info, def.paths)
    const cls   = classify(def.key, value)
    const style = CLASS_STYLE[cls]
    return { ...def, value, cls, style }
  })

  const cheapCount     = metrics.filter(m => m.cls === 'cheap').length
  const expensiveCount = metrics.filter(m => m.cls === 'expensive').length
  const fairCount      = metrics.filter(m => m.cls === 'fair').length
  const availCount     = metrics.filter(m => m.cls !== 'neutral').length

  const overallColor = cheapCount > expensiveCount ? '#22c55e' : expensiveCount > cheapCount ? '#ef4444' : '#f59e0b'
  const overallLabel = cheapCount > expensiveCount ? 'Undervalued' : expensiveCount > cheapCount ? 'Overvalued' : 'Fairly Valued'

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          💲 Valuation — {ticker}
        </h2>
        {availCount > 0 && (
          <span style={{
            background: `${overallColor}18`, border: `1px solid ${overallColor}33`,
            color: overallColor, fontSize: 11, fontWeight: 700,
            padding: '3px 12px', borderRadius: 20, marginLeft: 'auto',
          }}>
            {overallLabel}
          </span>
        )}
      </div>

      {/* Summary badges */}
      {availCount > 0 && (
        <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Cheap', count: cheapCount,     color: '#22c55e' },
            { label: 'Fair',  count: fairCount,      color: '#f59e0b' },
            { label: 'Expensive', count: expensiveCount, color: '#ef4444' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {metrics.map(({ key, label, description, value, style }) => (
          <div key={key} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{description}</div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: value != null ? style.color : 'var(--muted)' }}>
                {fmtNum(value, value != null && value < 10 ? 2 : 1)}
              </div>
              <span style={{
                display: 'inline-block', marginTop: 4,
                background: style.bg, border: `1px solid ${style.border}`,
                color: style.color, fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {style.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer note */}
      <div style={{
        background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)',
        borderRadius: 8, padding: '10px 14px', fontSize: 11, color: 'var(--muted)',
      }}>
        ℹ Valuation thresholds are based on broad market historical averages and may vary significantly by sector.
        Growth stocks and technology companies often trade at higher multiples.
      </div>
    </div>
  )
}
