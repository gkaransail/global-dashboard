"""
Technical Analysis Analyzer.

Calculates indicators (RSI, MACD, Bollinger Bands, MAs, ATR, Stochastic, Volume),
price targets (support/resistance, Fibonacci), and chart patterns from OHLCV data.
"""

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from core import cache as _cache
from core.data.fetcher import fetch_ohlcv

logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes


# ---------- indicator helpers ----------

def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _macd(close: pd.Series) -> Tuple[pd.Series, pd.Series, pd.Series]:
    fast = _ema(close, 12)
    slow = _ema(close, 26)
    macd_line = fast - slow
    signal_line = _ema(macd_line, 9)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _bollinger(close: pd.Series, window: int = 20, num_std: float = 2.0):
    sma = close.rolling(window).mean()
    std = close.rolling(window).std()
    upper = sma + num_std * std
    lower = sma - num_std * std
    bandwidth = (upper - lower) / sma.replace(0, np.nan)
    pct_b = (close - lower) / (upper - lower).replace(0, np.nan)
    return sma, upper, lower, bandwidth, pct_b


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    hl = high - low
    hc = (high - close.shift()).abs()
    lc = (low - close.shift()).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, adjust=False).mean()


def _stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k_period: int = 14, d_period: int = 3):
    lowest_low = low.rolling(k_period).min()
    highest_high = high.rolling(k_period).max()
    denom = (highest_high - lowest_low).replace(0, np.nan)
    k = 100 * (close - lowest_low) / denom
    d = k.rolling(d_period).mean()
    return k, d


def _safe_float(val: Any) -> Optional[float]:
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _round(val: Any, decimals: int = 4) -> Optional[float]:
    f = _safe_float(val)
    return round(f, decimals) if f is not None else None


# ---------- main class ----------

