import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'
import MarketSnapshot from './MarketSnapshot'

const fmt = (v, d = 2) => v == null ? '—' : Number(v).toFixed(d)
const fmtK = (v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : String(v)

function SummaryBar({ summary, spot }) {
  const { total_call_oi, total_put_oi, total_call_vol, total_put_vol, pc_oi_ratio, atm_iv_pct } = summary
  const pcColor = pc_oi_ratio > 1 ? 'var(--bear)' : 'var(--bull)'
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, padding: '10px 0' }}>
      {[
        { label: 'Spot',         val: `$${fmt(spot)}`,               color: 'var(--text)' },
        { label: 'ATM IV',       val: `${atm_iv_pct ?? '—'}%`,       color: 'var(--accent)' },
        { label: 'P/C OI Ratio', val: fmt(pc_oi_ratio),              color: pcColor },
        { label: 'Call OI',      val: fmtK(total_call_oi),           color: 'var(--bull)' },
        { label: 'Put OI',       val: fmtK(total_put_oi),            color: 'var(--bear)' },
        { label: 'Call Vol',     val: fmtK(total_call_vol),          color: 'var(--bull)' },
        { label: 'Put Vol',      val: fmtK(total_put_vol),           color: 'var(--bear)' },
      ].map(({ label, val, color }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
          <span style={{ fontWeight: 700, color }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

function ChainTable({ calls, puts, spot, showGreeks }) {
  // Merge calls and puts by strike
  const callMap = Object.fromEntries(calls.map(c => [c.strike, c]))
  const putMap  = Object.fromEntries(puts.map(p => [p.strike, p]))
  const strikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])].sort((a,b) => a-b)

  const itmCallBg  = 'rgba(34,197,94,0.06)'
  const itmPutBg   = 'rgba(239,68,68,0.06)'
  const atmBorder  = '1px solid var(--accent)'

  const callCols  = showGreeks
    ? ['volume','oi','last','bid','ask','iv_pct','delta','theta']
    : ['volume','oi','last','bid','ask','iv_pct']
  const putCols   = showGreeks
    ? ['iv_pct','delta','theta','ask','bid','last','oi','volume']
    : ['iv_pct','ask','bid','last','oi','volume']

  const COL_LABEL = { volume:'Vol', oi:'OI', last:'Last', bid:'Bid', ask:'Ask', iv_pct:'IV%', delta:'Δ', gamma:'Γ', theta:'θ', vega:'ν', mid:'Mid' }
  const isAtm = (s) => Math.abs(s - spot) <= 1.5

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0, zIndex: 1 }}>
            {/* Call headers — right aligned */}
            {callCols.map(c => (
              <th key={`ch-${c}`} style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)' }}>
                {COL_LABEL[c]}
              </th>
            ))}
            <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text)', fontWeight: 800, fontSize: 11, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
              STRIKE
            </th>
            {/* Put headers — left aligned */}
            {putCols.map(c => (
              <th key={`ph-${c}`} style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--border)' }}>
                {COL_LABEL[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strikes.map(strike => {
            const call = callMap[strike]
            const put  = putMap[strike]
            const atm  = isAtm(strike)
            const rowBorder = atm ? { borderTop: atmBorder, borderBottom: atmBorder } : {}

            return (
              <tr key={strike} style={{ ...rowBorder, transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>

                {/* Call cells */}
                {callCols.map(col => {
                  const v = call?.[col]
                  const bg = call?.itm ? itmCallBg : ''
                  const isVol = col === 'volume' || col === 'oi'
                  const displayVal = v == null ? '—' : isVol ? fmtK(v) : col === 'iv_pct' ? `${fmt(v, 1)}%` : fmt(v, col === 'delta' || col === 'theta' ? 3 : 2)
                  return (
                    <td key={col} style={{ padding: '6px 6px', textAlign: 'right', background: bg, color: call?.itm ? 'var(--bull)' : 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                      {displayVal}
                    </td>
                  )
                })}

                {/* Strike cell */}
                <td style={{
                  padding: '6px 10px', textAlign: 'center', fontWeight: 700,
                  borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  color: atm ? 'var(--accent)' : 'var(--text)',
                  fontSize: atm ? 13 : 12,
                  background: atm ? 'rgba(79,142,247,0.08)' : '',
                }}>
                  {atm && <span style={{ fontSize: 9, color: 'var(--accent)', display: 'block', lineHeight: 1 }}>ATM</span>}
                  {strike}
                </td>

                {/* Put cells */}
                {putCols.map(col => {
                  const v = put?.[col]
                  const bg = put?.itm ? itmPutBg : ''
                  const isVol = col === 'volume' || col === 'oi'
                  const displayVal = v == null ? '—' : isVol ? fmtK(v) : col === 'iv_pct' ? `${fmt(v, 1)}%` : fmt(v, col === 'delta' || col === 'theta' ? 3 : 2)
                  return (
                    <td key={col} style={{ padding: '6px 6px', textAlign: 'left', background: bg, color: put?.itm ? 'var(--bear)' : 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                      {displayVal}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function OptionsChain() {
  const { ticker, timeframe } = useStore()
  const [exps, setExps]               = useState([])
  const [selectedExp, setSelected]     = useState(null)
  const [snapshotExp, setSnapshotExp]  = useState(null)  // best exp from snapshot analysis
  const [chain, setChain]             = useState(null)
  const [spot, setSpot]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [showGreeks, setShowGreeks]   = useState(true)
  const [strikeRange, setStrikeRange] = useState(0.20)

  // Called by MarketSnapshot when analysis resolves the best expiration for the timeframe
  const handleSnapshotExp = useCallback((expDate) => {
    setSnapshotExp(expDate)
    setSelected(expDate)  // auto-sync chain to snapshot's recommended expiration
  }, [])

  useEffect(() => { loadExpirations() }, [ticker, timeframe])
  useEffect(() => { if (selectedExp) loadChain(selectedExp) }, [selectedExp, strikeRange])

  async function loadExpirations() {
    setExps([]); setChain(null); setError(null); setSelected(null); setSnapshotExp(null)
    try {
      const d = await api.get(`/options/expirations/${ticker}`)
      const allExps = d.expirations || []
      setExps(allExps)
      setSpot(d.spot_price)
      // Set a fallback default — snapshot will override with the timeframe-optimal exp
      if (allExps.length) setSelected(allExps[1]?.date || allExps[0].date)
    } catch (e) { setError(e.message) }
  }

  async function loadChain(exp) {
    setLoading(true); setError(null)
    try {
      const d = await api.get(`/options/chain/${ticker}?expiration=${exp}&strike_range=${strikeRange}`)
      setChain(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Market Snapshot — timeframe-aware analysis */}
      <MarketSnapshot onExpSelected={handleSnapshotExp} />

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Expiration picker */}
        <select
          value={selectedExp || ''}
          onChange={e => setSelected(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}
        >
          {exps.map(e => (
            <option key={e.date} value={e.date}>
              {e.date === snapshotExp ? '★ ' : ''}{e.label}{e.weekly ? ' ⚡' : ''}
            </option>
          ))}
        </select>

        {/* Strike range */}
        <select
          value={strikeRange}
          onChange={e => setStrikeRange(Number(e.target.value))}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}
        >
          {[0.10, 0.15, 0.20, 0.25, 0.30].map(r => (
            <option key={r} value={r}>±{(r*100).toFixed(0)}% strikes</option>
          ))}
        </select>

        {/* Greeks toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showGreeks} onChange={e => setShowGreeks(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Show Greeks (Δ θ)
        </label>

        {chain && (
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {chain.dte}d to expiry · {chain.calls.length + chain.puts.length} contracts shown
          </span>
        )}
      </div>

      {/* Summary bar */}
      {chain && <div className="card card-sm"><SummaryBar summary={chain.summary} spot={chain.spot_price} /></div>}

      {/* Error */}
      {error && <div className="error-box">⚠ {error}</div>}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--muted)' }}>
        <span><span style={{ color: 'var(--bull)' }}>■</span> ITM Calls</span>
        <span><span style={{ color: 'var(--bear)' }}>■</span> ITM Puts</span>
        <span><span style={{ color: 'var(--accent)' }}>■</span> ATM (nearest strike)</span>
        <span>⚡ = Weekly expiration</span>
      </div>

      {/* Chain table */}
      {loading && <div className="spinner-wrap"><div className="spinner" /><span>Loading chain...</span></div>}
      {!loading && chain && (
        <div className="signals-panel">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', justifyContent: 'space-between' }}>
            <span>← CALLS</span>
            <span>PUTS →</span>
          </div>
          <ChainTable calls={chain.calls} puts={chain.puts} spot={chain.spot_price} showGreeks={showGreeks} />
        </div>
      )}
    </div>
  )
}
