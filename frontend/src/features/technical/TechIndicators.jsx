import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmt(v, d = 2) { return v == null ? '—' : Number(v).toFixed(d) }
function fmtPrice(v) { return v == null ? '—' : `$${Number(v).toFixed(2)}` }

function RSIGauge({ value }) {
  const v = value ?? 50
  const pct = Math.min(100, Math.max(0, v))
  const color = v >= 70 ? '#ef4444' : v <= 30 ? '#22c55e' : '#f59e0b'
  const label = v >= 70 ? 'Overbought' : v <= 30 ? 'Oversold' : 'Neutral'

  return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>RSI (14)</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, marginBottom: 6 }}>{fmt(v, 1)}</div>
      <div style={{ position: 'relative', height: 12, borderRadius: 6, overflow: 'hidden',
        background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #f59e0b 30%, #f59e0b 70%, #ef4444 70%, #ef4444 100%)',
        border: '1px solid var(--border)', marginBottom: 4 }}>
        <div style={{
          position: 'absolute', top: -1, left: `${pct}%`, transform: 'translateX(-50%)',
          width: 3, height: 14, background: '#fff', borderRadius: 2,
          boxShadow: '0 0 4px rgba(255,255,255,0.5)', transition: 'left .4s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)' }}>
        <span>0</span><span style={{ color: '#22c55e' }}>30 OS</span>
        <span style={{ color: '#ef4444' }}>70 OB</span><span>100</span>
      </div>
      <span style={{
        display: 'inline-block', marginTop: 8,
        background: `${color}18`, border: `1px solid ${color}33`,
        color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      }}>{label}</span>
    </div>
  )
}

function MACDCard({ macd }) {
  if (!macd) return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>MACD</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>No MACD data available</div>
    </div>
  )

  const macdVal  = macd.macd ?? macd.value ?? 0
  const signal   = macd.signal ?? 0
  const hist     = macd.histogram ?? macd.hist ?? (macdVal - signal)
  const isBull   = macdVal > signal
  const color    = isBull ? '#22c55e' : '#ef4444'

  return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>MACD</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'MACD Line', value: fmt(macdVal, 4), color: isBull ? '#22c55e' : '#ef4444' },
          { label: 'Signal Line', value: fmt(signal, 4), color: 'var(--accent)' },
          { label: 'Histogram', value: fmt(hist, 4), color: hist > 0 ? '#22c55e' : '#ef4444' },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{value}</span>
          </div>
        ))}
      </div>
      <span style={{
        display: 'inline-block', marginTop: 10,
        background: `${color}18`, border: `1px solid ${color}33`,
        color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      }}>
        {isBull ? '🟢 Bullish Crossover' : '🔴 Bearish Crossover'}
      </span>
    </div>
  )
}

