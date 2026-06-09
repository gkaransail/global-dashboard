"""
Dashboard Scanner.

Scores a universe of 50 liquid stocks across 6 categories and returns
the top 10 bullish and top 10 bearish stocks with predicted prices.

Composite weights:
  Options:     30%
  Insider:     25%
  Technical:   20%
  Fundamental: 10%
  Macro:       10%
  Sentiment:    5%
"""

import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

from core import cache as _cache
from core.data.fetcher import fetch_ohlcv, fetch_macro_data

logger = logging.getLogger(__name__)

SCAN_CACHE_TTL = 300  # 5 minutes

UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "XOM",
    "UNH", "AVGO", "WMT", "JNJ", "MA", "PG", "COST", "HD", "MRK", "ABBV",
    "CVX", "CRM", "KO", "BAC", "NFLX", "AMD", "PEP", "LIN", "ORCL", "ACN",
    "MCD", "ADBE", "DIS", "QCOM", "TXN", "WFC", "MS", "GS", "CAT", "TMO",
    "INTU", "ABT", "PM", "SBUX", "PYPL", "UBER", "SNOW", "PLTR", "SHOP", "NOW",
]

WEIGHTS = {
    "options":     0.30,
    "insider":     0.25,
    "technical":   0.20,
    "fundamental": 0.10,
    "macro":       0.10,
    "sentiment":   0.05,
}


def _safe_float(val: Any) -> Optional[float]:
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _clamp(val: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, val))


# ---------- per-category score functions ----------

def _options_score(ticker: str) -> float:
    """Score -1 to +1 from options analysis (P/C ratio + max pain vs spot)."""
    try:
        from features.options.analyzers.analysis import get_analysis
        analysis = get_analysis(ticker, timeframe="1mo")

        pc_ratio = _safe_float(analysis.get("pc_ratio")) or 1.0
        spot = _safe_float(analysis.get("spot_price")) or 0.0
        max_pain = _safe_float(analysis.get("max_pain"))

        # P/C score
        if pc_ratio < 0.7:
            score = 0.7 * (0.7 - pc_ratio) / 0.7
        elif pc_ratio > 1.3:
            score = -0.7 * (pc_ratio - 1.3) / 0.7
        else:
            score = 0.0

        # Max pain adjustment
        if max_pain is not None and spot > 0:
            if max_pain > spot * 1.02:
                score += 0.2
            elif max_pain < spot * 0.98:
                score -= 0.2

        return _clamp(score)
    except Exception:
        return 0.0


def _insider_score(ticker: str) -> float:
    """Score -1 to +1 from insider sentiment."""
    try:
        from features.insider.analyzer import InsiderAnalyzer
        ia = InsiderAnalyzer()
        sentiment = ia.get_sentiment_score(ticker)
        return _clamp(_safe_float(sentiment.get("score")) or 0.0)
    except Exception:
        return 0.0


def _technical_score(ticker: str) -> float:
    """Score -1 to +1 from technical signals (reversal technical analyzer)."""
    try:
        from features.reversal.signals.technical import TechnicalSignalAnalyzer
        df = fetch_ohlcv(ticker)
        if df is None or len(df) < 50:
            return 0.0
        analyzer = TechnicalSignalAnalyzer()
        signals = analyzer.analyze(ticker, df)
        if not signals:
            return 0.0
        bullish = sum(s.strength for s in signals if s.direction.value.startswith("bullish"))
        bearish = sum(s.strength for s in signals if s.direction.value.startswith("bearish"))
        total = bullish + bearish
        if total == 0:
            return 0.0
        return _clamp((bullish - bearish) / total)
    except Exception:
        return 0.0


