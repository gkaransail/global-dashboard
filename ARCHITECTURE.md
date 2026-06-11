# Global Financial Intelligence Dashboard — Architecture

## Directory Layout

```
global_dashboard/
├── backend/
│   ├── main.py                        # FastAPI app, CORS, feature mounting
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py                  # Pydantic settings (api_prefix, cache TTLs, thresholds)
│   │   ├── cache.py                   # In-memory TTL cache (dict + timestamp)
│   │   └── data/
│   │       └── fetcher.py             # Shared yfinance layer (OHLCV, macro, sectors)
│   └── features/
│       ├── registry.py                # Auto-discovery: scans dirs, imports manifest+router, mounts
│       ├── reversal/
│       │   ├── manifest.py
│       │   ├── models.py              # ReversalSignal, IndividualSignal, enums
│       │   ├── router.py              # /analyze, /watchlist, /sectors, /macro
│       │   └── signals/
│       │       ├── base.py            # BaseSignalAnalyzer (trend, pct_change, clamp helpers)
│       │       ├── technical.py       # RSI, MACD, Bollinger, MA crossovers, volume divergence
│       │       ├── macro.py           # Gold, DXY, VIX, oil, 10Y yield, copper, interplay
│       │       ├── breadth.py         # Sector rotation, breadth thrust, relative strength
│       │       ├── sentiment.py       # Fear/greed composite, Wyckoff accumulation, exhaustion
│       │       └── composite.py       # Weighted aggregation → confidence + direction
│       └── options/
│           ├── manifest.py
│           ├── router.py              # /expirations, /chain, /unusual, /skew, /analysis
│           └── analyzers/
│               ├── chain.py           # yfinance chain fetch + Black-Scholes Greeks (no scipy)
│               ├── analysis.py        # Expected move, max pain, key OI levels, narrative
│               ├── unusual.py         # Unusual activity score (vol/OI 40% + premium 40% + IV 20%)
│               └── skew.py            # Volatility smile + 25Δ skew + term structure
└── frontend/
    ├── vite.config.js                 # Dev proxy: /api → :8000, /ws → ws://:8000
    ├── src/
    │   ├── main.jsx                   # React root, HashRouter
    │   ├── App.jsx                    # Sidebar + TickerBar layout, top-level routes
    │   ├── core/
    │   │   ├── api.js                 # Thin fetch wrapper for /api/v1/*
    │   │   └── store.js               # Zustand: ticker, timeframe, watchlist
    │   ├── components/
    │   │   ├── Sidebar.jsx            # 2-level nav (feature → sub-option)
    │   │   └── TickerBar.jsx          # Ticker input, timeframe pills, status
    │   └── features/
    │       ├── index.js               # Frontend FEATURES registry (mirrors backend manifests)
    │       ├── reversal/
    │       │   ├── index.jsx          # Sub-tab router
    │       │   ├── ReversalDashboard.jsx  # Verdict + methodology + signals panel
    │       │   ├── SectorGrid.jsx     # 3-col sector cards, clickable → sets ticker
    │       │   ├── Watchlist.jsx      # Chip list + bulk /watchlist POST + results table
    │       │   └── MacroView.jsx      # 60s auto-refresh macro snapshot (7 assets)
    │       └── options/
    │           ├── index.jsx
    │           ├── OptionsChain.jsx   # Expiry picker, strike filter, Greeks toggle, merged chain table
    │           ├── MarketSnapshot.jsx # Expected move bar, key OI levels, narrative
    │           ├── UnusualActivity.jsx # Unusual score table with filter + sort
    │           └── VolSkew.jsx        # Inline SVG: smile chart + term structure table
```

---

## Runtime Architecture

