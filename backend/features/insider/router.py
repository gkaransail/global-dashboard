from fastapi import APIRouter, HTTPException
from .analyzer import InsiderAnalyzer

router = APIRouter()

_analyzer = InsiderAnalyzer()


@router.get("/transactions/{ticker}")
def get_transactions(ticker: str):
    """Fetch SEC insider transactions for a ticker."""
    try:
        return _analyzer.get_transactions(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/{ticker}")
def get_sentiment(ticker: str):
    """Compute insider sentiment score for a ticker."""
    try:
        return _analyzer.get_sentiment_score(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/{ticker}")
def get_signals(ticker: str):
    """Return insider buy/sell signals for composite scoring."""
    try:
        return _analyzer.get_signals(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
