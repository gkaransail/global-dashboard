from fastapi import APIRouter, HTTPException
from .analyzer import SentimentAnalyzer

router = APIRouter()

_analyzer = SentimentAnalyzer()


@router.get("/news/{ticker}")
def get_news(ticker: str):
    """Return news sentiment analysis for a ticker."""
    try:
        return _analyzer.get_news_sentiment(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysts/{ticker}")
def get_analysts(ticker: str):
    """Return analyst ratings and price target summary."""
    try:
        return _analyzer.get_analyst_ratings(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview/{ticker}")
def get_overview(ticker: str):
    """Return composite sentiment overview combining news and analyst signals."""
    try:
        return _analyzer.get_sentiment_overview(ticker.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