function BollingerCard({ bb }) {
  if (!bb) return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Bollinger Bands</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>No data available</div>
    </div>
  )

  const pctB     = bb.percent_b ?? bb.pct_b ?? null
  const bw       = bb.bandwidth ?? null
  const squeeze  = bb.squeeze ?? false
  const upper    = bb.upper ?? null
  const lower    = bb.lower ?? null
  const middle   = bb.middle ?? bb.sma ?? null

  const pctBColor = pctB != null ? (pctB > 1 ? '#ef4444' : pctB < 0 ? '#22c55e' : '#f59e0b') : 'var(--muted)'

  return (
    <div className="card card-sm">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Bollinger Bands</span>
        {squeeze && (
          <span style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>
            SQUEEZE
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { label: 'Upper Band', value: fmtPrice(upper), color: '#ef4444' },
          { label: 'Middle (SMA20)', value: fmtPrice(middle), color: 'var(--text)' },
          { label: 'Lower Band', value: fmtPrice(lower), color: '#22c55e' },
          { label: '%B', value: pctB != null ? fmt(pctB, 2) : '—', color: pctBColor },
          { label: 'Bandwidth', value: bw != null ? fmt(bw, 4) : '—', color: 'var(--muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MACard({ mas, currentPrice }) {
  if (!mas) return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Moving Averages</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>No data available</div>
    </div>
  )

  const pairs = [
    { label: 'SMA 20',  value: mas.sma20  ?? mas.sma_20 },
    { label: 'SMA 50',  value: mas.sma50  ?? mas.sma_50 },
    { label: 'SMA 200', value: mas.sma200 ?? mas.sma_200 },
    { label: 'EMA 12',  value: mas.ema12  ?? mas.ema_12 },
    { label: 'EMA 26',  value: mas.ema26  ?? mas.ema_26 },
  ].filter(p => p.value != null)

  return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Moving Averages</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pairs.map(({ label, value }) => {
          const above = currentPrice != null && currentPrice > value
          const color = above ? '#22c55e' : '#ef4444'
          return (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{fmtPrice(value)}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, padding: '1px 6px', borderRadius: 20 }}>
                  {above ? 'ABOVE' : 'BELOW'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VolumeCard({ volume }) {
  if (!volume) return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Volume</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>No data available</div>
    </div>
  )

  const current = volume.current ?? volume.current_volume ?? 0
  const avg     = volume.average ?? volume.avg_volume ?? volume.average_volume ?? 1
  const ratio   = avg > 0 ? current / avg : 1
  const pct     = Math.min(100, ratio * 50)  // normalize for bar display, 2x avg = 100%
  const color   = ratio > 1.5 ? '#22c55e' : ratio > 1 ? '#f59e0b' : 'var(--muted)'

  function fmtVol(v) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return String(v)
  }

  return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Volume</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Current</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmtVol(current)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Avg</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--muted)' }}>{fmtVol(avg)}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 6 }}>
        {ratio.toFixed(2)}x average volume
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

function StochCard({ stochastic }) {
  if (!stochastic) return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Stochastic</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>No data available</div>
    </div>
  )

  const k = stochastic.k ?? stochastic.stoch_k ?? 50
  const d = stochastic.d ?? stochastic.stoch_d ?? 50
  const kColor = k >= 80 ? '#ef4444' : k <= 20 ? '#22c55e' : '#f59e0b'
  const kLabel = k >= 80 ? 'Overbought' : k <= 20 ? 'Oversold' : 'Neutral'

  return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Stochastic (K/D)</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>%K</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: kColor }}>{fmt(k, 1)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>%D</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{fmt(d, 1)}</div>
        </div>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4,
        background: 'linear-gradient(to right, #22c55e 0%, #22c55e 20%, #f59e0b 20%, #f59e0b 80%, #ef4444 80%, #ef4444 100%)',
        border: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', top: -1, left: `${k}%`, transform: 'translateX(-50%)', width: 3, height: 10, background: '#fff', borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)', marginBottom: 8 }}>
        <span style={{ color: '#22c55e' }}>OS 20</span>
        <span style={{ color: '#ef4444' }}>OB 80</span>
      </div>
      <span style={{
        background: `${kColor}18`, border: `1px solid ${kColor}33`,
        color: kColor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      }}>{kLabel}</span>
    </div>
  )
}

function ATRCard({ atr, currentPrice }) {
  if (!atr) return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>ATR</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>No data available</div>
    </div>
  )

  const val = atr.value ?? atr.atr ?? 0
  const pctOfPrice = currentPrice && currentPrice > 0 ? (val / currentPrice) * 100 : null

  return (
    <div className="card card-sm">
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>ATR (14)</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#a855f7', marginBottom: 4 }}>${fmt(val, 2)}</div>
      {pctOfPrice != null && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {fmt(pctOfPrice, 2)}% of current price
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
        Average True Range — measures daily volatility
      </div>
    </div>
  )
}

export default function TechIndicators() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/technical/indicators/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Calculating indicators for {ticker}...</span>
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

  const currentPrice = data.current_price ?? data.price ?? null

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          📉 Technical Indicators — {ticker}
        </h2>
        {currentPrice && (
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            ${fmt(currentPrice, 2)}
          </span>
        )}
      </div>

      <div className="card-grid-3">
        <RSIGauge value={data.rsi ?? data.rsi_14} />
        <MACDCard macd={data.macd} />
        <BollingerCard bb={data.bollinger_bands ?? data.bollinger ?? data.bb} />
        <MACard mas={data.moving_averages ?? data.sma ?? data.ma} currentPrice={currentPrice} />
        <VolumeCard volume={data.volume ?? data.volume_data} />
        <StochCard stochastic={data.stochastic} />
        <ATRCard atr={data.atr} currentPrice={currentPrice} />
      </div>

    </div>
  )
}