def _fundamental_score(ticker: str) -> float:
    """Score -1 to +1 from fundamental signals."""
    try:
        from features.fundamental.analyzer import FundamentalAnalyzer
        fa = FundamentalAnalyzer()
        signals = fa.get_signals(ticker)
        if not signals:
            return 0.0
        bull = sum(s.get("strength", 0.0) for s in signals if s.get("direction") == "bullish")
        bear = sum(s.get("strength", 0.0) for s in signals if s.get("direction") == "bearish")
        total = bull + bear
        if total == 0:
            return 0.0
        return _clamp((bull - bear) / total)
    except Exception:
        return 0.0


def _macro_score() -> float:
    """Score -1 to +1 from macro signals (SPY proxy, cached globally)."""
    try:
        from features.reversal.signals.macro import MacroSignalAnalyzer
        macro_data = fetch_macro_data()
        df_spy = fetch_ohlcv("SPY")
        if df_spy is None:
            return 0.0
        ma = MacroSignalAnalyzer()
        signals = ma.analyze("SPY", df_spy, macro_data=macro_data)
        if not signals:
            return 0.0
        bullish = sum(s.strength for s in signals if s.direction.value.startswith("bullish"))
        bearish = sum(s.strength for s in signals if s.direction.value.startswith("bearish"))
        total = bullish + bearish
        if total == 0:
            return 0.0
        return _clamp((bullish - bearish) / total)
    except Exception:
        return 0.0


def _sentiment_score(ticker: str) -> float:
    """Score -1 to +1 from sentiment signals."""
    try:
        from features.sentiment.analyzer import SentimentAnalyzer
        sa = SentimentAnalyzer()
        signals = sa.get_signals(ticker)
        if not signals:
            return 0.0
        bull = sum(s.get("strength", 0.0) for s in signals if s.get("direction") == "bullish")
        bear = sum(s.get("strength", 0.0) for s in signals if s.get("direction") == "bearish")
        total = bull + bear
        if total == 0:
            return 0.0
        return _clamp((bull - bear) / total)
    except Exception:
        return 0.0


# ---------- key signals builder ----------

def _build_key_signals(
    ticker: str,
    options_s: float,
    insider_s: float,
    technical_s: float,
    fundamental_s: float,
    macro_s: float,
    sentiment_s: float,
) -> List[str]:
    """Assemble the top 3 signals driving the composite call."""
    category_scores = {
        "Options Chain": (options_s, WEIGHTS["options"]),
        "Insider Trading": (insider_s, WEIGHTS["insider"]),
        "Technical": (technical_s, WEIGHTS["technical"]),
        "Fundamental": (fundamental_s, WEIGHTS["fundamental"]),
        "Macro": (macro_s, WEIGHTS["macro"]),
        "Sentiment": (sentiment_s, WEIGHTS["sentiment"]),
    }

    # Sort by absolute weighted contribution
    ranked = sorted(
        category_scores.items(),
        key=lambda kv: abs(kv[1][0]) * kv[1][1],
        reverse=True,
    )[:3]

    signals = []
    for name, (score, weight) in ranked:
        direction = "bullish" if score > 0 else "bearish" if score < 0 else "neutral"
        arrow = "↑" if score > 0 else "↓" if score < 0 else "→"
        signals.append(
            f"{arrow} {name} ({direction}, {int(weight * 100)}% weight, score {score:+.2f})"
        )
    return signals


# ---------- main scanner ----------

