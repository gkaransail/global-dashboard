import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtMoney(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`
  return `$${abs.toFixed(0)}`
}

function fmtNum(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('en-US')
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${Number(v).toFixed(2)}%`
}

function ConvictionScore({ holders }) {
  if (!holders || holders.length === 0) return null
  // Simple concentration metric: % held by top 5
  const top5Pct = holders.slice(0, 5).reduce((sum, h) => sum + (h.pct_of_float ?? h.percent_out ?? 0), 0)
  const score = Math.min(100, Math.round(top5Pct * 2))
  const label = score > 70 ? 'Very High' : score > 50 ? 'High' : score > 30 ? 'Moderate' : 'Low'
  const color = score > 70 ? '#22c55e' : score > 50 ? '#f59e0b' : score > 30 ? '#3b82f6' : '#94a3b8'

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
        Institutional Conviction (Top-5 Concentration)
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <span style={{
        background: `${color}18`, border: `1px solid ${color}33`,
        color, fontSize: 12, fontWeight: 700,
        padding: '3px 14px', borderRadius: 20, display: 'inline-block', marginTop: 8,
      }}>
        {label} Conviction
      </span>
      <div style={{ marginTop: 12, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', maxWidth: 240, margin: '12px auto 0' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .5s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        Top 5 holders own ~{top5Pct.toFixed(1)}% of float
      </div>
    </div>
  )
}

export default function SmartMoneyInstitutional() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/smart_money/institutional/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading institutional data for {ticker}...</span>
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

  const holders         = data.institutional_holders ?? data.holders ?? []
  const majorHolders    = data.major_holders ?? {}
  const pctInstitutional = majorHolders.institutional_pct ?? majorHolders.pct_institutional ?? null
  const pctInsider       = majorHolders.insider_pct ?? majorHolders.pct_insider ?? null

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        🏦 Institutional Holdings — {ticker}
      </h2>

      {/* Summary cards */}
      <div className="card-grid-4">
        {[
          { label: '% Institutional', value: fmtPct(pctInstitutional), color: '#3b82f6', icon: '🏦' },
          { label: '% Insider',       value: fmtPct(pctInsider),       color: '#f59e0b', icon: '👔' },
          { label: 'Total Holders',   value: holders.length > 0 ? holders.length : '—', color: '#22c55e', icon: '📋' },
          { label: 'Top Holder',      value: holders[0]?.holder ?? holders[0]?.organization ?? '—', color: '#a855f7', icon: '🥇' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="card card-sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: typeof value === 'number' ? 24 : 14, fontWeight: 700, color, wordBreak: 'break-word' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Conviction score */}
      <ConvictionScore holders={holders} />

      {/* Holders table */}
      {holders.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No institutional holder data available for {ticker}.
        </div>
      ) : (
        <div>
          <div className="section-title">Institutional Holders</div>
          <div className="signals-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['#', 'Holder', 'Shares Held', '% of Float', 'Value', 'Date Reported'].map(col => (
                    <th key={col} style={{
                      padding: '10px 12px', textAlign: col === '#' ? 'center' : 'left',
                      fontSize: 10, color: 'var(--muted)', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '.5px',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holders.map((h, i) => (
                  <tr
                    key={i}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '' }}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                      {h.holder ?? h.organization ?? h.name ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {fmtNum(h.shares ?? h.shares_held)}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                        {fmtPct(h.pct_of_float ?? h.percent_out ?? h.pct_held)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {fmtMoney(h.value)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h.date_reported ?? h.report_date ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
