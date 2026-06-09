"""
Fundamental Analysis Analyzer.

Provides valuation metrics, financial health scoring, and fundamental signals
using yfinance stock info data.
"""

import logging
import math
from typing import Any, Dict, List, Optional

import yfinance as yf

from core import cache as _cache

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes

# Reasonable caps to prevent outlier values from distorting scores
_FLOAT_CAPS = {
    "pe_ratio": 500.0,
    "forward_pe": 500.0,
    "peg_ratio": 20.0,
    "debt_to_equity": 50.0,
    "current_ratio": 20.0,
    "quick_ratio": 20.0,
    "beta": 10.0,
    "roe": 5.0,
    "roa": 2.0,
    "profit_margin": 1.0,
    "operating_margin": 1.0,
    "revenue_growth": 5.0,
}


def _safe_float(val: Any, cap: Optional[float] = None) -> Optional[float]:
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        if cap is not None:
            f = max(-cap, min(cap, f))
        return f
    except (TypeError, ValueError):
        return None


def _info_get(info: Dict, *keys, cap: Optional[float] = None) -> Optional[float]:
    """Try multiple possible key names for a yfinance info field."""
    for k in keys:
        v = info.get(k)
        if v is not None and v != "N/A":
            return _safe_float(v, cap=cap)
    return None


