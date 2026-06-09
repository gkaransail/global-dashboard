"""
Market Sentiment Analyzer.

Provides news sentiment scoring via keyword analysis, analyst ratings from
yfinance recommendations_summary, and a composite sentiment overview.
"""

import logging
import math
from typing import Any, Dict, List, Optional

import pandas as pd
import yfinance as yf

from core import cache as _cache

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes

POSITIVE_KEYWORDS = [
    "beats", "surges", "record", "growth", "profit", "raises", "upgrade",
    "buy", "bullish", "strong", "outperform", "rally", "gains", "jumps",
    "exceeds", "positive", "boost", "wins", "expands",
]

NEGATIVE_KEYWORDS = [
    "misses", "drops", "loss", "decline", "cuts", "downgrade", "sell",
    "bearish", "weak", "underperform", "crash", "bankruptcy", "falls",
    "slumps", "concern", "risk", "warning", "disappoints", "miss",
]


def _safe_float(val: Any) -> Optional[float]:
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


class SentimentAnalyzer:
    """Analyzes market sentiment for a given ticker using yfinance data."""

    def get_news_sentiment(self, ticker: str) -> Dict:
        """
        Fetch recent news and compute keyword-based sentiment score.
        """
        cache_key = f"sentiment:news:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            t = yf.Ticker(ticker.upper())
            news = t.news or []
        except Exception as e:
            logger.warning(f"SentimentAnalyzer.get_news_sentiment({ticker}): {e}")
            news = []

        articles: List[Dict] = []
        positive_count = 0
        negative_count = 0

        for item in news:
            try:
                title = str(item.get("title") or "").lower()
                publisher = str(item.get("publisher") or item.get("source") or "")
                link = str(item.get("link") or item.get("url") or "")

                # Published timestamp
                pub_ts = item.get("providerPublishTime") or item.get("publishedAt")
                if pub_ts:
                    try:
                        import datetime
                        published_at = datetime.datetime.utcfromtimestamp(int(pub_ts)).strftime("%Y-%m-%dT%H:%M:%SZ")
                    except Exception:
                        published_at = str(pub_ts)
                else:
                    published_at = None

                articles.append({
                    "title": item.get("title") or "",
                    "publisher": publisher,
                    "link": link,
                    "published_at": published_at,
                })

                # Keyword scoring
                pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in title)
                neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in title)
                positive_count += min(pos, 2)  # cap per article
                negative_count += min(neg, 2)

            except Exception:
                continue

        total_news = len(articles)
        if total_news > 0:
            raw_score = (positive_count - negative_count) / max(total_news, 1)
            sentiment_score = round(max(-1.0, min(1.0, raw_score)), 4)
        else:
            sentiment_score = 0.0

        if sentiment_score > 0.1:
            signal = "bullish"
        elif sentiment_score < -0.1:
            signal = "bearish"
        else:
            signal = "neutral"

        result = {
            "ticker": ticker.upper(),
            "articles": articles[:20],
            "article_count": total_news,
            "sentiment_score": sentiment_score,
            "positive_count": positive_count,
            "negative_count": negative_count,
            "signal": signal,
        }

        _cache.set(cache_key, result)
        return result

    def get_analyst_ratings(self, ticker: str) -> Dict:
        """
        Fetch analyst recommendations summary and price targets.
        """
        cache_key = f"sentiment:analysts:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            t = yf.Ticker(ticker.upper())
            rec_df = t.recommendations_summary
            info = t.info or {}
        except Exception as e:
            logger.warning(f"SentimentAnalyzer.get_analyst_ratings({ticker}): {e}")
            rec_df = None
            info = {}

        strong_buy = 0
        buy_count = 0
        hold_count = 0
        sell_count = 0
        strong_sell = 0
        total = 0

        if rec_df is not None and not (hasattr(rec_df, "empty") and rec_df.empty):
            try:
                # Take the most recent period row
                if isinstance(rec_df, pd.DataFrame) and len(rec_df) > 0:
                    row = rec_df.iloc[0]
                    # Column names vary: strongBuy, Buy, Hold, Sell, strongSell (or lower case)
                    col_map = {c.lower(): c for c in rec_df.columns}

                    def _get_col(keys):
                        for k in keys:
                            col = col_map.get(k)
                            if col is not None:
                                v = _safe_float(row[col])
                                return int(v) if v is not None else 0
                        return 0

                    strong_buy = _get_col(["strongbuy", "strong_buy"])
                    buy_count = _get_col(["buy"])
                    hold_count = _get_col(["hold"])
                    sell_count = _get_col(["sell"])
                    strong_sell = _get_col(["strongsell", "strong_sell"])
                    total = strong_buy + buy_count + hold_count + sell_count + strong_sell
            except Exception as ex:
                logger.debug(f"Analyst rating parsing error: {ex}")

        bullish_pct = round((strong_buy + buy_count) / max(total, 1), 4)

        # Recommendation score: normalize to [-1, 1]
        if total > 0:
            weighted_sum = (strong_buy * 2 + buy_count * 1 + hold_count * 0 +
                            sell_count * -1 + strong_sell * -2)
            recommendation_score = round(weighted_sum / (total * 2), 4)
        else:
            recommendation_score = 0.0

        # Current rating from score
        if recommendation_score > 0.5:
            current_rating = "Strong Buy"
        elif recommendation_score > 0.15:
            current_rating = "Buy"
        elif recommendation_score > -0.15:
            current_rating = "Hold"
        elif recommendation_score > -0.5:
            current_rating = "Sell"
        else:
            current_rating = "Strong Sell"

        # Price target from info
        price_target = (
            _safe_float(info.get("targetMeanPrice"))
            or _safe_float(info.get("targetPrice"))
        )

        result = {
            "ticker": ticker.upper(),
            "current_rating": current_rating,
            "strong_buy": strong_buy,
            "buy_count": buy_count,
            "hold_count": hold_count,
            "sell_count": sell_count,
            "strong_sell": strong_sell,
            "total_analysts": total,
            "bullish_pct": bullish_pct,
            "recommendation_score": recommendation_score,
            "price_target": price_target,
        }

        _cache.set(cache_key, result)
        return result

    def get_signals(self, ticker: str) -> List[Dict]:
        """
        Return sentiment signals for composite scoring.
        """
        cache_key = f"sentiment:signals:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            news = self.get_news_sentiment(ticker)
            analysts = self.get_analyst_ratings(ticker)
            signals: List[Dict] = []

            # 1. News Sentiment
            news_score = news.get("sentiment_score", 0.0)
            if news_score != 0.0:
                news_strength = round(abs(news_score) * 0.8, 4)
                signals.append({
                    "name": "News Sentiment",
                    "category": "sentiment",
                    "direction": "bullish" if news_score > 0 else "bearish",
                    "strength": news_strength,
                    "value": round(news_score, 4),
                    "explanation": (
                        f"News keyword sentiment score of {news_score:+.2f} based on "
                        f"{news.get('article_count', 0)} recent articles "
                        f"({news.get('positive_count', 0)} positive, {news.get('negative_count', 0)} negative signals)."
                    ),
                })

            # 2. Analyst Consensus
            bullish_pct = analysts.get("bullish_pct", 0.5)
            total = analysts.get("total_analysts", 0)
            if total > 0:
                if bullish_pct > 0.70:
                    signals.append({
                        "name": "Analyst Consensus",
                        "category": "sentiment",
                        "direction": "bullish",
                        "strength": 0.70,
                        "value": round(bullish_pct, 4),
                        "explanation": (
                            f"{bullish_pct*100:.0f}% of {total} analysts rate this stock Buy or Strong Buy — "
                            "strong bullish analyst consensus."
                        ),
                    })
                elif bullish_pct < 0.30:
                    signals.append({
                        "name": "Analyst Consensus",
                        "category": "sentiment",
                        "direction": "bearish",
                        "strength": 0.65,
                        "value": round(bullish_pct, 4),
                        "explanation": (
                            f"Only {bullish_pct*100:.0f}% of {total} analysts rate this stock Buy or Strong Buy — "
                            "weak analyst consensus; majority are neutral to bearish."
                        ),
                    })

            _cache.set(cache_key, signals)
            return signals

        except Exception as e:
            logger.warning(f"SentimentAnalyzer.get_signals({ticker}): {e}")
            return []

    def get_sentiment_overview(self, ticker: str) -> Dict:
        """
        Return composite sentiment overview combining news, analyst, and momentum signals.
        """
        cache_key = f"sentiment:overview:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            news = self.get_news_sentiment(ticker)
            analysts = self.get_analyst_ratings(ticker)
            signals = self.get_signals(ticker)

            news_score = news.get("sentiment_score", 0.0)
            analyst_score = analysts.get("recommendation_score", 0.0)

            # Simple composite: 60% analyst, 40% news
            composite_score = round(analyst_score * 0.60 + news_score * 0.40, 4)

            result = {
                "ticker": ticker.upper(),
                "composite_score": composite_score,
                "news_score": news_score,
                "analyst_score": analyst_score,
                "momentum_score": 0.0,  # placeholder — no momentum-specific data here
                "signals": signals,
                "news_summary": {
                    "article_count": news.get("article_count", 0),
                    "signal": news.get("signal", "neutral"),
                },
                "analyst_summary": {
                    "current_rating": analysts.get("current_rating", "N/A"),
                    "bullish_pct": analysts.get("bullish_pct", 0.0),
                    "total_analysts": analysts.get("total_analysts", 0),
                    "price_target": analysts.get("price_target"),
                },
            }

            _cache.set(cache_key, result)
            return result

        except Exception as e:
            logger.warning(f"SentimentAnalyzer.get_sentiment_overview({ticker}): {e}")
            return {
                "ticker": ticker.upper(),
                "composite_score": 0.0,
                "news_score": 0.0,
                "analyst_score": 0.0,
                "momentum_score": 0.0,
                "signals": [],
                "error": str(e),
            }