```
Browser (localhost:5173)
    │  fetch /api/v1/*
    ▼
Vite Dev Server  ──proxy──►  FastAPI (localhost:8000)
                                  │
                              Feature Registry
                             /               \
                     reversal/             options/
                     router.py             router.py
                         │                     │
                    4 Signal               4 Analyzers
                    Analyzers              (chain, analysis,
                    (technical,             unusual, skew)
                     macro,                     │
                     breadth,             yfinance option_chain()
                     sentiment)                 │
                         │              Black-Scholes Greeks
                    composite.py         (pure math, no scipy)
                         │
                    In-Memory TTL Cache (core/cache.py)
                         │
                    yfinance (OHLCV + options data)
                         │
                    Yahoo Finance API (external)
```

---

## Data Flow: Reversal Analysis

```
TickerBar (ticker/timeframe change)
  → ReversalDashboard.useEffect()
  → GET /api/v1/reversal/analyze/{ticker}?explain=&lookback_days=

FastAPI handler:
  1. fetch_ohlcv(ticker)          → cached 300s
  2. fetch_macro_data()           → cached 300s
  3. fetch_sector_data()          → cached 300s
  4. Run 4 analyzers (sequential, same process):
       TechnicalSignalAnalyzer    → 8 signals  (RSI, MACD, BB, MA, volume)
       MacroSignalAnalyzer        → 7 signals  (gold, DXY, VIX, oil, yield, copper, interplay)
       BreadthSignalAnalyzer      → 4 signals  (rotation, breadth, RS, new hi/lo proxy)
       SentimentSignalAnalyzer    → 4 signals  (fear/greed, Wyckoff, exhaustion, gaps)
  5. composite.py aggregation:
       per-category score = mean(direction × strength) per analyzer
       composite = Σ (weight × category_score)
         Technical 35% + Macro 30% + Breadth 20% + Sentiment 15%
       confidence = abs(composite)
       direction: >+0.08 BULLISH | <-0.08 BEARISH | else NEUTRAL
       strength:  ≥0.70 STRONG | ≥0.45 MODERATE | else WEAK
  6. Optional: markdown explanation
  → ReversalSignal JSON
```

## Data Flow: Options Chain

```
OptionsChain (expiry / strike range change)
  → GET /api/v1/options/chain/{ticker}?expiration=&strike_range=

FastAPI handler:
  1. yf.Ticker(ticker).option_chain(expiration)
  2. Filter strikes to ±strike_range% of spot
  3. For each option: Black-Scholes Greeks (d1/d2 via math.erf, no scipy)
       delta, gamma (per 1% move), theta (per day), vega (per 1% IV)
  4. Compute summary: P/C ratio, ATM IV, total vol/OI
  → {calls[], puts[], summary}
```

---

## Signal Weights & Thresholds

| Category   | Weight | Signals | Key Inputs |
|------------|--------|---------|------------|
| Technical  | 35%    | 8       | RSI, MACD, Bollinger, MA crossovers, volume |
| Macro      | 30%    | 7       | GC=F, DX-Y.NYB, ^VIX, CL=F, ^TNX, HG=F, ^GSPC |
| Breadth    | 20%    | 4       | 11 sector ETFs (XLK…XLC) |
| Sentiment  | 15%    | 4       | VIX, S&P momentum, up-volume ratio, price gaps |

| Threshold | Value |
|-----------|-------|
| Direction cutoff | ±0.08 composite score |
| STRONG signal | confidence ≥ 0.70 |
| MODERATE signal | confidence ≥ 0.45 |
| Reversal confidence threshold (config) | 0.55 |
| Strong signal threshold (config) | 0.75 |

---

## Cache TTLs (backend, in-memory)

| Data | TTL |
|------|-----|
| OHLCV / macro / sector price data | 300s (5 min) |
| Computed signals | 60s (1 min) |
| Options chains | 120s (2 min) |
| Options analysis & skew | 180s (3 min) |

---

## API Endpoints

### Meta
| Method | Path | Response |
|--------|------|----------|
| GET | `/api/v1/health` | `{status, version}` |
| GET | `/api/v1/features` | List of feature manifests |
| GET | `/` | App metadata |