class FundamentalAnalyzer:
    """Analyzes fundamental data for a given ticker using yfinance."""

    def _fetch_info(self, ticker: str) -> Dict:
        key = f"fundamental:info:{ticker.upper()}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached
        try:
            t = yf.Ticker(ticker.upper())
            info = t.info or {}
            _cache.set(key, info)
            return info
        except Exception as e:
            logger.warning(f"FundamentalAnalyzer._fetch_info({ticker}): {e}")
            return {}

    def get_overview(self, ticker: str) -> Dict:
        """
        Return fundamental overview using yfinance ticker.info.
        """
        cache_key = f"fundamental:overview:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        info = self._fetch_info(ticker)

        result = {
            "ticker": ticker.upper(),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": _info_get(info, "marketCap"),
            "enterprise_value": _info_get(info, "enterpriseValue"),
            "pe_ratio": _info_get(info, "trailingPE", cap=_FLOAT_CAPS["pe_ratio"]),
            "forward_pe": _info_get(info, "forwardPE", cap=_FLOAT_CAPS["forward_pe"]),
            "peg_ratio": _info_get(info, "pegRatio", cap=_FLOAT_CAPS["peg_ratio"]),
            "eps_ttm": _info_get(info, "trailingEps"),
            "eps_forward": _info_get(info, "forwardEps"),
            "revenue_ttm": _info_get(info, "totalRevenue"),
            "revenue_growth": _info_get(info, "revenueGrowth", cap=_FLOAT_CAPS["revenue_growth"]),
            "profit_margin": _info_get(info, "profitMargins", cap=_FLOAT_CAPS["profit_margin"]),
            "operating_margin": _info_get(info, "operatingMargins", cap=_FLOAT_CAPS["operating_margin"]),
            "roe": _info_get(info, "returnOnEquity", cap=_FLOAT_CAPS["roe"]),
            "roa": _info_get(info, "returnOnAssets", cap=_FLOAT_CAPS["roa"]),
            "debt_to_equity": _info_get(info, "debtToEquity", cap=_FLOAT_CAPS["debt_to_equity"]),
            "current_ratio": _info_get(info, "currentRatio", cap=_FLOAT_CAPS["current_ratio"]),
            "quick_ratio": _info_get(info, "quickRatio", cap=_FLOAT_CAPS["quick_ratio"]),
            "beta": _info_get(info, "beta", cap=_FLOAT_CAPS["beta"]),
            "52w_high": _info_get(info, "fiftyTwoWeekHigh"),
            "52w_low": _info_get(info, "fiftyTwoWeekLow"),
            "current_price": _info_get(info, "currentPrice", "regularMarketPrice"),
            "analyst_target_price": _info_get(info, "targetMeanPrice", "targetPrice"),
            "recommendation_mean": _info_get(info, "recommendationMean"),
            "number_of_analysts": _safe_float(info.get("numberOfAnalystOpinions") or info.get("numAnalystOpinions")),
        }

        _cache.set(cache_key, result)
        return result

    def get_health_score(self, ticker: str) -> Dict:
        """
        Compute financial health score (0-100) across four components.
        """
        cache_key = f"fundamental:health:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        overview = self.get_overview(ticker)

        profit_margin = overview.get("profit_margin")
        revenue_growth = overview.get("revenue_growth")
        debt_to_equity = overview.get("debt_to_equity")
        forward_pe = overview.get("forward_pe")

        # --- Profitability (0-25) ---
        if profit_margin is not None:
            if profit_margin > 0.20:
                profitability = 25
            elif profit_margin > 0.10:
                profitability = 18
            elif profit_margin > 0.05:
                profitability = 12
            elif profit_margin > 0.0:
                profitability = 6
            else:
                profitability = 0
        else:
            profitability = 10  # neutral when unknown

        # --- Growth (0-25) ---
        if revenue_growth is not None:
            if revenue_growth > 0.15:
                growth = 25
            elif revenue_growth > 0.08:
                growth = 18
            elif revenue_growth > 0.03:
                growth = 12
            elif revenue_growth > 0.0:
                growth = 6
            else:
                growth = 0
        else:
            growth = 10

        # --- Balance Sheet (0-25) ---
        if debt_to_equity is not None:
            # yfinance often returns D/E as a raw ratio
            de = debt_to_equity
            if de < 0.5:
                balance_sheet = 25
            elif de < 1.0:
                balance_sheet = 18
            elif de < 2.0:
                balance_sheet = 12
            elif de < 3.0:
                balance_sheet = 6
            else:
                balance_sheet = 0
        else:
            balance_sheet = 10

        # --- Valuation (0-25) ---
        if forward_pe is not None and forward_pe > 0:
            if forward_pe < 15:
                valuation = 25
            elif forward_pe < 20:
                valuation = 20
            elif forward_pe < 30:
                valuation = 14
            elif forward_pe < 50:
                valuation = 8
            else:
                valuation = 0
        else:
            valuation = 10

        overall_score = float(profitability + growth + balance_sheet + valuation)

        if overall_score >= 70:
            signal = "strong"
        elif overall_score >= 50:
            signal = "good"
        elif overall_score >= 30:
            signal = "fair"
        else:
            signal = "weak"

        explanation_parts = []
        pm_str = f"{profit_margin*100:.1f}%" if profit_margin is not None else "N/A"
        rg_str = f"{revenue_growth*100:.1f}%" if revenue_growth is not None else "N/A"
        de_str = f"{debt_to_equity:.2f}" if debt_to_equity is not None else "N/A"
        pe_str = f"{forward_pe:.1f}x" if forward_pe is not None else "N/A"
        explanation_parts.append(
            f"Overall health: {overall_score:.0f}/100 ({signal}). "
            f"Profitability: {profitability}/25 (margin {pm_str}), "
            f"Growth: {growth}/25 (rev growth {rg_str}), "
            f"Balance sheet: {balance_sheet}/25 (D/E {de_str}), "
            f"Valuation: {valuation}/25 (fwd PE {pe_str})."
        )

        result = {
            "ticker": ticker.upper(),
            "overall_score": overall_score,
            "components": {
                "profitability": profitability,
                "growth": growth,
                "balance_sheet": balance_sheet,
                "valuation": valuation,
            },
            "signal": signal,
            "explanation": " ".join(explanation_parts),
        }

        _cache.set(cache_key, result)
        return result

    def get_signals(self, ticker: str) -> List[Dict]:
        """
        Return fundamental signals for composite scoring.
        """
        cache_key = f"fundamental:signals:{ticker.upper()}"
        cached = _cache.get(cache_key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            overview = self.get_overview(ticker)
            health = self.get_health_score(ticker)
            signals: List[Dict] = []

            current_price = overview.get("current_price")
            analyst_target = overview.get("analyst_target_price")
            forward_pe = overview.get("forward_pe")
            revenue_growth = overview.get("revenue_growth")
            profit_margin = overview.get("profit_margin")
            health_score = health.get("overall_score", 50.0)

            # 1. Analyst Price Target Upside
            if current_price and analyst_target and current_price > 0:
                upside = (analyst_target / current_price) - 1.0
                if upside > 0.10:
                    strength = round(min(upside / 0.30, 0.90), 4)
                    signals.append({
                        "name": "Analyst Price Target Upside",
                        "category": "fundamental",
                        "direction": "bullish",
                        "strength": strength,
                        "value": round(analyst_target, 2),
                        "explanation": (
                            f"Analyst consensus target ${analyst_target:.2f} implies "
                            f"{upside*100:.1f}% upside from current ${current_price:.2f}."
                        ),
                    })
                elif upside < -0.10:
                    strength = round(min(abs(upside) / 0.30, 0.90), 4)
                    signals.append({
                        "name": "Analyst Price Target Upside",
                        "category": "fundamental",
                        "direction": "bearish",
                        "strength": strength,
                        "value": round(analyst_target, 2),
                        "explanation": (
                            f"Analyst consensus target ${analyst_target:.2f} implies "
                            f"{abs(upside)*100:.1f}% downside from current ${current_price:.2f}."
                        ),
                    })

            # 2. Valuation (Forward PE)
            if forward_pe is not None and forward_pe > 0:
                if forward_pe < 15:
                    signals.append({
                        "name": "Valuation (Forward PE)",
                        "category": "fundamental",
                        "direction": "bullish",
                        "strength": 0.70,
                        "value": round(forward_pe, 2),
                        "explanation": (
                            f"Forward PE of {forward_pe:.1f}x — below 15x; stock appears undervalued "
                            "relative to earnings power."
                        ),
                    })
                elif forward_pe > 35:
                    signals.append({
                        "name": "Valuation (Forward PE)",
                        "category": "fundamental",
                        "direction": "bearish",
                        "strength": 0.65,
                        "value": round(forward_pe, 2),
                        "explanation": (
                            f"Forward PE of {forward_pe:.1f}x — above 35x; elevated valuation increases "
                            "downside risk in a rising rate environment."
                        ),
                    })

            # 3. Revenue Growth
            if revenue_growth is not None:
                if revenue_growth > 0.10:
                    signals.append({
                        "name": "Revenue Growth",
                        "category": "fundamental",
                        "direction": "bullish",
                        "strength": 0.60,
                        "value": round(revenue_growth, 4),
                        "explanation": (
                            f"Revenue growth of {revenue_growth*100:.1f}% — strong top-line momentum "
                            "supports earnings expansion."
                        ),
                    })
                elif revenue_growth < 0:
                    signals.append({
                        "name": "Revenue Growth",
                        "category": "fundamental",
                        "direction": "bearish",
                        "strength": 0.55,
                        "value": round(revenue_growth, 4),
                        "explanation": (
                            f"Revenue declining {abs(revenue_growth)*100:.1f}% — negative top-line growth "
                            "signals business deterioration."
                        ),
                    })

            # 4. Profit Margin Quality
            if profit_margin is not None and profit_margin > 0.15:
                signals.append({
                    "name": "Profit Margin Quality",
                    "category": "fundamental",
                    "direction": "bullish",
                    "strength": 0.55,
                    "value": round(profit_margin, 4),
                    "explanation": (
                        f"Net profit margin of {profit_margin*100:.1f}% — high-quality earnings "
                        "with strong operating leverage."
                    ),
                })

            # 5. Financial Health Score
            if health_score > 70:
                signals.append({
                    "name": "Financial Health",
                    "category": "fundamental",
                    "direction": "bullish",
                    "strength": 0.60,
                    "value": round(health_score, 1),
                    "explanation": (
                        f"Financial health score of {health_score:.0f}/100 — strong balance sheet, "
                        "growth, and profitability profile."
                    ),
                })
            elif health_score < 30:
                signals.append({
                    "name": "Financial Health",
                    "category": "fundamental",
                    "direction": "bearish",
                    "strength": 0.60,
                    "value": round(health_score, 1),
                    "explanation": (
                        f"Financial health score of {health_score:.0f}/100 — weak fundamentals "
                        "including potential balance sheet stress or declining margins."
                    ),
                })

            _cache.set(cache_key, signals)
            return signals

        except Exception as e:
            logger.warning(f"FundamentalAnalyzer.get_signals({ticker}): {e}")
            return []
