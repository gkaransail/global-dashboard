import { useState, useEffect, useRef } from 'react'
import { useStore } from '../core/store'
import { api } from '../core/api'

const TIMEFRAMES = ['1mo', '3mo', '6mo', '1y']

export default function TickerBar() {
  const { ticker, timeframe, setTicker, setTimeframe } = useStore()
  const [inputVal, setInputVal] = useState(ticker)
  const [priceInfo, setPriceInfo] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => { setInputVal(ticker) }, [ticker])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPrice(ticker), 400)
  }, [ticker])

  async function fetchPrice(t) {
    try {
      const data = await api.get(`/reversal/analyze/${t}?explain=false`)
      // Pull price from macro or just show ticker
      setPriceInfo({ ticker: t })
    } catch {
      setPriceInfo(null)
    }
  }

  function submit() {
    const v = inputVal.trim().toUpperCase()
    if (v && v !== ticker) setTicker(v)
  }

  return (
    <div className="ticker-bar">
      {/* Ticker input */}
      <div className="ticker-bar-input-wrap">
        <span className="ticker-bar-search-icon">🔍</span>
        <input
          className="ticker-bar-input"
          value={inputVal}
          onChange={e => setInputVal(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="TICKER"
          maxLength={10}
        />
      </div>
      <button className="ticker-bar-go" onClick={submit}>Go</button>

      {/* Timeframe selector */}
      <div className="timeframe-pills">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            className={`tf-pill ${timeframe === tf ? 'active' : ''}`}
            onClick={() => setTimeframe(tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="ticker-bar-spacer" />

      <div className="ticker-bar-status">
        <div className="live-dot" />
        Live data
      </div>
    </div>
  )
}