### Reversal (`/api/v1/reversal`)
| Method | Path | Key Params |
|--------|------|------------|
| GET | `/analyze/{ticker}` | explain, lookback_days |
| POST | `/analyze` | AnalysisRequest body |
| POST | `/watchlist` | tickers[], explain |
| GET | `/signals/{ticker}` | category filter |
| GET | `/sectors` | — |
| GET | `/macro` | — |

### Options (`/api/v1/options`)
| Method | Path | Key Params |
|--------|------|------------|
| GET | `/expirations/{ticker}` | — |
| GET | `/chain/{ticker}` | expiration, strike_range |
| GET | `/unusual/{ticker}` | — |
| GET | `/skew/{ticker}` | — |
| GET | `/analysis/{ticker}` | timeframe |

---

## Options Analysis Internals

**Expected Move (1σ)**
`spot × ATM_IV × sqrt(DTE / 365)`

**Max Pain**
Minimize `Σ intrinsic_value(calls) + Σ intrinsic_value(puts)` across strikes.

**Unusual Activity Score**
```
score = vol_oi_score×0.40 + premium_score×0.40 + iv_score×0.20
vol_oi_score  = min(vol/oi / 10, 1.0)
premium_score = min(log10(premium) / 7, 1.0)   # log scale, caps at ~$10M
iv_score      = min((iv - 0.50) / 1.5, 1.0) if iv > 50%, else 0
```

**25Δ Skew Proxy**
`put_IV_at_10%OTM − call_IV_at_10%OTM`
Positive → put premium elevated (bearish hedging). Negative → call-heavy flow (bullish).

---

## Frontend State

```
Zustand Store
├── ticker: string          (default: 'AAPL')
├── timeframe: string       (default: '3mo')  → maps to lookback_days
└── watchlist: string[]     (default: ['AAPL','TSLA','NVDA',...])

Component responsibility:
  TickerBar  → writes ticker, timeframe
  Watchlist  → writes watchlist
  All views  → read ticker, timeframe; fire API calls in useEffect([ticker, timeframe])
```

---

## Feature Auto-Discovery

```python
# registry.py
def discover(features_dir: Path):
    for subdir in features_dir.iterdir():
        if (subdir / 'manifest.py').exists() and (subdir / 'router.py').exists():
            manifest = importlib.import_module(f'features.{subdir.name}.manifest').MANIFEST
            router   = importlib.import_module(f'features.{subdir.name}.router').router
            _registry.append((manifest, router))

def mount_all(app, prefix):
    for manifest, router in _registry:
        app.include_router(router, prefix=f"{prefix}/{manifest['id']}")
```

Adding a new feature = create `features/myfeature/manifest.py` + `router.py`. No changes to `main.py`.

---

## Scaling & Improvements

### The Core Bottleneck — Everything Runs on Yahoo Finance

Every user request goes out to Yahoo Finance via yfinance. Yahoo Finance has **no SLA, no auth, and rate-limits aggressively**. Under multi-user load this breaks first.

**What breaks at ~5 concurrent users:** Yahoo starts returning 429s or stale/empty data. The single-process in-memory cache doesn't help because each uvicorn worker has its own cache — cache misses multiply by worker count.

---

### Tier 1: Do These First (Before Any Other Scaling Work)

**1. Replace the in-memory cache with Redis**

`core/cache.py` is a plain dict in one process. If you run 2+ uvicorn workers (required for concurrency), they each have their own cache — Yahoo Finance gets hit `N × workers` times per TTL window.

```
current:  process memory (dict)  →  shared nothing
needed:   Redis                  →  shared across all workers
```

TTL values are already defined in `core/config.py` — just swap the cache backend, not the values.

**2. Add a background data refresh job**

Instead of warming cache on first request, pre-fetch the 11 sector ETFs + 8 macro tickers on a schedule (every 4 minutes, since TTL is 5 min). Cold-request latency disappears for the most common data.

