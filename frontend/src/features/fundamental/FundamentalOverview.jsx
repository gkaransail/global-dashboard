import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtNum(v, d = 2) { return v == null ? '—' : Number(v).toFixed(d) }
function fmtBig(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `$${(abs / 1e6).toFixed(2)}M`
  return `$${abs.toFixed(2)}`
}
function fmtPct(v) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }

const REC_MAP = {
  'Strong Buy':  { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.2)' },
  'Buy':         { color: '#86efac', bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.15)' },
  'Hold':        { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  'Sell':        { color: '#f87171', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.15)' },
  'Strong Sell': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' },
}

function Metric({ label, value, color, sub }) {
  return (
    <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

export default function FundamentalOverview() {
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
        <span>Loading fundamentals for {ticker}...</span>
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
  const currentPrice  = info.current_price ?? info.price ?? info.regularMarketPrice
  const analystTarget = info.target_mean_price ?? info.analyst_target ?? info.targetMeanPrice
  const rec           = info.recommendation ?? info.analyst_recommendation ?? info.recommendationKey
  const recLabel      = typeof rec === 'string' ? rec.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : null
  const recStyle      = REC_MAP[recLabel] ?? { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' }

  const week52High = info.fifty_two_week_high ?? info.fiftyTwoWeekHigh
  const week52Low  = info.fifty_two_week_low  ?? info.fiftyTwoWeekLow
  const range52Pct = (week52High && week52Low && currentPrice)
    ? ((currentPrice - week52Low) / (week52High - week52Low)) * 100 : null

  // Analyst target upside
  const upside = (analystTarget && currentPrice && currentPrice > 0)
    ? ((analystTarget - currentPrice) / currentPrice) * 100 : null

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          🏢 Fundamental Overview — {ticker}
        </h2>
        {recLabel && (
          <span style={{
            background: recStyle.bg, border: `1px solid ${recStyle.border}`,
            color: recStyle.color, fontSize: 11, fontWeight: 700,
            padding: '3px 12px', borderRadius: 20, marginLeft: 'auto',
          }}>
            {recLabel}
          </span>
        )}
      </div>

      {/* Key metrics grid */}
      <div className="card-grid-4">
        <Metric label="Market Cap"     value={fmtBig(info.market_cap ?? info.marketCap)} />
        <Metric label="P/E Ratio"      value={fmtNum(info.pe_ratio ?? info.trailingPE ?? info.pe)} />
        <Metric label="Forward P/E"    value={fmtNum(info.forward_pe ?? info.forwardPE)} />
        <Metric label="EPS (TTM)"      value={info.eps ?? info.trailingEps != null ? `$${fmtNum(info.eps ?? info.trailingEps)}` : '—'} />
        <Metric label="Revenue (TTM)"  value={fmtBig(info.revenue ?? info.totalRevenue)} />
        <Metric label="Profit Margin"  value={fmtPct(info.profit_margin ?? info.profitMargins)} />
        <Metric label="ROE"            value={fmtPct(info.roe ?? info.returnOnEquity)} />
        <Metric label="Beta"           value={fmtNum(info.beta, 2)} color={
          info.beta > 1.5 ? '#ef4444' : info.beta > 1 ? '#f59e0b' : '#22c55e'
        } />
      </div>

      {/* Analyst target vs current price */}
      {analystTarget != null && currentPrice != null && (
        <div className="card">
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
            Analyst Price Target vs Current Price
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Current</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>${fmtNum(currentPrice, 2)}</div>
            </div>
            <div style={{ fontSize: 20, color: 'var(--muted)' }}>→</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Analyst Target</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: upside >= 0 ? '#22c55e' : '#ef4444' }}>
                ${fmtNum(analystTarget, 2)}
              </div>
            </div>
            {upside != null && (
              <div style={{
                background: upside >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${upside >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: upside >= 0 ? '#22c55e' : '#ef4444',
                fontSize: 16, fontWeight: 800,
                padding: '6px 16px', borderRadius: 8,
              }}>
                {upside >= 0 ? '+' : ''}{fmtNum(upside, 1)}%
              </div>
            )}
          </div>
          {/* Visual bar */}
          <div style={{ position: 'relative', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', maxWidth: 400 }}>
            {upside != null && (
              <div style={{
                width: upside >= 0 ? `${Math.min(100, upside * 2)}%` : `${Math.min(100, Math.abs(upside) * 2)}%`,
                height: '100%',
                background: upside >= 0 ? '#22c55e' : '#ef4444',
                borderRadius: 4, transition: 'width .5s',
                marginLeft: upside >= 0 ? 0 : 'auto',
              }} />
            )}
          </div>
        </div>
      )}

      {/* 52-week range */}
      {week52High != null && week52Low != null && (
        <div className="card">
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            52-Week Range
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>Low: ${fmtNum(week52Low, 2)}</span>
            {currentPrice && <span style={{ color: '#3b82f6', fontWeight: 700 }}>Current: ${fmtNum(currentPrice, 2)}</span>}
            <span style={{ color: '#22c55e', fontWeight: 600 }}>High: ${fmtNum(week52High, 2)}</span>
          </div>
          <div style={{ position: 'relative', height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'visible' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)',
              borderRadius: 5, opacity: 0.5,
              position: 'absolute', inset: 0,
            }} />
            {range52Pct != null && (
              <div style={{
                position: 'absolute', top: -3, left: `${range52Pct}%`, transform: 'translateX(-50%)',
                width: 5, height: 16, background: '#3b82f6', borderRadius: 3,
                border: '1px solid #fff', boxShadow: '0 0 4px rgba(59,130,246,0.5)',
                transition: 'left .5s',
              }} />
            )}
          </div>
          {range52Pct != null && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              {fmtNum(range52Pct, 0)}% above 52-week low
            </div>
          )}
        </div>
      )}
    </div>
  )
}
