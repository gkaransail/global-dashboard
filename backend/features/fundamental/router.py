from fastapi import APIRouter, HTTPException
from .analyzer import FundamentalAnalyzer

router = APIRouter()

_analyzer = FundamentalAnalyzer()


@router.get("/overview/{ticker}")
def get_overview(ticker: str):
    """Return fundamental overview for a ticker (valuation, margins, analyst targets)."""
    try:
        return _analyzer.get_overview(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health/{ticker}")
def get_health(ticker: str):
    """Return financial health score (0-100) across four components."""
    try:
        return _analyzer.get_health_score(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/{ticker}")
def get_signals(ticker: str):
    """Return fundamental signals for composite scoring."""
    try:
        return _analyzer.get_signals(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
