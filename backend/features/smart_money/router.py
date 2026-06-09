from fastapi import APIRouter, HTTPException
from .analyzer import SmartMoneyAnalyzer

router = APIRouter()

_analyzer = SmartMoneyAnalyzer()


@router.get("/institutional/{ticker}")
def get_institutional(ticker: str):
    """Return institutional holdings breakdown for a ticker."""
    try:
        return _analyzer.get_institutional_data(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/{ticker}")
def get_signals(ticker: str):
    """Return smart money signals for composite scoring."""
    try:
        return _analyzer.get_signals(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
