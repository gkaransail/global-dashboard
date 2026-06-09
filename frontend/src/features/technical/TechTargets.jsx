import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtPrice(v) { return v == null ? '—' : `$${Number(v).toFixed(2)}` }

function PriceLadder({ currentPrice, resistanceLevels, supportLevels, bullTarget, bearTarget, fibLevels }) {
  // Collect all prices and sort to determine SVG range
  const allPrices = [
    currentPrice,
    ...(resistanceLevels || []).map(r => r.price ?? r),
    ...(supportLevels || []).map(s => s.price ?? s),
    bullTarget,
    bearTarget,
    ...(fibLevels || []).map(f => f.price ?? f),
  ].filter(v => v != null && !isNaN(v))

  if (allPrices.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        No price level data available.
      </div>
    )
  }

  const maxP = Math.max(...allPrices) * 1.02
  const minP = Math.min(...allPrices) * 0.98
  const range = maxP - minP || 1

  const CHART_H = 420
  const CHART_W = 340
  const PAD_L = 10, PAD_R = 160, PAD_T = 20, PAD_B = 20

  function yOf(price) {
    return PAD_T + ((maxP - price) / range) * (CHART_H - PAD_T - PAD_B)
  }

  const cx = PAD_L + 40  // center x of vertical bar
  const barW = 16

  return (
    <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
      <svg width={CHART_W} height={CHART_H} style={{ fontFamily: 'inherit' }}>
        {/* Vertical price bar */}
        <rect x={cx} y={PAD_T} width={barW} height={CHART_H - PAD_T - PAD_B} fill="var(--surface2)" rx={4} />

        {/* Bull target */}
        {bullTarget != null && (() => {
          const y = yOf(bullTarget)
          return (
            <g>
              <line x1={cx + barW} y1={y} x2={cx + barW + 20} y2={y} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={cx + barW + 24} y={y + 4} fill="#22c55e" fontSize={11} fontWeight={700}>▲ Bull Target: {fmtPrice(bullTarget)}</text>
            </g>
          )
        })()}

        {/* Bear target */}
        {bearTarget != null && (() => {
          const y = yOf(bearTarget)
          return (
            <g>
              <line x1={cx + barW} y1={y} x2={cx + barW + 20} y2={y} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={cx + barW + 24} y={y + 4} fill="#ef4444" fontSize={11} fontWeight={700}>▼ Bear Target: {fmtPrice(bearTarget)}</text>
            </g>
          )
        })()}

        {/* Resistance levels */}
        {(resistanceLevels || []).map((r, i) => {
          const price = r.price ?? r
          const label = r.label ?? `R${i + 1}`
          const y = yOf(price)
          return (
            <g key={`r-${i}`}>
              <line x1={cx} y1={y} x2={cx + barW} y2={y} stroke="#ef4444" strokeWidth={2} />
              <line x1={PAD_L} y1={y} x2={cx} y2={y} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,3" />
              <text x={PAD_L} y={y - 3} fill="#ef4444" fontSize={9} fontWeight={600}>{label}</text>
              <text x={cx + barW + 6} y={y + 4} fill="#ef4444" fontSize={10}>{fmtPrice(price)}</text>
            </g>
          )
        })}

        {/* Support levels */}
        {(supportLevels || []).map((s, i) => {
          const price = s.price ?? s
          const label = s.label ?? `S${i + 1}`
          const y = yOf(price)
          return (
            <g key={`s-${i}`}>
              <line x1={cx} y1={y} x2={cx + barW} y2={y} stroke="#22c55e" strokeWidth={2} />
              <line x1={PAD_L} y1={y} x2={cx} y2={y} stroke="#22c55e" strokeWidth={1} strokeDasharray="3,3" />
              <text x={PAD_L} y={y - 3} fill="#22c55e" fontSize={9} fontWeight={600}>{label}</text>
              <text x={cx + barW + 6} y={y + 4} fill="#22c55e" fontSize={10}>{fmtPrice(price)}</text>
            </g>
          )
        })}

        {/* Fibonacci levels */}
        {(fibLevels || []).map((f, i) => {
          const price = f.price ?? f
          const label = f.label ?? `Fib ${f.level ?? i}`
          const y = yOf(price)
          return (
            <g key={`fib-${i}`}>
              <line x1={cx + barW / 2 - 3} y1={y} x2={cx + barW / 2 + 3} y2={y} stroke="#a855f7" strokeWidth={1.5} />
              <text x={cx + barW + 6} y={y + 4} fill="#a855f7" fontSize={9}>{label}: {fmtPrice(price)}</text>
            </g>
          )
        })}

        {/* Current price — prominent */}
        {currentPrice != null && (() => {
          const y = yOf(currentPrice)
          return (
            <g>
              <rect x={cx - 2} y={y - 9} width={barW + 4} height={18} fill="#3b82f6" rx={3} />
              <line x1={PAD_L} y1={y} x2={cx - 2} y2={y} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={cx + barW + 24} y={y + 5} fill="#3b82f6" fontSize={12} fontWeight={800}>● {fmtPrice(currentPrice)}</text>
              <text x={cx + barW + 24} y={y + 17} fill="#94a3b8" fontSize={9}>Current Price</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

export default function TechTargets() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/technical/targets/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading price targets for {ticker}...</span>
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

  const currentPrice    = data.current_price ?? data.price
  const resistanceLevels = data.resistance_levels ?? data.resistance ?? []
  const supportLevels    = data.support_levels   ?? data.support    ?? []
  const bullTarget       = data.bull_target ?? data.upside_target
  const bearTarget       = data.bear_target ?? data.downside_target
  const fibLevels        = data.fibonacci_levels ?? data.fib_levels ?? []

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          🎯 Price Targets — {ticker}
        </h2>
        {currentPrice && (
          <span style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>
            {fmtPrice(currentPrice)}
          </span>
        )}
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Bull Target', value: fmtPrice(bullTarget), color: '#22c55e', icon: '▲' },
          { label: 'Bear Target', value: fmtPrice(bearTarget), color: '#ef4444', icon: '▼' },
          { label: 'Resistance Levels', value: resistanceLevels.length, color: '#ef4444', icon: '🔴' },
          { label: 'Support Levels',    value: supportLevels.length,    color: '#22c55e', icon: '🟢' },
          { label: 'Fib Levels',        value: fibLevels.length,        color: '#a855f7', icon: '📐' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="card card-sm" style={{ minWidth: 100, textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Price ladder visualization */}
      <div className="card">
        <div className="section-title">Price Level Map</div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <PriceLadder
            currentPrice={currentPrice}
            resistanceLevels={resistanceLevels}
            supportLevels={supportLevels}
            bullTarget={bullTarget}
            bearTarget={bearTarget}
            fibLevels={fibLevels}
          />
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20, minWidth: 180 }}>
            {[
              { color: '#3b82f6', label: '● Current Price', dashed: false },
              { color: '#22c55e', label: '▲ Bull Target / Support', dashed: true },
              { color: '#ef4444', label: '▼ Bear Target / Resistance', dashed: true },
              { color: '#a855f7', label: '│ Fibonacci Level', dashed: false },
            ].map(({ color, label, dashed }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 24, height: 2,
                  background: dashed ? `repeating-linear-gradient(90deg, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)` : color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed level tables */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {resistanceLevels.length > 0 && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="section-title">Resistance Levels</div>
            <div className="signals-panel">
              {resistanceLevels.map((r, i) => {
                const price = r.price ?? r
                const label = r.label ?? `R${i + 1}`
                const strength = r.strength ?? r.volume_node ?? null
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < resistanceLevels.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{fmtPrice(price)}</span>
                    {strength != null && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{typeof strength === 'number' ? `${Math.round(strength * 100)}%` : strength}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {supportLevels.length > 0 && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="section-title">Support Levels</div>
            <div className="signals-panel">
              {supportLevels.map((s, i) => {
                const price = s.price ?? s
                const label = s.label ?? `S${i + 1}`
                const strength = s.strength ?? s.volume_node ?? null
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < supportLevels.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{fmtPrice(price)}</span>
                    {strength != null && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{typeof strength === 'number' ? `${Math.round(strength * 100)}%` : strength}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Fib levels */}
      {fibLevels.length > 0 && (
        <div>
          <div className="section-title">Fibonacci Retracement Levels</div>
          <div className="card-grid-4">
            {fibLevels.map((f, i) => {
              const price = f.price ?? f
              const level = f.level ?? f.label ?? `${i}`
              return (
                <div key={i} className="card card-sm" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 700, marginBottom: 4 }}>Fib {level}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{fmtPrice(price)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
