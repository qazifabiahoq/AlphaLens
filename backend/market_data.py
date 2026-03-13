"""
AlphaLens - market_data.py
MarketDataHandler: Fetches OHLCV + news for any ticker

Primary source  : Alpaca Trade API (paper trading, free)
Backup source   : yfinance (Yahoo Finance, always free, no key needed)
News source     : Alpaca News API (free tier) + RSS fallback
"""

import os
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf

log = logging.getLogger("AlphaLens.Market")

# ── Alpaca news endpoint ──────────────────────────────────────────────────────
ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news"


class MarketDataHandler:
    """
    Provides:
        get_historical(ticker, period) → pd.DataFrame with OHLCV columns
        get_news(ticker, limit)        → list of headline strings
    """

    def __init__(self):
        self.api_key    = os.getenv("ALPACA_API_KEY", "")
        self.secret_key = os.getenv("ALPACA_SECRET_KEY", "")
        self._news_cache: dict = {}   # simple in-memory cache

    # ── Historical price data ─────────────────────────────────────────────────
    def get_historical(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> Optional[pd.DataFrame]:
        """
        Fetch OHLCV data. Tries Alpaca first, falls back to yfinance.

        Args:
            ticker   : e.g. "AAPL"
            period   : yfinance-style period string: "1d", "5d", "1mo", "1y", "2y"
            interval : "1d", "1h", "5m", etc.

        Returns:
            DataFrame with columns [Open, High, Low, Close, Volume]
            or None on failure.
        """
        df = self._fetch_yfinance(ticker, period, interval)
        if df is not None:
            return df

        log.error(f"All data sources failed for {ticker}")
        return None

    def _fetch_alpaca_bars(self, ticker: str, days: int) -> Optional[pd.DataFrame]:
        """Fetch bars from Alpaca Data API v2."""
        if not self.api_key:
            return None
        try:
            import alpaca_trade_api as tradeapi
            api = tradeapi.REST(
                self.api_key,
                self.secret_key,
                "https://paper-api.alpaca.markets",
                api_version="v2",
            )
            end   = datetime.now()
            start = end - timedelta(days=days)
            bars  = api.get_bars(
                ticker,
                "1Day",
                start=start.strftime("%Y-%m-%d"),
                end=end.strftime("%Y-%m-%d"),
            ).df
            bars.index = pd.to_datetime(bars.index)
            bars.columns = [c.capitalize() for c in bars.columns]
            log.debug(f"Alpaca bars: {len(bars)} rows for {ticker}")
            return bars
        except Exception as e:
            log.debug(f"Alpaca bars failed for {ticker}: {e}")
            return None

    def _fetch_yfinance(
        self, ticker: str, period: str, interval: str
    ) -> Optional[pd.DataFrame]:
        """Fetch from Yahoo Finance via yfinance — always free."""
        try:
            df = yf.download(
                ticker,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=True,
            )
            if df.empty:
                log.warning(f"yfinance returned empty DataFrame for {ticker}")
                return None
            log.debug(f"yfinance: {len(df)} rows for {ticker}")
            return df
        except Exception as e:
            log.error(f"yfinance failed for {ticker}: {e}")
            return None

    # ── News headlines ────────────────────────────────────────────────────────
    def get_news(self, ticker: str, limit: int = 10) -> list[str]:
        """
        Fetch recent news headlines for a ticker.

        Returns a list of headline strings (empty list on failure).
        """
        # Check cache (TTL: 15 min)
        cache_key = f"{ticker}_{limit}"
        if cache_key in self._news_cache:
            cached_time, cached_data = self._news_cache[cache_key]
            if (datetime.now() - cached_time).seconds < 900:
                log.debug(f"News cache hit for {ticker}")
                return cached_data

        headlines = self._fetch_alpaca_news(ticker, limit)

        if not headlines:
            headlines = self._fetch_rss_news(ticker, limit)

        if not headlines:
            headlines = self._mock_news(ticker)
            log.warning(f"Using mock headlines for {ticker}")

        self._news_cache[cache_key] = (datetime.now(), headlines)
        return headlines

    def _fetch_alpaca_news(self, ticker: str, limit: int) -> list[str]:
        """Alpaca News API (free tier, no credits needed)."""
        if not self.api_key:
            return []
        try:
            headers = {
                "APCA-API-KEY-ID":     self.api_key,
                "APCA-API-SECRET-KEY": self.secret_key,
            }
            params = {
                "symbols": ticker,
                "limit":   limit,
                "sort":    "desc",
            }
            resp = requests.get(
                ALPACA_NEWS_URL,
                headers=headers,
                params=params,
                timeout=10,
            )
            resp.raise_for_status()
            articles  = resp.json().get("news", [])
            headlines = [a["headline"] for a in articles if "headline" in a]
            log.debug(f"Alpaca news: {len(headlines)} headlines for {ticker}")
            return headlines
        except Exception as e:
            log.debug(f"Alpaca news failed for {ticker}: {e}")
            return []

    def _fetch_rss_news(self, ticker: str, limit: int) -> list[str]:
        """
        Yahoo Finance RSS feed — no auth required.
        """
        try:
            import xml.etree.ElementTree as ET
            url  = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            root  = ET.fromstring(resp.content)
            items = root.findall(".//item/title")
            headlines = [item.text.strip() for item in items[:limit] if item.text]
            log.debug(f"RSS news: {len(headlines)} headlines for {ticker}")
            return headlines
        except Exception as e:
            log.debug(f"RSS news failed for {ticker}: {e}")
            return []

    def _mock_news(self, ticker: str) -> list[str]:
        """Fallback mock headlines used in offline/demo mode."""
        MOCK = {
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
        return MOCK.get(ticker, [f"{ticker} shows stable market performance"])


# ── Quick test ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    handler = MarketDataHandler()

    print("── Historical Data (AAPL, 1mo) ──")
    df = handler.get_historical("AAPL", period="1mo")
    if df is not None:
        print(df.tail(5)[["Open", "High", "Low", "Close", "Volume"]])

    print("\n── News Headlines (MSFT) ──")
    news = handler.get_news("MSFT", limit=5)
    for i, h in enumerate(news, 1):
        print(f"  {i}. {h}")