class DashboardScanner:
    """Scans the stock universe and ranks by multi-factor composite score."""

    def _score_stock(self, ticker: str, macro_s: float) -> Optional[Dict]:
        """
        Score a single stock across all 6 categories.
        Returns None if the stock fails entirely.
        """
        try:
            # Fetch price data first — if this fails, skip the stock
            df = fetch_ohlcv(ticker)
            if df is None or df.empty:
                return None
            current_price = _safe_float(df["Close"].iloc[-1])
            if not current_price or current_price <= 0:
                return None

            # Category scores (each handles its own errors)
            opts_s = _options_score(ticker)
            ins_s = _insider_score(ticker)
            tech_s = _technical_score(ticker)
            fund_s = _fundamental_score(ticker)
            sent_s = _sentiment_score(ticker)
            # macro_s is pre-computed and shared across all stocks

            composite = (
                opts_s  * WEIGHTS["options"] +
                ins_s   * WEIGHTS["insider"] +
                tech_s  * WEIGHTS["technical"] +
                fund_s  * WEIGHTS["fundamental"] +
                macro_s * WEIGHTS["macro"] +
                sent_s  * WEIGHTS["sentiment"]
            )
            composite = _clamp(composite)

            direction = (
                "bullish" if composite > 0.05 else
                "bearish" if composite < -0.05 else
                "neutral"
            )
            confidence = abs(composite)

            # Predicted price using historical volatility
            try:
                returns = df["Close"].pct_change().dropna()
                if len(returns) >= 10:
                    hist_vol_ann = float(returns.std()) * (252 ** 0.5)
                    expected_move_30d = hist_vol_ann * ((30 / 252) ** 0.5)
                    move_magnitude = expected_move_30d * confidence
                else:
                    move_magnitude = 0.0
            except Exception:
                move_magnitude = 0.0

            if direction == "bullish":
                predicted_price = current_price * (1 + move_magnitude)
            elif direction == "bearish":
                predicted_price = current_price * (1 - move_magnitude)
            else:
                predicted_price = current_price

            predicted_change_pct = (predicted_price / current_price - 1) * 100

            key_signals = _build_key_signals(ticker, opts_s, ins_s, tech_s, fund_s, macro_s, sent_s)

            return {
                "ticker": ticker,
                "current_price": round(current_price, 2),
                "composite_score": round(composite, 4),
                "direction": direction,
                "confidence": round(confidence, 4),
                "predicted_price": round(predicted_price, 2),
                "predicted_change_pct": round(predicted_change_pct, 2),
                "timeframe_days": 30,
                "category_scores": {
                    "options": round(opts_s, 4),
                    "insider": round(ins_s, 4),
                    "technical": round(tech_s, 4),
                    "fundamental": round(fund_s, 4),
                    "macro": round(macro_s, 4),
                    "sentiment": round(sent_s, 4),
                },
                "key_signals": key_signals,
                "options_score": round(opts_s, 4),
                "insider_score": round(ins_s, 4),
            }

        except Exception as e:
            logger.debug(f"DashboardScanner._score_stock({ticker}): {e}")
            return None

    def get_top10(self, force_refresh: bool = False) -> Dict:
        """
        Scan the universe and return top 10 bullish and top 10 bearish stocks.
        Results are cached for 5 minutes.
        """
        cache_key = "dashboard:top10"

        if not force_refresh:
            cached = _cache.get(cache_key, SCAN_CACHE_TTL)
            if cached is not None:
                return cached

        scan_start = datetime.utcnow()

        # Pre-compute macro score once (shared across all stocks)
        macro_s = _macro_score()

        scored: List[Dict] = []

        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_ticker = {
                executor.submit(self._score_stock, ticker, macro_s): ticker
                for ticker in UNIVERSE
            }
            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    result = future.result(timeout=30)
                    if result is not None:
                        scored.append(result)
                except Exception as e:
                    logger.debug(f"Future failed for {ticker}: {e}")

        # Split into bullish and bearish, filter out neutral
        bullish = sorted(
            [s for s in scored if s["direction"] == "bullish"],
            key=lambda x: x["confidence"],
            reverse=True,
        )[:10]

        bearish = sorted(
            [s for s in scored if s["direction"] == "bearish"],
            key=lambda x: x["confidence"],
            reverse=True,
        )[:10]

        result = {
            "bullish": bullish,
            "bearish": bearish,
            "scan_time": scan_start.isoformat() + "Z",
            "stocks_scanned": len(scored),
            "universe_size": len(UNIVERSE),
            "scoring_weights": {
                "options":     "30%",
                "insider":     "25%",
                "technical":   "20%",
                "fundamental": "10%",
                "macro":       "10%",
                "sentiment":    "5%",
            },
        }

        _cache.set(cache_key, result)
        return result
