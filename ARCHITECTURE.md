# Global Financial Intelligence Dashboard — Architecture & Logic

## Overview

A full-stack financial intelligence platform that scans 50 large-cap US stocks across 6 analytical factors, ranks the top 10 bullish and bearish candidates, and generates 30-day predicted price targets. The system is built on **FastAPI** (backend) and **React + Vite** (frontend), with all market data sourced live from **yfinance**.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │ Insider  │  │ Options  │  │Technical │   │
│  │Top10Page │  │ Feature  │  │ Feature  │  │ Feature  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴──────────────┴──────────────┘         │
│                    Zustand Store + api.js                    │
└───────────────────────┬─────────────────────────────────────┘
                        │  HTTP /api/v1/*
┌───────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Feature Registry (auto-discovery)       │    │
│  │  dashboard │ insider │ options │ reversal │ technical│    │
│  │  fundamental │ sentiment │ smart_money               │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐    │
│  │              Core Layer                              │    │
│  │  cache.py (TTL in-memory)  │  data/fetcher.py       │    │
│  └──────────────────────┬──────────────────────────────┘    │
└───────────────────────  │  ──────────────────────────────────┘
                          │  yfinance API calls
                    ┌─────▼──────┐
                    │  yfinance  │
                    │ (Yahoo Fin)│
                    └────────────┘
```

---

## Feature Registry (Auto-Discovery)

`backend/features/registry.py` scans the `features/` directory at startup. Any subfolder containing both `manifest.py` and `router.py` is automatically registered and mounted at `/api/v1/{feature_id}`.

**To add a new feature:** create a folder under `features/` with:
- `manifest.py` — MANIFEST dict (`id`, `label`, `icon`, `status`, `subOptions`)
- `router.py` — FastAPI `router` object with route handlers

No manual wiring needed — the registry handles it.

---

## Composite Scoring & Weights

The **dashboard scanner** is the heart of the system. It scores every stock across 6 categories and computes a composite score in the range **[-1.0, +1.0]**.

### Scoring Weights

| Factor | Weight | Rationale |
|--------|--------|-----------|
| **Options Chain Analysis** | **30%** | Represents real money bets — P/C ratio, max pain, and unusual activity reveal institutional directional bias |
| **Insider Trading** | **25%** | Insiders have material non-public knowledge; cluster buys and C-suite purchases are highest-conviction signals |
| **Technical Analysis** | **20%** | Price action, momentum, and volume patterns confirm or deny fundamental/options positioning |
| **Fundamental Analysis** | **10%** | Valuation sanity check — extreme PE or analyst consensus adds a directional nudge |
| **Macro Environment** | **10%** | VIX, DXY, Gold, Yields, and Copper set the risk-on/risk-off backdrop for all stocks |
| **Market Sentiment** | **5%** | News keyword scoring and analyst consensus provide a weak but real signal |

### Composite Formula

```
composite = (options × 0.30) + (insider × 0.25) + (technical × 0.20)
          + (fundamental × 0.10) + (macro × 0.10) + (sentiment × 0.05)

direction  = "bullish"  if composite > +0.05
           = "bearish"  if composite < -0.05
           = "neutral"  otherwise

confidence = abs(composite)
```

### Predicted Price

Uses **historical volatility** as the move magnitude, scaled by confidence:

```
hist_vol_ann     = daily_returns.std() × √252          # annualized HV
expected_move_30d = hist_vol_ann × √(30/252)            # 30-day sigma
move_magnitude    = expected_move_30d × confidence

predicted_price  = current_price × (1 + move_magnitude)   # bullish
                 = current_price × (1 − move_magnitude)   # bearish
```

This means a stock with 35% annualized volatility and 60% confidence gets a ~±6.4% predicted move over 30 days.

---

## Feature Details

### 1. Options Chain Analysis (`/api/v1/options`)

**Purpose:** Decode institutional positioning via the options market.

**Key analyzers:**

| Analyzer | Logic |
|----------|-------|
| `chain.py` | Fetches full options chain, computes Black-Scholes Greeks (Delta, Gamma, Theta, Vega) without external libs — uses `math.erf` for normal CDF |
| `analysis.py` | Selects best expiration for a given timeframe, computes expected move (±1σ), max pain strike, key OI support/resistance levels, and P/C ratio sentiment |
| `unusual.py` | Scores each contract by Vol/OI ratio (40%), premium value (40%), IV elevation (20%) — surfaces the top 50 unusual contracts |
| `skew.py` | Computes volatility smile (IV vs strike) and term structure (ATM IV vs expiration) |

**Dashboard score contribution:**
- P/C < 0.7 → positive score (call buying dominates → bullish)
- P/C > 1.3 → negative score (put buying dominates → bearish)
- Max pain above spot → add +0.2 (stock likely to drift up)
- Max pain below spot → subtract 0.2

**P/C Ratio Interpretation:**
```
< 0.70  → Bullish  (calls dominate)
0.70–1.00 → Slight bullish
1.00–1.30 → Slight bearish
> 1.30  → Bearish  (puts dominate)
```

---

### 2. Insider Trading (`/api/v1/insider`)

**Purpose:** Track what corporate insiders (executives, directors) are doing with their own stock.

**Scoring logic in `analyzer.py`:**

1. Filter transactions to last **180 days**
2. Separate purchases from sales, apply **recency multipliers**:
   - Last 30 days: **2.0×**
   - Last 90 days: **1.5×**
   - Older: **1.0×**
3. Compute weighted net dollar flow: `net = buy_value_weighted − sell_value_weighted`
4. Score via tanh: `score = tanh(net / $1,000,000)` → range [-1, 1]
5. **Cluster signal:** if 3+ unique insiders purchased in last 90 days → multiply score by **1.3** (clamped to [-1, 1])

**Individual signals generated:**

| Signal | Trigger | Strength |
|--------|---------|---------|
| Net Insider Flow | Any net buy/sell pressure | `min(abs(net) / $5M, 0.90)` |
| Cluster Buy Activity | 3+ unique insiders bought in 90d | 0.80 (strong bullish) |
| CEO/CFO Activity | C-suite buy in 90d | 0.85 bullish |
| CEO/CFO Activity | C-suite sell in 90d | 0.75 bearish |
| Insider Buy Streak | 3+ consecutive months net buying | 0.70 bullish |
| Large Block Purchase | Single buy > $500k in 90d | 0.75 bullish |

---

### 3. Trend Reversal (`/api/v1/reversal`)

**Purpose:** Multi-factor reversal detection using 4 signal categories.

**Category weights (within reversal feature only):**
- Macro: 30%, Technical: 35%, Breadth: 20%, Sentiment: 15%

**Technical signals** (`signals/technical.py`):
- RSI oversold/overbought (< 30 or > 70) with divergence detection
- MACD golden/death cross (histogram sign change)
- Bollinger Band squeeze and band touch signals
- Golden/Death cross (50/200 MA and 20/50 MA)
- Volume divergence (price up + vol down = distribution; price down + vol down = exhaustion)

**Macro signals** (`signals/macro.py`):
- Gold rising → risk-off → bearish for equities
- DXY rising → strong dollar headwind → bearish
- VIX > 35 → capitulation fear → contrarian bullish
- Gold + DXY both rising → panic flight-to-safety → bearish (0.75 strength)
- 10Y yield spiking > 8% in 20 days → rate pressure → bearish
- Copper rising → economic expansion → bullish

**Breadth signals** (`signals/breadth.py`):
- Sector rotation: defensives vs cyclicals leading by 4%+
- Breadth thrust: 80%+ sectors moving in one direction
- Relative strength vs SPY (> ±10% deviation)
- 52-week high/low proximity across sector ETFs

**Sentiment signals** (`signals/sentiment.py`):
- Fear & Greed proxy (0–100): combines VIX 40%, SP500 momentum 40%, Gold/SP ratio 20%
- Wyckoff accumulation/distribution proxy (up-volume vs down-volume on flat price)
- Momentum exhaustion (7+ consecutive up/down days)
- Gap analysis (2+ gap-ups in 5 days = exhaustion; gap-downs = capitulation)

---

### 4. Technical Analysis (`/api/v1/technical`)

**Purpose:** Dedicated technical indicator dashboard per ticker.

**Indicators computed** (`analyzer.py`):
- **RSI (14):** value + oversold/overbought signal
- **MACD (12, 26, 9):** MACD line, signal line, histogram, crossover direction
- **Bollinger Bands (20, 2σ):** upper/lower bands, %B, bandwidth, squeeze detection
- **Moving Averages:** SMA20, SMA50, SMA200, EMA12, EMA26; trend = bullish/bearish/mixed
- **ATR (14):** value and as % of price (volatility measure)
- **Stochastic (14, 3):** %K, %D, overbought/oversold signal
- **Volume:** 20-day avg, current ratio, increasing/decreasing trend

**Price targets** computed from:
- Local minima/maxima (rolling window) for support/resistance
- Fibonacci retracement levels (0.236, 0.382, 0.5, 0.618, 0.786)
- Bull target = next resistance + 1 ATR
- Bear target = next support − 1 ATR

**Chart patterns detected:**
- Double Bottom / Double Top (two extremes within 3% with recovery/rejection)
- Higher Highs + Higher Lows (uptrend confirmation)
- Lower Highs + Lower Lows (downtrend confirmation)
- Bull Flag (sharp advance followed by tight consolidation)
- Consolidation (low bandwidth Bollinger squeeze)

---

### 5. Fundamental Analysis (`/api/v1/fundamental`)

**Purpose:** Valuation sanity check and financial health scoring.

**Health Score (0–100)** composed of 4 components (25 pts each):

| Component | Scoring |
|-----------|---------|
| Profitability | Profit margin: >20% → 25, >10% → 18, >5% → 12, >0% → 6 |
| Growth | Revenue growth: >15% → 25, >8% → 18, >3% → 12, >0% → 6 |
| Balance Sheet | Debt/Equity: <0.5 → 25, <1.0 → 18, <2.0 → 12, <3.0 → 6 |
| Valuation | Forward PE: <15 → 25, <20 → 20, <30 → 14, <50 → 8 |

**Signals generated:**
- Analyst price target upside > 10% → bullish (strength ∝ upside)
- Forward PE < 15 → strong bullish (0.70); > 35 → bearish (0.65)
- Revenue growth > 10% → bullish (0.60); negative → bearish (0.55)
- Profit margin > 15% → bullish quality signal (0.55)
- Health score > 70 → bullish (0.60); < 30 → bearish (0.60)

---

### 6. Market Sentiment (`/api/v1/sentiment`)

**Purpose:** News flow and analyst consensus signals.

**News sentiment** (`analyzer.py`): keyword counting over yfinance `.news`:
- **Positive keywords (12):** beats, surges, record, growth, profit, raises, upgrade, buy, bullish, strong, outperform, rally
- **Negative keywords (20):** misses, drops, loss, decline, cuts, downgrade, sell, bearish, weak, underperform, crash, bankruptcy, …
- Score = `(positive − negative) / total_articles`, clamped to [-1, 1]

**Analyst ratings:** parses yfinance `recommendations_summary`:
- Weighted score: strongBuy×2, buy×1, hold×0, sell×-1, strongSell×-2
- bullish_pct = (strongBuy + buy) / total
- > 70% bullish → strong bullish signal (0.70); < 30% → bearish (0.65)

---

### 7. Smart Money (`/api/v1/smart_money`)

**Purpose:** Institutional holdings and ownership concentration.

**Signals:**
- Institutional concentration > 80% → mildly bearish (over-owned, limited upside)
- Insider ownership > 15% of float → bullish (skin in the game, 0.65)
- Significant quarterly holder changes (> 5% shift) → directional signal

---

## Caching Layer

`core/cache.py` — simple in-memory TTL cache shared across all features.

```
cache.get(key, ttl)  →  returns value if within TTL, else None
cache.set(key, value)  →  stores with current timestamp
```

| Data type | TTL |
|-----------|-----|
| OHLCV price data | 300s (5 min) |
| Options chain | 300s |
| Insider transactions | 300s |
| Dashboard top10 scan | 300s |
| Signals / analysis | 60s |

The dashboard scan is the most expensive operation (~30s for 50 stocks via ThreadPoolExecutor with 10 workers). The 5-minute cache makes subsequent loads instant.

---

## Data Flow — Dashboard Top 10 Scan

```
GET /api/v1/dashboard/top10
        │
        ├── Check cache → return if fresh
        │
        ├── Pre-compute macro score once (shared for all 50 stocks)
        │
        └── ThreadPoolExecutor(max_workers=10)
                │
                ├── For each of 50 tickers in UNIVERSE:
                │       ├── fetch_ohlcv(ticker)          → current_price
                │       ├── _options_score(ticker)        → [-1, +1]
                │       ├── _insider_score(ticker)        → [-1, +1]
                │       ├── _technical_score(ticker)      → [-1, +1]
                │       ├── _fundamental_score(ticker)    → [-1, +1]
                │       ├── _sentiment_score(ticker)      → [-1, +1]
                │       └── composite = weighted sum
                │
                └── Sort by confidence → top 10 bullish, top 10 bearish
                        └── Predict price via historical volatility × confidence
```

---

## Frontend Architecture

### State Management (Zustand)

`core/store.js` holds global state:
- `ticker` — currently selected symbol (default: AAPL)
- `timeframe` — 1mo / 3mo / 6mo / 1y
- `watchlist` — array of tracked tickers

All per-ticker feature pages (`useEffect` on `ticker`) re-fetch whenever the ticker changes via `TickerBar`.

### Routing

```
/                    → redirect to /dashboard/top10
/dashboard/top10     → Top10Dashboard (no ticker dependency — global scan)
/dashboard/methodology → MethodologyPage
/reversal/analyze    → ReversalDashboard
/reversal/sectors    → SectorGrid
/reversal/watchlist  → Watchlist
/reversal/macro      → MacroView
/options/chain       → OptionsChain + MarketSnapshot
/options/unusual     → UnusualActivity
/options/skew        → VolSkew
/insider/transactions → InsiderTransactions
/insider/sentiment   → InsiderSentiment
/insider/signals     → InsiderSignals
/smart_money/institutional → SmartMoneyInstitutional
/smart_money/signals  → SmartMoneySignals
/technical/indicators → TechIndicators
/technical/patterns   → TechPatterns
/technical/targets    → TechTargets
/fundamental/overview → FundamentalOverview
/fundamental/valuation → Valuation
/fundamental/health  → HealthScore
/sentiment/news      → NewsSentiment
/sentiment/analysts  → AnalystRatings
/sentiment/overview  → SentimentOverview
```

### No External Chart Libraries

All visualizations use **inline SVG** — price ladders, confidence bars, IV skew charts, Bollinger Band diagrams, health score gauges — to keep the bundle lean and avoid version-lock dependencies.

---

## Stock Universe (50 tickers)

```python
UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "XOM",
    "UNH", "AVGO", "WMT", "JNJ", "MA", "PG", "COST", "HD", "MRK", "ABBV",
    "CVX", "CRM", "KO", "BAC", "NFLX", "AMD", "PEP", "LIN", "ORCL", "ACN",
    "MCD", "ADBE", "DIS", "QCOM", "TXN", "WFC", "MS", "GS", "CAT", "TMO",
    "INTU", "ABT", "PM", "SBUX", "PYPL", "UBER", "SNOW", "PLTR", "SHOP", "NOW",
]
```

Covers mega-cap tech, financials, healthcare, consumer, energy, and high-growth names — giving broad market representation while keeping scan time under 60 seconds.

---

## Running Locally

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# Frontend
cd frontend
npm install
npm run dev        # starts at http://localhost:5173
```

The frontend proxies `/api` and `/ws` to `http://localhost:8002` via `vite.config.js`.

---

## Key Design Principles

1. **Options and insiders get the highest weight** — they represent money actually at risk (options) or privileged knowledge (insiders), making them the most forward-looking signals.

2. **Graceful degradation** — every scoring function is wrapped in try/except. If a stock has no options data, insider filings, or any other data, that category scores 0.0 rather than crashing the scan.

3. **No database** — the system is stateless. All data fetched live from yfinance, cached in-memory. No setup required beyond pip install.

4. **Auto-discovery architecture** — adding a new feature requires zero changes to existing code. Drop a folder with `manifest.py` + `router.py` and it appears in both the backend API and frontend sidebar automatically.

5. **Predicted price is probabilistic, not deterministic** — the 30-day target is a 1-sigma expected move scaled by model confidence. It represents where the stock *could* go if the signals are right, not a guarantee.
