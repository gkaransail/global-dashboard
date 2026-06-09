import { useState, useEffect } from 'react'
import { useStore } from '../../core/store'
import { api } from '../../core/api'

function fmtDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

// Keyword-based row coloring
const BULLISH_KW = ['beat', 'surge', 'rally', 'upgrade', 'buy', 'outperform', 'growth', 'profit', 'record', 'strong', 'positive']
const BEARISH_KW = ['miss', 'fall', 'drop', 'downgrade', 'sell', 'underperform', 'loss', 'decline', 'weak', 'negative', 'concern']

function articleSentiment(title) {
  const lower = (title || '').toLowerCase()
  const bull = BULLISH_KW.some(kw => lower.includes(kw))
  const bear = BEARISH_KW.some(kw => lower.includes(kw))
  if (bull && !bear) return 'bullish'
  if (bear && !bull) return 'bearish'
  return 'neutral'
}

export default function NewsSentiment() {
  const ticker = useStore(s => s.ticker)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/sentiment/news/${ticker}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>Analyzing news sentiment for {ticker}...</span>
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

  const articles  = data.articles ?? data.news ?? []
  const sentScore = data.sentiment_score ?? data.score ?? 0
  const posCount  = data.positive_count ?? data.positive ?? articles.filter(a => articleSentiment(a.title) === 'bullish').length
  const negCount  = data.negative_count ?? data.negative ?? articles.filter(a => articleSentiment(a.title) === 'bearish').length
  const totalCount = data.article_count ?? articles.length

  const scoreColor = sentScore > 0.1 ? '#22c55e' : sentScore < -0.1 ? '#ef4444' : '#f59e0b'
  const scoreLabel = sentScore > 0.3 ? 'Very Positive' : sentScore > 0.1 ? 'Positive' : sentScore > -0.1 ? 'Neutral' : sentScore > -0.3 ? 'Negative' : 'Very Negative'

  const posPct = totalCount > 0 ? Math.round((posCount / totalCount) * 100) : 0
  const negPct = totalCount > 0 ? Math.round((negCount / totalCount) * 100) : 0

  return (
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        📰 News Sentiment — {ticker}
      </h2>

      {/* Score + breakdown */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 180, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            Sentiment Score
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {sentScore >= 0 ? '+' : ''}{Number(sentScore).toFixed(2)}
          </div>
          <span style={{
            display: 'inline-block', marginTop: 8,
            background: `${scoreColor}18`, border: `1px solid ${scoreColor}33`,
            color: scoreColor, fontSize: 11, fontWeight: 700,
            padding: '3px 12px', borderRadius: 20,
          }}>
            {scoreLabel}
          </span>
        </div>

        <div className="card" style={{ flex: 2, minWidth: 220 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
            Article Breakdown ({totalCount} total)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Positive', count: posCount, pct: posPct, color: '#22c55e' },
              { label: 'Negative', count: negCount, pct: negPct, color: '#ef4444' },
              { label: 'Neutral',  count: totalCount - posCount - negCount, pct: 100 - posPct - negPct, color: '#94a3b8' },
            ].map(({ label, count, pct, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', width: 60, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, pct)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>
                  {count} ({Math.max(0, pct)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sentiment score bar */}
      <div className="card">
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Sentiment Scale
        </div>
        <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden',
          background: 'linear-gradient(to right, #ef4444, #94a3b8 50%, #22c55e)',
          border: '1px solid var(--border)' }}>
          <div style={{
            position: 'absolute', top: -1,
            left: `${((sentScore + 1) / 2) * 100}%`, transform: 'translateX(-50%)',
            width: 4, height: 12, background: '#fff', borderRadius: 2,
            boxShadow: '0 0 4px rgba(255,255,255,0.5)', transition: 'left .4s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--muted)' }}>
          <span style={{ color: '#ef4444' }}>Very Negative (-1)</span>
          <span>Neutral (0)</span>
          <span style={{ color: '#22c55e' }}>Very Positive (+1)</span>
        </div>
      </div>

      {/* Articles list */}
      {articles.length > 0 && (
        <div>
          <div className="section-title">Recent Articles ({articles.length})</div>
          <div className="signals-panel">
            {articles.map((article, i) => {
              const sent  = article.sentiment ?? articleSentiment(article.title)
              const color = sent === 'bullish' || sent === 'positive' ? '#22c55e'
                           : sent === 'bearish' || sent === 'negative' ? '#ef4444' : '#94a3b8'
              const bg    = sent === 'bullish' || sent === 'positive' ? 'rgba(34,197,94,0.05)'
                           : sent === 'bearish' || sent === 'negative' ? 'rgba(239,68,68,0.05)' : ''
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '6px 1fr',
                  gap: 12, padding: '12px 16px',
                  borderBottom: i < articles.length - 1 ? '1px solid var(--border)' : 'none',
                  background: bg,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
                  <div>
                    {article.link || article.url ? (
                      <a
                        href={article.link ?? article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', lineHeight: 1.4 }}
                        onMouseEnter={e => { e.target.style.color = 'var(--accent)' }}
                        onMouseLeave={e => { e.target.style.color = 'var(--text)' }}
                      >
                        {article.title}
                      </a>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{article.title}</div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      {article.publisher && (
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{article.publisher}</span>
                      )}
                      {(article.published ?? article.date ?? article.providerPublishTime) && (
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {fmtDate(article.published ?? article.date ?? article.providerPublishTime)}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, color }}>
                        {sent.charAt(0).toUpperCase() + sent.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {articles.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No recent news articles found for {ticker}.
        </div>
      )}
    </div>
  )
}