class TechnicalAnalyzer:
    """Advanced technical analysis using OHLCV data."""

    def get_indicators(self, ticker: str, period: str = "3mo") -> Dict:
        """
        Return comprehensive technical indicators calculated from OHLCV data.
        """
        key = f"technical:indicators:{ticker.upper()}:{period}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        df = fetch_ohlcv(ticker.upper(), period=period)
        if df is None or len(df) < 30:
            return {"error": "Insufficient data", "ticker": ticker.upper()}

        close = df["Close"].squeeze()
        high = df["High"].squeeze() if "High" in df.columns else close
        low = df["Low"].squeeze() if "Low" in df.columns else close
        volume = df["Volume"].squeeze() if "Volume" in df.columns else pd.Series(dtype=float)

        current_price = _round(close.iloc[-1], 2)

        # --- RSI ---
        rsi_series = _rsi(close)
        rsi_val = _round(rsi_series.iloc[-1], 2)
        if rsi_val is not None:
            if rsi_val < 30:
                rsi_signal = "oversold"
            elif rsi_val > 70:
                rsi_signal = "overbought"
            else:
                rsi_signal = "neutral"
        else:
            rsi_signal = "neutral"

        # --- MACD ---
        macd_line, signal_line, histogram = _macd(close)
        macd_val = _round(macd_line.iloc[-1], 4)
        signal_val = _round(signal_line.iloc[-1], 4)
        hist_val = _round(histogram.iloc[-1], 4)
        macd_signal = "neutral"
        if len(histogram.dropna()) >= 2:
            prev_hist = _safe_float(histogram.dropna().iloc[-2])
            curr_hist = _safe_float(histogram.dropna().iloc[-1])
            if prev_hist is not None and curr_hist is not None:
                if prev_hist < 0 and curr_hist > 0:
                    macd_signal = "bullish_cross"
                elif prev_hist > 0 and curr_hist < 0:
                    macd_signal = "bearish_cross"

        # --- Bollinger Bands ---
        bb_mid, bb_upper, bb_lower, bb_bw, bb_pct_b = _bollinger(close)
        bb_upper_val = _round(bb_upper.iloc[-1], 2)
        bb_mid_val = _round(bb_mid.iloc[-1], 2)
        bb_lower_val = _round(bb_lower.iloc[-1], 2)
        bb_bw_val = _round(bb_bw.iloc[-1], 4)
        bb_pct_b_val = _round(bb_pct_b.iloc[-1], 4)
        # Squeeze: current bandwidth < 70% of 20d average bandwidth
        bb_bw_20d_avg = _safe_float(bb_bw.iloc[-20:].mean()) if len(bb_bw) >= 20 else bb_bw_val
        bb_squeeze = (bb_bw_val is not None and bb_bw_20d_avg is not None and
                      bb_bw_val < bb_bw_20d_avg * 0.70)

        # --- Moving Averages ---
        sma20 = _round(close.rolling(20).mean().iloc[-1], 2) if len(close) >= 20 else None
        sma50 = _round(close.rolling(50).mean().iloc[-1], 2) if len(close) >= 50 else None
        sma200 = _round(close.rolling(200).mean().iloc[-1], 2) if len(close) >= 200 else None
        ema12 = _round(_ema(close, 12).iloc[-1], 2)
        ema26 = _round(_ema(close, 26).iloc[-1], 2)

        # MA trend
        price = _safe_float(close.iloc[-1])
        ma_trend = "mixed"
        if sma20 is not None and sma50 is not None and price is not None:
            if price > sma20 > sma50:
                ma_trend = "bullish"
            elif price < sma20 < sma50:
                ma_trend = "bearish"

        # --- ATR ---
        atr_series = _atr(high, low, close)
        atr_val = _round(atr_series.iloc[-1], 4)
        atr_pct = _round(atr_val / price, 4) if (atr_val is not None and price and price > 0) else None

        # --- Stochastic ---
        stoch_k, stoch_d = _stochastic(high, low, close)
        k_val = _round(stoch_k.iloc[-1], 2)
        d_val = _round(stoch_d.iloc[-1], 2)
        stoch_signal = "neutral"
        if k_val is not None:
            if k_val > 80:
                stoch_signal = "overbought"
            elif k_val < 20:
                stoch_signal = "oversold"

        # --- Volume ---
        vol_data: Dict = {}
        if not volume.empty and len(volume) >= 5:
            avg_vol_20d = _safe_float(volume.iloc[-20:].mean()) if len(volume) >= 20 else _safe_float(volume.mean())
            current_vol = _safe_float(volume.iloc[-1])
            vol_ratio = _round(current_vol / avg_vol_20d, 2) if (avg_vol_20d and avg_vol_20d > 0 and current_vol is not None) else None
            vol_trend_val = "increasing"
            if len(volume) >= 10:
                recent_avg = _safe_float(volume.iloc[-5:].mean())
                prior_avg = _safe_float(volume.iloc[-10:-5].mean())
                if recent_avg is not None and prior_avg is not None and prior_avg > 0:
                    vol_trend_val = "increasing" if recent_avg > prior_avg * 1.02 else "decreasing"
            vol_data = {
                "avg_volume_20d": _round(avg_vol_20d, 0),
                "current_volume": _round(current_vol, 0),
                "vol_ratio": vol_ratio,
                "trend": vol_trend_val,
            }

        result = {
            "ticker": ticker.upper(),
            "period": period,
            "current_price": current_price,
            "rsi": {
                "value": rsi_val,
                "signal": rsi_signal,
            },
            "macd": {
                "macd_line": macd_val,
                "signal_line": signal_val,
                "histogram": hist_val,
                "signal": macd_signal,
            },
            "bollinger_bands": {
                "upper": bb_upper_val,
                "middle": bb_mid_val,
                "lower": bb_lower_val,
                "bandwidth": bb_bw_val,
                "pct_b": bb_pct_b_val,
                "squeeze": bb_squeeze,
            },
            "moving_averages": {
                "sma20": sma20,
                "sma50": sma50,
                "sma200": sma200,
                "ema12": ema12,
                "ema26": ema26,
                "ma_trend": ma_trend,
            },
            "atr": {
                "value": atr_val,
                "atr_pct": atr_pct,
            },
            "stochastic": {
                "k": k_val,
                "d": d_val,
                "signal": stoch_signal,
            },
            "volume": vol_data,
        }

        _cache.set(key, result)
        return result

    def get_price_targets(self, ticker: str, period: str = "3mo") -> Dict:
        """
        Return support/resistance levels, Fibonacci retracements, trend, and price targets.
        """
        key = f"technical:targets:{ticker.upper()}:{period}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        df = fetch_ohlcv(ticker.upper(), period=period)
        if df is None or len(df) < 20:
            return {"error": "Insufficient data", "ticker": ticker.upper()}

        close = df["Close"].squeeze()
        high = df["High"].squeeze() if "High" in df.columns else close
        low = df["Low"].squeeze() if "Low" in df.columns else close

        current_price = float(close.iloc[-1])

        # --- Trend detection ---
        window = min(20, len(close) // 2)
        sma_recent = float(close.iloc[-window:].mean()) if len(close) >= window else current_price
        sma_prior = float(close.iloc[-window * 2:-window].mean()) if len(close) >= window * 2 else sma_recent

        price_change = (current_price / float(close.iloc[0]) - 1) if len(close) > 1 else 0.0
        if sma_recent > sma_prior * 1.02:
            trend = "uptrend"
            trend_strength = min(abs(price_change) * 2, 1.0)
        elif sma_recent < sma_prior * 0.98:
            trend = "downtrend"
            trend_strength = min(abs(price_change) * 2, 1.0)
        else:
            trend = "sideways"
            trend_strength = max(0.0, 1.0 - abs(price_change) * 5)

        # --- Support and resistance: rolling window local minima/maxima ---
        lookback = min(len(close), 90)
        close_90 = close.iloc[-lookback:]
        high_90 = high.iloc[-lookback:]
        low_90 = low.iloc[-lookback:]

        roll_w = 5
        local_lows: List[float] = []
        local_highs: List[float] = []

        prices_arr = close_90.values
        lows_arr = low_90.values
        highs_arr = high_90.values

        for i in range(roll_w, len(prices_arr) - roll_w):
            window_lows = lows_arr[i - roll_w: i + roll_w + 1]
            window_highs = highs_arr[i - roll_w: i + roll_w + 1]
            if lows_arr[i] == window_lows.min():
                local_lows.append(float(lows_arr[i]))
            if highs_arr[i] == window_highs.max():
                local_highs.append(float(highs_arr[i]))

        # Deduplicate and sort
        def _cluster(levels: List[float], threshold: float = 0.02) -> List[float]:
            if not levels:
                return []
            levels = sorted(levels)
            clustered = [levels[0]]
            for lv in levels[1:]:
                if abs(lv - clustered[-1]) / max(abs(clustered[-1]), 1e-6) > threshold:
                    clustered.append(lv)
            return clustered

        support_clustered = _cluster(local_lows)
        resistance_clustered = _cluster(local_highs)

        # Filter: supports below current price, resistances above
        support_levels = sorted(
            [l for l in support_clustered if l < current_price * 1.01],
            reverse=True
        )[:3]
        resistance_levels = sorted(
            [l for l in resistance_clustered if l > current_price * 0.99]
        )[:3]

        # Fill with percentage-based fallbacks if not enough levels
        while len(support_levels) < 3:
            last = support_levels[-1] if support_levels else current_price
            support_levels.append(round(last * 0.97, 2))
        while len(resistance_levels) < 3:
            last = resistance_levels[-1] if resistance_levels else current_price
            resistance_levels.append(round(last * 1.03, 2))

        support_levels = [round(l, 2) for l in support_levels[:3]]
        resistance_levels = [round(l, 2) for l in resistance_levels[:3]]

        # --- Fibonacci retracements ---
        swing_high = float(high_90.max())
        swing_low = float(low_90.min())
        fib_range = swing_high - swing_low

        fibonacci_levels = {}
        for ratio in [0.236, 0.382, 0.5, 0.618, 0.786]:
            if trend == "downtrend":
                # Retrace from swing_high downward
                fib_price = swing_high - fib_range * ratio
            else:
                # Retrace from swing_low upward
                fib_price = swing_low + fib_range * ratio
            fibonacci_levels[str(ratio)] = round(fib_price, 2)

        # --- ATR for price targets ---
        atr_series = _atr(high, low, close)
        atr_val = float(atr_series.iloc[-1]) if not atr_series.empty else current_price * 0.02

        next_resistance = resistance_levels[0] if resistance_levels else current_price * 1.05
        next_support = support_levels[0] if support_levels else current_price * 0.95

        price_target_bull = round(next_resistance + atr_val, 2)
        price_target_bear = round(next_support - atr_val, 2)

        result = {
            "ticker": ticker.upper(),
            "period": period,
            "current_price": round(current_price, 2),
            "trend": trend,
            "trend_strength": round(trend_strength, 4),
            "support_levels": support_levels,
            "resistance_levels": resistance_levels,
            "fibonacci_levels": fibonacci_levels,
            "swing_high": round(swing_high, 2),
            "swing_low": round(swing_low, 2),
            "price_target_bull": price_target_bull,
            "price_target_bear": price_target_bear,
        }

        _cache.set(key, result)
        return result

    def get_chart_patterns(self, ticker: str, period: str = "3mo") -> List[Dict]:
        """
        Detect simple chart patterns from OHLCV data.
        """
        key = f"technical:patterns:{ticker.upper()}:{period}"
        cached = _cache.get(key, CACHE_TTL)
        if cached is not None:
            return cached

        try:
            df = fetch_ohlcv(ticker.upper(), period=period)
            if df is None or len(df) < 30:
                return []

            close = df["Close"].squeeze()
            high = df["High"].squeeze() if "High" in df.columns else close
            low = df["Low"].squeeze() if "Low" in df.columns else close

            patterns: List[Dict] = []
            prices = close.values
            highs = high.values
            lows = low.values
            n = len(prices)
            current = float(prices[-1])

            # --- Double Bottom ---
            try:
                recent_lows = []
                for i in range(5, n - 5):
                    window_l = lows[max(0, i - 5): i + 6]
                    if lows[i] == window_l.min():
                        recent_lows.append((i, float(lows[i])))
                if len(recent_lows) >= 2:
                    l1_idx, l1_val = recent_lows[-2]
                    l2_idx, l2_val = recent_lows[-1]
                    diff_pct = abs(l1_val - l2_val) / max(abs(l1_val), 1e-6)
                    if diff_pct < 0.03 and l2_idx > l1_idx + 5:
                        recovery = current > max(l1_val, l2_val) * 1.02
                        if recovery:
                            patterns.append({
                                "name": "Double Bottom",
                                "direction": "bullish",
                                "strength": 0.75,
                                "description": (
                                    f"Two lows at ~${l1_val:.2f} and ~${l2_val:.2f} (within {diff_pct*100:.1f}%) "
                                    "with price recovering above both — classic reversal pattern."
                                ),
                            })
            except Exception:
                pass

            # --- Double Top ---
            try:
                recent_highs = []
                for i in range(5, n - 5):
                    window_h = highs[max(0, i - 5): i + 6]
                    if highs[i] == window_h.max():
                        recent_highs.append((i, float(highs[i])))
                if len(recent_highs) >= 2:
                    h1_idx, h1_val = recent_highs[-2]
                    h2_idx, h2_val = recent_highs[-1]
                    diff_pct = abs(h1_val - h2_val) / max(abs(h1_val), 1e-6)
                    if diff_pct < 0.03 and h2_idx > h1_idx + 5:
                        declined = current < min(h1_val, h2_val) * 0.98
                        if declined:
                            patterns.append({
                                "name": "Double Top",
                                "direction": "bearish",
                                "strength": 0.75,
                                "description": (
                                    f"Two highs at ~${h1_val:.2f} and ~${h2_val:.2f} (within {diff_pct*100:.1f}%) "
                                    "with price declining below both — distribution pattern, bearish signal."
                                ),
                            })
            except Exception:
                pass

            # --- Higher Highs, Higher Lows (uptrend) ---
            try:
                if n >= 20:
                    seg = prices[-20:]
                    seg_h = highs[-20:]
                    seg_l = lows[-20:]
                    q1_h, q2_h = float(seg_h[:10].max()), float(seg_h[10:].max())
                    q1_l, q2_l = float(seg_l[:10].min()), float(seg_l[10:].min())
                    if q2_h > q1_h * 1.01 and q2_l > q1_l * 1.01:
                        patterns.append({
                            "name": "Higher Highs Higher Lows",
                            "direction": "bullish",
                            "strength": 0.65,
                            "description": (
                                "Price making progressively higher highs and higher lows — "
                                "confirmed uptrend structure with strong momentum."
                            ),
                        })
            except Exception:
                pass

            # --- Lower Highs, Lower Lows (downtrend) ---
            try:
                if n >= 20:
                    seg = prices[-20:]
                    seg_h = highs[-20:]
                    seg_l = lows[-20:]
                    q1_h, q2_h = float(seg_h[:10].max()), float(seg_h[10:].max())
                    q1_l, q2_l = float(seg_l[:10].min()), float(seg_l[10:].min())
                    if q2_h < q1_h * 0.99 and q2_l < q1_l * 0.99:
                        patterns.append({
                            "name": "Lower Highs Lower Lows",
                            "direction": "bearish",
                            "strength": 0.65,
                            "description": (
                                "Price making progressively lower highs and lower lows — "
                                "confirmed downtrend structure, trend-following signals bearish."
                            ),
                        })
            except Exception:
                pass

            # --- Bull Flag ---
            try:
                if n >= 15:
                    # Sharp rise in first half, consolidation in second half
                    first_half = prices[-15:-5]
                    second_half = prices[-5:]
                    rise_pct = (float(first_half[-1]) - float(first_half[0])) / max(abs(float(first_half[0])), 1e-6)
                    consolidation_range = (float(second_half.max()) - float(second_half.min())) / max(abs(float(second_half.mean())), 1e-6)
                    if rise_pct > 0.05 and consolidation_range < 0.03:
                        patterns.append({
                            "name": "Bull Flag",
                            "direction": "bullish",
                            "strength": 0.70,
                            "description": (
                                f"Sharp rise of {rise_pct*100:.1f}% followed by tight consolidation "
                                f"({consolidation_range*100:.1f}% range) — bull flag; breakout continuation likely."
                            ),
                        })
            except Exception:
                pass

            # --- Consolidation (sideways, low volatility) ---
            try:
                if n >= 15:
                    recent_20 = prices[-20:] if n >= 20 else prices
                    total_range = (float(recent_20.max()) - float(recent_20.min())) / max(abs(float(recent_20.mean())), 1e-6)
                    std_pct = float(np.std(recent_20)) / max(abs(float(np.mean(recent_20))), 1e-6)
                    if total_range < 0.05 and std_pct < 0.015:
                        patterns.append({
                            "name": "Consolidation",
                            "direction": "neutral",
                            "strength": 0.50,
                            "description": (
                                f"Price in tight {total_range*100:.1f}% range over last 20 days — "
                                "low volatility consolidation; watch for breakout direction."
                            ),
                        })
            except Exception:
                pass

            _cache.set(key, patterns)
            return patterns

        except Exception as e:
            logger.warning(f"TechnicalAnalyzer.get_chart_patterns({ticker}): {e}")
            return []