Use **APScheduler** or a simple `asyncio` background task registered with FastAPI's `lifespan` hook.

**3. Run uvicorn with multiple workers behind a process manager**

```bash
uvicorn main:app --workers 4 --host 0.0.0.0 --port 8000
```

With Redis cache this is safe. Without it, don't — you'll multiply Yahoo Finance load by 4.

---

### Tier 2: The Expensive Operations

**Reversal analysis is CPU-bound and slow (~1–3s per ticker).** The 4 analyzers run sequentially in one thread, each doing pandas/numpy over 90–365 days of OHLCV data. For single users this is fine. For `/watchlist` with 20 tickers it's brutal.

**Fix: run the 4 analyzers in a thread pool**

They are fully independent — they read the same DataFrames but never write. They can run in parallel:

```python
# composite.py
import asyncio
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=4)

async def analyze_all(ticker_df, macro_df, sector_df):
    loop = asyncio.get_event_loop()
    results = await asyncio.gather(
        loop.run_in_executor(_executor, technical.analyze, ticker_df),
        loop.run_in_executor(_executor, macro.analyze, macro_df),
        loop.run_in_executor(_executor, breadth.analyze, sector_df),
        loop.run_in_executor(_executor, sentiment.analyze, ticker_df),
    )
    return results
```

Cuts per-ticker reversal time from ~3s to ~1s.

**Fix: actually cache reversal results**

The signal TTL is 60s in config but the reversal route recomputes on every request. Cache the full `ReversalSignal` keyed on `(ticker, lookback_days, explain)` in `router.py`.

---

### Tier 3: Architecture Changes for Real Scale

| Problem | Fix |
|---------|-----|
| yfinance rate limits at scale | Add a **market data broker layer** — abstract `fetcher.py` to an interface, swap backend to Polygon.io or Alpaca for paid tiers |
| No auth — any user hits any endpoint | Add API key or JWT middleware at FastAPI level before exposing publicly |
| Bulk `/watchlist` scans block the HTTP worker for 20–40s | Move to a **task queue** (Celery + Redis) — return a job ID immediately, poll for results |
| Frontend fires duplicate requests on re-renders | Add request deduplication in `api.js` — if the same GET fires 3× in 100ms (tab switch, re-render), send only one |
| MacroView polls every 60s per client | Switch to **WebSocket** — the Vite proxy already has `/ws` wired. Backend pushes updates when cache refreshes instead of N clients polling independently |
| Single region / no CDN | The Vite build output is pure static files — trivially CDN-able (Cloudflare). Separate API deployment per region for latency |

---

### Specific Numbers to Keep in Mind

| Scenario | What Happens |
|----------|--------------|
| 1 user, single request | ~1–3s (yfinance round trips dominate) |
| 5 concurrent users | Yahoo Finance 429s start appearing without Redis |
| 20-ticker watchlist scan | ~20–40s serial, ~8–12s with parallel analyzers, ~2s if cached |
| MacroView with 10 users, 60s poll | 10 outbound Yahoo Finance calls/minute — fine today, not tomorrow |
| Sector scan (11 ETFs × 4 analyzers) | ~5–8s without caching — slowest endpoint |

---

### Quick Wins (Low Effort, High Value)

1. **Cache the `/sectors` result for 2 minutes** — most expensive route; nobody needs sub-minute freshness on sector rotation
2. **Add `?format=compact` to `/watchlist`** — strip the `signals[]` array from bulk results; the frontend only shows confidence + direction in the table. Cuts response payload ~70%
3. **Add a `limit` param to `/chain`** (default ±15% strikes) — Black-Scholes over 100+ strikes × 8 expiries is a lot of math per request
4. **Rate-limit by IP at FastAPI level** using `slowapi` before putting this behind a public domain — one client hammering `/watchlist` with 20 tickers every second will exhaust Yahoo Finance for all users
