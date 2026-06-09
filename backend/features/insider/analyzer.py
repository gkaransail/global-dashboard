"""
Insider Trading Analyzer.

Fetches SEC insider transactions from yfinance and computes sentiment scores,
cluster buy signals, and trading signals compatible with reversal composite scoring.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import yfinance as yf

from core import cache as _cache

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes


class InsiderAnalyzer:
    """Analyzes insider trading data for a given ticker."""

    # ---------- helpers ----------

    @staticmethod
    def _safe_float(val: Any) -> Optional[float]:
        try:
            f = float(val)
            return None if math.isnan(f) else f
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_str(val: Any) -> str:
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return ""
        return str(val)

    def _fetch_transactions_df(self, ticker: str) -> Optional[pd.DataFrame]:
        """Return raw insider_transactions DataFrame or None."""
        key = f"insider:raw:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached
        try:
            t = yf.Ticker(ticker.upper())
            df = t.insider_transactions
            if df is None or (hasattr(df, "empty") and df.empty):
                return None
            _cache.set(key, df)
            return df
        except Exception as e:
            logger.warning(f"InsiderAnalyzer._fetch_transactions_df({ticker}): {e}")
            return None

    # ---------- public API ----------

    def get_transactions(self, ticker: str) -> List[Dict]:
        """
        Return list of insider transaction dicts.

        Fields: date, insider_name, title, transaction_type, shares, value, shares_owned.
        """
        key = f"insider:transactions:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        df = self._fetch_transactions_df(ticker)
        if df is None or df.empty:
            return []

        results: List[Dict] = []
        for _, row in df.iterrows():
            # yfinance columns vary — normalise with .get()
            date_val = row.get("Start Date") or row.get("Date") or row.get("date")
            if date_val is None:
                # try index
                date_val = row.name if hasattr(row, "name") else None

            try:
                if isinstance(date_val, (pd.Timestamp, datetime)):
                    date_str = date_val.strftime("%Y-%m-%d")
                else:
                    date_str = str(date_val)[:10] if date_val else None
            except Exception:
                date_str = None

            shares_raw = row.get("Shares") or row.get("shares")
            value_raw = row.get("Value") or row.get("value")
            shares_owned_raw = row.get("Shares Owned") or row.get("sharesOwned") or row.get("Shares Owned Indirectly")

            results.append({
                "date": date_str,
                "insider_name": self._safe_str(row.get("Insider") or row.get("Name") or row.get("name")),
                "title": self._safe_str(row.get("Position") or row.get("Title") or row.get("title")),
                "transaction_type": self._safe_str(row.get("Transaction") or row.get("transaction_type") or row.get("Type")),
                "shares": self._safe_float(shares_raw),
                "value": self._safe_float(value_raw),
                "shares_owned": self._safe_float(shares_owned_raw),
            })

        _cache.set(key, results)
        return results

    def get_sentiment_score(self, ticker: str) -> Dict:
        """
        Compute a sentiment score from insider transaction data.

        Returns dict with: score, direction, strength, buy_count, sell_count,
        buy_value, sell_value, net_value, cluster_signal, recent_bias, explanation.
        """
        key = f"insider:sentiment:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        _empty = {
            "score": 0.0,
            "direction": "neutral",
            "strength": 0.0,
            "buy_count": 0,
            "sell_count": 0,
            "buy_value": 0.0,
            "sell_value": 0.0,
            "net_value": 0.0,
            "cluster_signal": False,
            "recent_bias": "none",
            "explanation": "No insider data available.",
        }

        transactions = self.get_transactions(ticker)
        if not transactions:
            return _empty

        now = datetime.utcnow()
        cutoff_180 = now - timedelta(days=180)
        cutoff_90 = now - timedelta(days=90)
        cutoff_30 = now - timedelta(days=30)

        buy_value_weighted = 0.0
        sell_value_weighted = 0.0
        buy_count = 0
        sell_count = 0
        buy_value_raw = 0.0
        sell_value_raw = 0.0
        buyers_90d: set = set()

        for tx in transactions:
            # Parse date
            if not tx.get("date"):
                continue
            try:
                tx_date = datetime.strptime(tx["date"][:10], "%Y-%m-%d")
            except (ValueError, TypeError):
                continue

            if tx_date < cutoff_180:
                continue

            tx_type = tx.get("transaction_type", "").lower()
            is_buy = any(k in tx_type for k in ("purchase", "buy", "acquisition", "acquired"))
            is_sell = any(k in tx_type for k in ("sale", "sell", "sold", "disposition"))

            value = tx.get("value") or 0.0
            shares = tx.get("shares") or 0.0
            insider = tx.get("insider_name", "")

            # Recency multiplier
            if tx_date >= cutoff_30:
                recency = 2.0
            elif tx_date >= cutoff_90:
                recency = 1.5
            else:
                recency = 1.0

            if is_buy:
                buy_count += 1
                buy_value_raw += abs(value)
                buy_value_weighted += abs(value) * recency
                if tx_date >= cutoff_90 and insider:
                    buyers_90d.add(insider)
            elif is_sell:
                sell_count += 1
                sell_value_raw += abs(value)
                sell_value_weighted += abs(value) * recency

        net_value = buy_value_raw - sell_value_raw
        net_weighted = buy_value_weighted - sell_value_weighted

        # Score: tanh of net weighted value scaled, clamped to [-1, 1]
        raw_score = math.tanh(net_weighted / 1_000_000.0)

        # Cluster signal: 3+ unique insiders bought in last 90 days
        cluster_signal = len(buyers_90d) >= 3

        if cluster_signal:
            raw_score = max(-1.0, min(1.0, raw_score * 1.3))

        score = round(max(-1.0, min(1.0, raw_score)), 4)

        if score > 0.1:
            direction = "bullish"
        elif score < -0.1:
            direction = "bearish"
        else:
            direction = "neutral"

        strength = round(abs(score), 4)

        # Recent bias
        if buy_count > 0 and sell_count == 0:
            recent_bias = "buying"
        elif sell_count > 0 and buy_count == 0:
            recent_bias = "selling"
        elif buy_count > 0 and sell_count > 0:
            recent_bias = "mixed"
        else:
            recent_bias = "none"

        cluster_note = f" Cluster buy detected ({len(buyers_90d)} insiders bought in 90d)." if cluster_signal else ""
        explanation = (
            f"Insider activity over last 180 days: {buy_count} buy(s) "
            f"(${buy_value_raw:,.0f} total) vs {sell_count} sell(s) "
            f"(${sell_value_raw:,.0f} total). Net flow: ${net_value:+,.0f}.{cluster_note}"
        )

        result = {
            "score": score,
            "direction": direction,
            "strength": strength,
            "buy_count": buy_count,
            "sell_count": sell_count,
            "buy_value": round(buy_value_raw, 2),
            "sell_value": round(sell_value_raw, 2),
            "net_value": round(net_value, 2),
            "cluster_signal": cluster_signal,
            "recent_bias": recent_bias,
            "explanation": explanation,
        }

        _cache.set(key, result)
        return result

    def get_signals(self, ticker: str) -> List[Dict]:
        """
        Return list of signal dicts compatible with reversal signal format.

        Each dict has: name, category, direction, strength, value, explanation.
        """
        key = f"insider:signals:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            transactions = self.get_transactions(ticker)
            sentiment = self.get_sentiment_score(ticker)
            signals: List[Dict] = []

            now = datetime.utcnow()
            cutoff_90 = now - timedelta(days=90)
            cutoff_30 = now - timedelta(days=30)

            net_value = sentiment.get("net_value", 0.0)
            cluster_signal = sentiment.get("cluster_signal", False)

            # 1. Net Insider Flow
            if net_value != 0.0:
                flow_direction = "bullish" if net_value > 0 else "bearish"
                flow_strength = round(min(abs(net_value) / 5_000_000, 0.9), 4)
                signals.append({
                    "name": "Net Insider Flow",
                    "category": "insider",
                    "direction": flow_direction,
                    "strength": flow_strength,
                    "value": round(net_value, 2),
                    "explanation": (
                        f"Net insider dollar flow over 180 days is ${net_value:+,.0f}, "
                        f"indicating {'accumulation' if net_value > 0 else 'distribution'} by insiders."
                    ),
                })

            # 2. Cluster Buy Activity
            if cluster_signal:
                buyers_90d = set()
                for tx in transactions:
                    if not tx.get("date"):
                        continue
                    try:
                        tx_date = datetime.strptime(tx["date"][:10], "%Y-%m-%d")
                    except (ValueError, TypeError):
                        continue
                    tx_type = tx.get("transaction_type", "").lower()
                    is_buy = any(k in tx_type for k in ("purchase", "buy", "acquisition", "acquired"))
                    if is_buy and tx_date >= cutoff_90 and tx.get("insider_name"):
                        buyers_90d.add(tx["insider_name"])
                signals.append({
                    "name": "Cluster Buy Activity",
                    "category": "insider",
                    "direction": "bullish",
                    "strength": 0.80,
                    "value": float(len(buyers_90d)),
                    "explanation": (
                        f"{len(buyers_90d)} unique insiders purchased shares in the last 90 days — "
                        "cluster buying by multiple insiders is a strong conviction signal."
                    ),
                })

            # 3. CEO/CFO Activity
            for tx in transactions:
                if not tx.get("date"):
                    continue
                try:
                    tx_date = datetime.strptime(tx["date"][:10], "%Y-%m-%d")
                except (ValueError, TypeError):
                    continue
                if tx_date < cutoff_90:
                    continue
                title = tx.get("title", "").upper()
                is_exec = "CEO" in title or "CFO" in title or "CHIEF EXECUTIVE" in title or "CHIEF FINANCIAL" in title
                if not is_exec:
                    continue
                tx_type = tx.get("transaction_type", "").lower()
                is_buy = any(k in tx_type for k in ("purchase", "buy", "acquisition", "acquired"))
                is_sell = any(k in tx_type for k in ("sale", "sell", "sold", "disposition"))
                if is_buy:
                    signals.append({
                        "name": "CEO/CFO Activity",
                        "category": "insider",
                        "direction": "bullish",
                        "strength": 0.85,
                        "value": tx.get("value"),
                        "explanation": (
                            f"{tx.get('insider_name', 'Executive')} ({tx.get('title', 'CEO/CFO')}) "
                            "purchased shares — C-suite buying is among the highest-conviction insider signals."
                        ),
                    })
                    break
                elif is_sell:
                    signals.append({
                        "name": "CEO/CFO Activity",
                        "category": "insider",
                        "direction": "bearish",
                        "strength": 0.75,
                        "value": tx.get("value"),
                        "explanation": (
                            f"{tx.get('insider_name', 'Executive')} ({tx.get('title', 'CEO/CFO')}) "
                            "sold shares — C-suite selling may signal concern about near-term outlook."
                        ),
                    })
                    break

            # 4. Insider Buy Streak (3+ consecutive months of net buying)
            try:
                monthly_net: Dict[str, float] = {}
                for tx in transactions:
                    if not tx.get("date"):
                        continue
                    try:
                        tx_date = datetime.strptime(tx["date"][:10], "%Y-%m-%d")
                    except (ValueError, TypeError):
                        continue
                    month_key = tx_date.strftime("%Y-%m")
                    tx_type = tx.get("transaction_type", "").lower()
                    is_buy = any(k in tx_type for k in ("purchase", "buy", "acquisition", "acquired"))
                    is_sell = any(k in tx_type for k in ("sale", "sell", "sold", "disposition"))
                    val = tx.get("value") or 0.0
                    if month_key not in monthly_net:
                        monthly_net[month_key] = 0.0
                    if is_buy:
                        monthly_net[month_key] += abs(val)
                    elif is_sell:
                        monthly_net[month_key] -= abs(val)

                sorted_months = sorted(monthly_net.keys())[-6:]  # last 6 months
                consecutive = 0
                for m in sorted_months:
                    if monthly_net[m] > 0:
                        consecutive += 1
                    else:
                        consecutive = 0

                if consecutive >= 3:
                    signals.append({
                        "name": "Insider Buy Streak",
                        "category": "insider",
                        "direction": "bullish",
                        "strength": 0.70,
                        "value": float(consecutive),
                        "explanation": (
                            f"Net insider buying for {consecutive} consecutive months — "
                            "sustained accumulation pattern suggests insider confidence in the stock."
                        ),
                    })
            except Exception:
                pass

            # 5. Large Block Purchase (single transaction > $500k)
            for tx in transactions:
                if not tx.get("date"):
                    continue
                try:
                    tx_date = datetime.strptime(tx["date"][:10], "%Y-%m-%d")
                except (ValueError, TypeError):
                    continue
                if tx_date < cutoff_90:
                    continue
                tx_type = tx.get("transaction_type", "").lower()
                is_buy = any(k in tx_type for k in ("purchase", "buy", "acquisition", "acquired"))
                val = tx.get("value") or 0.0
                if is_buy and abs(val) > 500_000:
                    signals.append({
                        "name": "Large Block Purchase",
                        "category": "insider",
                        "direction": "bullish",
                        "strength": 0.75,
                        "value": round(abs(val), 2),
                        "explanation": (
                            f"{tx.get('insider_name', 'Insider')} made a ${abs(val):,.0f} purchase — "
                            "large block insider buys signal high conviction in the stock's upside."
                        ),
                    })
                    break

            _cache.set(key, signals)
            return signals

        except Exception as e:
            logger.warning(f"InsiderAnalyzer.get_signals({ticker}): {e}")
            return []
