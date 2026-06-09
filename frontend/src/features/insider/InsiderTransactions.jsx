import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNum(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('en-US')
}

function fmtMoney(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`
  return `$${abs.toFixed(0)}`
}

const TX_TYPE_COLOR = {
  Buy:       { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',  text: '#22c55e' },
  Sale:      { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)', text: '#ef4444' },
  'Sale (Automatic)': { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  Grant:     { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
  Exercise:  { bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.2)', text: '#a855f7' },
}

function txStyle(type) {
  const isBuy = type && type.toLowerCase().includes('buy')
  const isSell = type && (type.toLowerCase().includes('sale') || type.toLowerCase().includes('sell'))
  if (isBuy) return TX_TYPE_COLOR['Buy']
  if (isSell) return TX_TYPE_COLOR['Sale']
  return TX_TYPE_COLOR['Grant'] || { bg: 'var(--surface2)', border: 'var(--border)', text: 'var(--muted)' }
}

export default function InsiderTransactions() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/insider/transactions/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Loading insider transactions for {ticker}...</span>
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

  const transactions = data.transactions ?? []
  const buys  = transactions.filter(t => t.transaction_type && t.transaction_type.toLowerCase().includes('buy'))
  const sells = transactions.filter(t => t.transaction_type && (t.transaction_type.toLowerCase().includes('sale') || t.transaction_type.toLowerCase().includes('sell')))
  const isClusterBuy = buys.length >= 3

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          👔 Insider Transactions — {ticker}
        </h2>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <span style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#22c55e', fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
          }}>
            {buys.length} Buys
          </span>
          <span style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
          }}>
            {sells.length} Sells
          </span>
          {isClusterBuy && (
            <span style={{
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)',
              color: '#f59e0b', fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 20,
            }}>
              ⚡ High Signal — Cluster Buy
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No insider transactions found for {ticker}.
        </div>
      ) : (
        <div className="signals-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Date', 'Insider Name', 'Title', 'Type', 'Shares', 'Value', 'Shares Owned'].map(col => (
                  <th key={col} style={{
                    padding: '10px 12px', textAlign: 'left',
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
              {transactions.map((tx, i) => {
                const style = txStyle(tx.transaction_type)
                return (
                  <tr
                    key={i}
                    style={{ background: style.bg, borderLeft: `2px solid ${style.border}` }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  >
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {fmtDate(tx.date || tx.filed_date)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                      {tx.insider_name || tx.name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                      {tx.title || tx.relationship || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        background: style.bg, border: `1px solid ${style.border}`,
                        color: style.text, fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                      }}>
                        {tx.transaction_type || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: style.text, fontWeight: 600, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {fmtNum(tx.shares)}
                    </td>
                    <td style={{ padding: '10px 12px', color: style.text, fontWeight: 700, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {fmtMoney(tx.value ?? tx.transaction_value)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {fmtNum(tx.shares_owned ?? tx.total_shares)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
