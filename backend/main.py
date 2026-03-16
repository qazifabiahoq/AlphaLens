import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from sentiment import SentimentAgent
from market_data import MarketDataHandler

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("AlphaLens")

app = FastAPI(title="AlphaLens API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sentiment_agent = SentimentAgent()
market_handler  = MarketDataHandler()
TRADES_FILE     = Path("trades.json")
MA_WINDOW       = 50
SENT_THRESH     = 7.0

COMPANY_NAMES = {
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "TSLA": "Tesla, Inc.",
    "NVDA": "NVIDIA Corporation",
}


def format_volume(vol: int) -> str:
    if vol >= 1_000_000_000:
        return f"{vol / 1_000_000_000:.1f}B"
    if vol >= 1_000_000:
        return f"{vol / 1_000_000:.1f}M"
    if vol >= 1_000:
        return f"{vol / 1_000:.1f}K"
    return str(int(vol))


def headline_sentiment(text: str) -> str:
    pos = ["beat", "surge", "record", "growth", "profit", "upgrade", "strong",
           "rally", "gain", "exceed", "outperform", "rise", "launch", "bullish"]
    neg = ["miss", "fall", "drop", "loss", "downgrade", "weak", "decline",
           "lawsuit", "fine", "cut", "warning", "crash", "bearish", "concern"]
    t = text.lower()
    p = sum(1 for w in pos if w in t)
    n = sum(1 for w in neg if w in t)
    if p > n:
        return "POSITIVE"
    if n > p:
        return "NEGATIVE"
    return "NEUTRAL"


def load_trades():
    if TRADES_FILE.exists():
        try:
            return json.loads(TRADES_FILE.read_text())
        except Exception:
            TRADES_FILE.write_text("[]")
            return []
    return []


def save_trade(trade):
    trades = load_trades()
    trades.append(trade)
    TRADES_FILE.write_text(json.dumps(trades, indent=2))


def compute_signal(ticker):
    df        = market_handler.get_historical(ticker, period="1y")
    news      = market_handler.get_news(ticker)
    sentiment = sentiment_agent.analyze(ticker, news)

    if df is None or len(df) < MA_WINDOW:
        return fallback_signal(ticker)

    price      = float(df["Close"].iloc[-1])
    ma50       = float(df["Close"].rolling(MA_WINDOW).mean().iloc[-1])
    prev_close = float(df["Close"].iloc[-2])
    change     = round(price - prev_close, 2)
    change_pct = round((price - prev_close) / prev_close * 100, 2)

    trend_ok = price > ma50
    sent_ok  = sentiment["score"] >= SENT_THRESH

    if trend_ok and sent_ok:
        signal = "BUY"
    elif sentiment["score"] < 3.0 or not trend_ok:
        signal = "SELL"
    else:
        signal = "HOLD"

    # Natural language explanation built from real FinBERT + market data
    sent_label  = sentiment["label"].upper()
    score       = sentiment["score"]
    n_headlines = sentiment.get("headlines_analyzed", 0)
    price_vs_ma = ((price - ma50) / ma50 * 100) if ma50 else 0
    direction   = "above" if trend_ok else "below"

    reason = (
        f"FinBERT analyzed {n_headlines} headlines for {ticker} and returned a conviction score of "
        f"{score:.1f}/10 ({sent_label} sentiment). The price (${price:.2f}) is {abs(price_vs_ma):.1f}% "
        f"{direction} the 50-day moving average (${ma50:.2f}). "
        f"A BUY requires conviction above 7.0 and price above the 50-day MA. "
        f"A SELL triggers when conviction falls below 3.0 or price drops below the 50-day MA. "
        f"With current readings, the signal is {signal}."
    )

    if signal in ("BUY", "SELL"):
        save_trade({
            "ticker":      ticker,
            "signal":      signal,
            "price":       round(price, 2),
            "timestamp":   datetime.now().isoformat(),
            "conviction":  sentiment["score"],
            "stop_loss":   round(price * 0.98, 2),
            "take_profit": round(price * 1.05, 2),
        })

    return {
        "ticker":           ticker,
        "company_name":     COMPANY_NAMES.get(ticker, ticker),
        "price":            round(price, 2),
        "change":           change,
        "change_percent":   change_pct,
        "signal":           signal,
        "reason":           reason,
        "sentiment_label":  sentiment["label"].upper(),
        "conviction_score": sentiment["score"],
        "trend_ok":         trend_ok,
        "ma50":             round(ma50, 2),
        "day_high":         round(float(df["High"].iloc[-1]), 2),
        "day_low":          round(float(df["Low"].iloc[-1]), 2),
        "open":             round(float(df["Open"].iloc[-1]), 2),
        "volume":           format_volume(int(df["Volume"].iloc[-1])),
        "headlines": [
            {
                "title":     h,
                "sentiment": headline_sentiment(h),
                "source":    "Yahoo Finance",
                "time_ago":  "today",
            }
            for h in news[:5]
        ],
    }


def fallback_signal(ticker):
    return {
        "ticker":           ticker,
        "company_name":     COMPANY_NAMES.get(ticker, ticker),
        "price":            0.0,
        "change":           0.0,
        "change_percent":   0.0,
        "signal":           "HOLD",
        "sentiment_label":  "NEUTRAL",
        "conviction_score": 5.0,
        "trend_ok":         False,
        "ma50":             0.0,
        "day_high":         0.0,
        "day_low":          0.0,
        "open":             0.0,
        "volume":           "0",
        "headlines":        [],
    }


@app.get("/")
def root():
    return {"status": "ok", "service": "AlphaLens API"}


@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/signal/{ticker}")
def get_signal(ticker: str):
    try:
        return compute_signal(ticker.upper())
    except Exception as e:
        log.error(f"Signal error {ticker}: {e}")
        return fallback_signal(ticker.upper())


@app.get("/api/positions")
def get_positions():
    trades   = load_trades()
    last     = {}
    for t in trades:
        last[t["ticker"]] = t
    open_pos = [t for t in last.values() if t["signal"] == "BUY"]
    return {"positions": open_pos, "count": len(open_pos)}


@app.get("/api/trades")
def get_trades():
    trades = load_trades()
    return {"trades": trades, "total": len(trades)}


# ── Backtest result cache (1-hour TTL) ───────────────────────────────────────
_backtest_cache: dict = {"result": None, "ts": None}
_BACKTEST_TTL = 3600  # seconds


@app.get("/api/backtest")
def get_backtest():
    # Return cached result if still fresh
    if _backtest_cache["result"] and _backtest_cache["ts"]:
        age = (datetime.now() - _backtest_cache["ts"]).total_seconds()
        if age < _BACKTEST_TTL:
            log.info(f"Returning cached backtest result (age {int(age)}s)")
            return _backtest_cache["result"]

    try:
        from backtest import (
            get_finbert_sentiment,
            load_price_data,
            build_signals,
            run_vectorbt_backtest,
            calc_portfolio_metrics,
            calc_benchmark_metrics,
            TICKERS as BT_TICKERS,
            BENCHMARK_TICKER as BT_BENCH,
            LOOKBACK_MONTHS,
            INITIAL_CAPITAL,
        )

        log.info("Running backtest via vectorbt + FinBERT...")

        sentiment_scores         = get_finbert_sentiment(BT_TICKERS)
        data                     = load_price_data(BT_TICKERS, months=LOOKBACK_MONTHS)
        price_df, entries, exits = build_signals(data, sentiment_scores)
        portfolio                = run_vectorbt_backtest(price_df, entries, exits)

        spy_close = data[BT_BENCH]["Close"]
        if isinstance(spy_close, pd.DataFrame):
            spy_close = spy_close.iloc[:, 0]
        spy_close.index = pd.to_datetime(spy_close.index)

        metrics       = calc_portfolio_metrics(portfolio)
        bench_metrics = calc_benchmark_metrics(spy_close)

        # Build equity curve list for the frontend chart
        total_value = portfolio.value().sum(axis=1)
        strat_eq    = total_value / total_value.iloc[0] * INITIAL_CAPITAL
        spy_eq      = INITIAL_CAPITAL * spy_close / spy_close.iloc[0]
        common      = strat_eq.index.intersection(spy_eq.index)
        strat_eq    = strat_eq.loc[common]
        spy_eq      = spy_eq.loc[common]

        def safe_float(v, default=0.0):
            """Replace NaN/Inf with a safe default for JSON serialization."""
            try:
                f = float(v)
                return default if (f != f or f == float('inf') or f == float('-inf')) else f
            except Exception:
                return default

        equity_curve = [
            {
                "date":      d.strftime("%Y-%m-%d"),
                "alphalens": safe_float(strat_eq.loc[d]),
                "spy":       safe_float(spy_eq.loc[d]),
            }
            for d in common
        ]

        result = {
            "equity_curve": equity_curve,
            "metrics": {
                "total_return":      safe_float(metrics["total_return"]),
                "vs_spy":            safe_float(metrics["total_return"] - bench_metrics["total_return"]),
                "sharpe_ratio":      safe_float(metrics["sharpe_ratio"]),
                "sortino_ratio":     safe_float(metrics["sortino_ratio"]),
                "max_drawdown":      safe_float(metrics["max_drawdown"]),
                "win_rate":          safe_float(metrics["win_rate"]),
                "total_trades":      metrics["total_trades"],
                "avg_hold_time":     safe_float(metrics["avg_hold_days"]),
                "annualized_return": safe_float(metrics["annualized_return"]),
                "spy_return":        safe_float(bench_metrics["total_return"]),
            },
        }

        _backtest_cache["result"] = result
        _backtest_cache["ts"]     = datetime.now()
        return result

    except Exception as e:
        log.error(f"Backtest error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")
