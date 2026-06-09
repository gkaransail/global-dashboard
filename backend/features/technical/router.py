from fastapi import APIRouter, HTTPException, Query
from .analyzer import TechnicalAnalyzer

router = APIRouter()

_analyzer = TechnicalAnalyzer()


@router.get("/indicators/{ticker}")
def get_indicators(
    ticker: str,
    period: str = Query("3mo", description="Lookback period: 1mo | 3mo | 6mo | 1y"),
):
    """Return comprehensive technical indicators for a ticker."""
    try:
        return _analyzer.get_indicators(ticker.upper(), period=period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/targets/{ticker}")
def get_targets(
    ticker: str,
    period: str = Query("3mo", description="Lookback period: 1mo | 3mo | 6mo | 1y"),
):
    """Return support/resistance levels, Fibonacci retracements, and price targets."""
    try:
        return _analyzer.get_price_targets(ticker.upper(), period=period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patterns/{ticker}")
def get_patterns(
    ticker: str,
    period: str = Query("3mo", description="Lookback period: 1mo | 3mo | 6mo | 1y"),
):
    """Detect chart patterns from OHLCV data."""
    try:
        return _analyzer.get_chart_patterns(ticker.upper(), period=period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
