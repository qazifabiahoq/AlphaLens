import os
import logging
import requests
from datetime import datetime
from typing import Optional

import pandas as pd

log = logging.getLogger("AlphaLens.Market")


# ── NewsFetcher ───────────────────────────────────────────────────────────────
class NewsFetcher:
    """
    Gathers financial news headlines for specific tickers.
    Primary source: Yahoo Finance RSS feed.
    Fallback: curated mock headlines per ticker.
    """

    _MOCK: dict = {
        "AAPL": [
            "Apple reports record iPhone sales, beats Wall Street estimates",
            "Apple expands AI features across iOS ecosystem",
            "Analyst raises Apple price target to $220 citing services growth",
        ],
        "MSFT": [
            "Microsoft Azure revenue grows 30% driven by AI demand",
            "Microsoft Copilot adoption accelerates across enterprise",
            "Strong earnings beat pushes Microsoft shares higher",
        ],
        "TSLA": [
            "Tesla delivers record quarterly vehicles amid strong demand",
            "Tesla Cybertruck production ramps ahead of schedule",
            "Analyst upgrades Tesla citing energy storage growth",
        ],
        "NVDA": [
            "NVIDIA data center revenue surges on AI chip demand",
            "NVIDIA Blackwell GPU fully sold out through next year",
            "NVIDIA raises guidance as hyperscaler spending accelerates",
        ],
    }

    def __init__(self):
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        })
        self._cache: dict = {}

    def fetch(self, ticker: str, limit: int = 10) -> list:
        """Return up to `limit` headlines for `ticker`. Cached for 15 minutes."""
        cache_key = f"{ticker}_{limit}"
        if cache_key in self._cache:
            cached_time, cached_data = self._cache[cache_key]
            if (datetime.now() - cached_time).seconds < 900:
                return cached_data

        headlines = self._fetch_rss(ticker, limit)

        if not headlines:
            headlines = self._MOCK.get(ticker, [f"{ticker} shows stable market performance"])
            log.warning(f"Using mock headlines for {ticker}")

        self._cache[cache_key] = (datetime.now(), headlines)
        return headlines

    def _fetch_rss(self, ticker: str, limit: int) -> list:
        try:
            import xml.etree.ElementTree as ET
            url = (
                f"https://feeds.finance.yahoo.com/rss/2.0/headline"
                f"?s={ticker}&region=US&lang=en-US"
            )
            resp = self._session.get(url, timeout=10)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            items = root.findall(".//item/title")
            headlines = [item.text.strip() for item in items[:limit] if item.text]
            log.info(f"RSS news: {len(headlines)} headlines for {ticker}")
            return headlines
        except Exception as e:
            log.debug(f"RSS news failed for {ticker}: {e}")
            return []


# ── MarketDataHandler ─────────────────────────────────────────────────────────
class MarketDataHandler:
    """
    Fetches historical OHLCV market data (yfinance) and news headlines
    (via NewsFetcher) for a given ticker.
    """

    def __init__(self):
        self._news_fetcher = NewsFetcher()
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        })

    def get_historical(self, ticker: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
        df = self._fetch_yfinance(ticker, period, interval)
        if df is not None:
            return df
        log.error(f"All data sources failed for {ticker}")
        return None

    def _fetch_yfinance(self, ticker: str, period: str, interval: str) -> Optional[pd.DataFrame]:
        try:
            import yfinance as yf
            t = yf.Ticker(ticker, session=self._session)
            df = t.history(period=period, interval=interval)
            if df is None or df.empty:
                log.warning(f"yfinance returned empty DataFrame for {ticker}")
                return None
            df.index = pd.to_datetime(df.index)
            log.info(f"yfinance: {len(df)} rows for {ticker}")
            return df
        except Exception as e:
            log.error(f"yfinance failed for {ticker}: {e}")
            return None

    def get_news(self, ticker: str, limit: int = 10) -> list:
        return self._news_fetcher.fetch(ticker, limit)
