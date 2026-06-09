from fastapi import APIRouter, HTTPException, Query
from .scanner import DashboardScanner

router = APIRouter()

scanner = DashboardScanner()


@router.get("/top10")
def get_top10(force_refresh: bool = Query(False)):
    """
    Return top 10 bullish and top 10 bearish stocks from the universe scan.
    Cached for 5 minutes; use force_refresh=true to bypass cache.
    """
    try:
        return scanner.get_top10(force_refresh=force_refresh)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/methodology")
def get_methodology():
    """Return scoring methodology and weight breakdown."""
    return {
        "description": "Multi-factor scoring using 6 categories",
        "weights": {
            "Options Chain Analysis": "30% — P/C ratio, max pain, unusual activity, IV skew",
            "Insider Trading": "25% — Net flow, cluster buys, CEO/CFO activity",
            "Technical Analysis": "20% — RSI, MACD, Bollinger Bands, MA crossovers, volume",
            "Fundamental Analysis": "10% — Analyst targets, PE ratio, revenue growth, margins",
            "Macro Environment": "10% — VIX, DXY, Gold, yields, sector breadth",
            "Market Sentiment": "5% — News sentiment, analyst consensus",
        },
        "predicted_price_method": (
            "30-day expected move = historical_volatility * sqrt(30/252), "
            "scaled by confidence score. Direction determined by composite score threshold (±0.05)."
        ),
        "universe_size": 50,
        "cache_ttl_seconds": 300,
    }
