"""
Smart Money Analyzer.

Provides institutional holdings data and signals derived from yfinance
institutional/major holders data.
"""

import logging
import math
from typing import Any, Dict, List, Optional

import pandas as pd
import yfinance as yf

from core import cache as _cache

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes


def _safe_float(val: Any) -> Optional[float]:
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _safe_pct(val: Any) -> Optional[float]:
    """Handle values that may already be a fraction or a percentage string."""
    if val is None:
        return None
    if isinstance(val, str):
        val = val.strip().replace("%", "")
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


class SmartMoneyAnalyzer:
    """Analyzes institutional / smart-money positioning for a given ticker."""

    def _fetch_institutional_holders(self, ticker: str) -> Optional[pd.DataFrame]:
        key = f"smart_money:inst_holders:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached
        try:
            t = yf.Ticker(ticker.upper())
            df = t.institutional_holders
            if df is None or (hasattr(df, "empty") and df.empty):
                return None
            _cache.set(key, df)
            return df
        except Exception as e:
            logger.warning(f"SmartMoneyAnalyzer._fetch_institutional_holders({ticker}): {e}")
            return None

    def _fetch_major_holders(self, ticker: str) -> Optional[pd.DataFrame]:
        key = f"smart_money:major_holders:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached
        try:
            t = yf.Ticker(ticker.upper())
            df = t.major_holders
            if df is None or (hasattr(df, "empty") and df.empty):
                return None
            _cache.set(key, df)
            return df
        except Exception as e:
            logger.warning(f"SmartMoneyAnalyzer._fetch_major_holders({ticker}): {e}")
            return None

    def _parse_major_holders(self, df: Optional[pd.DataFrame]) -> Dict:
        result = {
            "pct_institutional": None,
            "pct_insider": None,
            "pct_float_institutional": None,
        }
        if df is None or df.empty:
            return result

        # yfinance major_holders has two columns: Value and Breakdown (or similar)
        # We iterate and look for keyword matches
        for _, row in df.iterrows():
            row_vals = list(row.values)
            if len(row_vals) < 2:
                continue
            label = str(row_vals[1]).lower() if len(row_vals) > 1 else ""
            raw_val = row_vals[0]
            val = _safe_pct(raw_val)
            if val is None:
                continue
            # Normalise to fraction if > 1 (some versions return 0.xx, others return xx%)
            if val > 1.5:
                val = val / 100.0

            if "institution" in label and "float" in label:
                result["pct_float_institutional"] = round(val, 4)
            elif "institution" in label:
                result["pct_institutional"] = round(val, 4)
            elif "insider" in label:
                result["pct_insider"] = round(val, 4)

        return result

    def get_institutional_data(self, ticker: str) -> Dict:
        """
        Return institutional holdings breakdown.

        Keys: institutional_holders, major_holders, recent_changes.
        """
        key = f"smart_money:inst_data:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        inst_df = self._fetch_institutional_holders(ticker)
        major_df = self._fetch_major_holders(ticker)

        # Parse institutional holders
        institutional_holders: List[Dict] = []
        if inst_df is not None and not inst_df.empty:
            # Columns vary: Holder, pctHeld, Shares, Value, Date Reported, pctChange
            col_map = {c.lower().replace(" ", "_"): c for c in inst_df.columns}

            holder_col = col_map.get("holder") or next((c for c in inst_df.columns if "holder" in c.lower()), None)
            pct_col = next((c for c in inst_df.columns if "pct" in c.lower() and "held" in c.lower()), None) or \
                      next((c for c in inst_df.columns if "%" in c), None)
            shares_col = next((c for c in inst_df.columns if "share" in c.lower()), None)
            value_col = next((c for c in inst_df.columns if "value" in c.lower()), None)

            for _, row in inst_df.iterrows():
                holder = str(row[holder_col]) if holder_col and holder_col in row.index else None
                pct_held = _safe_float(row[pct_col]) if pct_col and pct_col in row.index else None
                shares = _safe_float(row[shares_col]) if shares_col and shares_col in row.index else None
                value = _safe_float(row[value_col]) if value_col and value_col in row.index else None

                if pct_held is not None and pct_held > 1.0:
                    pct_held = pct_held / 100.0

                institutional_holders.append({
                    "holder": holder,
                    "pct_held": round(pct_held, 4) if pct_held is not None else None,
                    "shares": shares,
                    "value": value,
                })

        # Parse major holders
        major_holders = self._parse_major_holders(major_df)

        # Recent changes: look for pctChange or similar column in inst_df
        recent_changes: List[Dict] = []
        if inst_df is not None and not inst_df.empty:
            pct_change_col = next(
                (c for c in inst_df.columns if "change" in c.lower() or "pctchange" in c.lower()), None
            )
            holder_col = next((c for c in inst_df.columns if "holder" in c.lower()), None)
            if pct_change_col and holder_col:
                for _, row in inst_df.iterrows():
                    pct_change = _safe_float(row[pct_change_col])
                    if pct_change is None:
                        continue
                    if abs(pct_change) > 0.05 or abs(pct_change) > 5:  # > 5% change
                        normalized = pct_change / 100.0 if abs(pct_change) > 1.5 else pct_change
                        if abs(normalized) > 0.05:
                            shares_col = next((c for c in inst_df.columns if "share" in c.lower()), None)
                            recent_changes.append({
                                "holder": str(row[holder_col]),
                                "shares_change": _safe_float(row[shares_col]) if shares_col else None,
                                "pct_change": round(normalized, 4),
                            })

        result = {
            "institutional_holders": institutional_holders[:20],
            "major_holders": major_holders,
            "recent_changes": recent_changes[:10],
        }

        _cache.set(key, result)
        return result

    def get_signals(self, ticker: str) -> List[Dict]:
        """
        Return smart money signals for composite scoring.
        """
        key = f"smart_money:signals:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            data = self.get_institutional_data(ticker)
            signals: List[Dict] = []

            major = data.get("major_holders", {})
            pct_institutional = major.get("pct_institutional")
            pct_insider = major.get("pct_insider")
            pct_float_inst = major.get("pct_float_institutional")

            # 1. Institutional Concentration
            if pct_institutional is not None:
                if pct_institutional > 0.80:
                    signals.append({
                        "name": "Institutional Concentration",
                        "category": "smart_money",
                        "direction": "bearish",
                        "strength": 0.50,
                        "value": round(pct_institutional, 4),
                        "explanation": (
                            f"Institutions hold {pct_institutional*100:.1f}% — heavily owned stock "
                            "may have limited upside as institutional selling pressure can accelerate declines."
                        ),
                    })
                elif pct_institutional < 0.20:
                    signals.append({
                        "name": "Institutional Concentration",
                        "category": "smart_money",
                        "direction": "neutral",
                        "strength": 0.30,
                        "value": round(pct_institutional, 4),
                        "explanation": (
                            f"Institutions hold only {pct_institutional*100:.1f}% — low institutional "
                            "ownership may indicate under-the-radar opportunity or lack of institutional confidence."
                        ),
                    })

            # 2. Top-10 holders concentration (Institutional Ownership Trend proxy)
            holders = data.get("institutional_holders", [])
            if holders:
                top10_pct = sum(
                    h.get("pct_held") or 0.0 for h in holders[:10]
                )
                if top10_pct > 0.60:
                    signals.append({
                        "name": "Institutional Ownership Trend",
                        "category": "smart_money",
                        "direction": "bullish",
                        "strength": 0.45,
                        "value": round(top10_pct, 4),
                        "explanation": (
                            f"Top 10 institutional holders own {top10_pct*100:.1f}% — high concentration "
                            "among large institutions signals stability and long-term confidence."
                        ),
                    })

            # 3. Insider vs Float
            if pct_insider is not None:
                if pct_insider > 0.15:
                    signals.append({
                        "name": "Insider vs Float",
                        "category": "smart_money",
                        "direction": "bullish",
                        "strength": 0.65,
                        "value": round(pct_insider, 4),
                        "explanation": (
                            f"Insiders own {pct_insider*100:.1f}% of shares — high insider ownership "
                            "aligns management with shareholder interests (skin in the game)."
                        ),
                    })

            # 4. Institutional Accumulation Proxy (from recent changes)
            recent_changes = data.get("recent_changes", [])
            if recent_changes:
                net_change = sum(c.get("pct_change") or 0.0 for c in recent_changes)
                if net_change > 0.10:
                    signals.append({
                        "name": "Institutional Accumulation Proxy",
                        "category": "smart_money",
                        "direction": "bullish",
                        "strength": min(round(net_change, 4), 0.80),
                        "value": round(net_change, 4),
                        "explanation": (
                            f"Institutional holders showing net accumulation (+{net_change*100:.1f}% change) — "
                            "suggests smart money is adding to positions."
                        ),
                    })
                elif net_change < -0.10:
                    signals.append({
                        "name": "Institutional Accumulation Proxy",
                        "category": "smart_money",
                        "direction": "bearish",
                        "strength": min(round(abs(net_change), 4), 0.80),
                        "value": round(net_change, 4),
                        "explanation": (
                            f"Institutional holders showing net distribution ({net_change*100:.1f}% change) — "
                            "suggests smart money is reducing exposure."
                        ),
                    })

            _cache.set(key, signals)
            return signals

        except Exception as e:
            logger.warning(f"SmartMoneyAnalyzer.get_signals({ticker}): {e}")
            return []
