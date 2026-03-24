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

# ── Strategy constants (mirrors bot.py) ──────────────────────────────────────
MA_WINDOW        = 50     # 50-day moving average
RSI_PERIOD       = 14
RSI_BUY_MIN      = 30     # Below = falling knife
RSI_BUY_MAX      = 70     # Above = overbought
RSI_EXIT         = 75     # Exit existing position
ATR_PERIOD       = 14
ATR_SL_MULT      = 1.5    # Stop-loss = entry − 1.5×ATR
ATR_TP_MULT      = 3.0    # Take-profit = entry + 3×ATR
VOLUME_MA        = 20
VOLUME_MIN       = 1.1    # Volume must be 10% above 20-day average
SENT_THRESH      = 7.0
SENT_EXIT        = 3.0

COMPANY_NAMES = {
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "TSLA": "Tesla, Inc.",
    "NVDA": "NVIDIA Corporation",
}


def _calc_rsi(close: pd.Series, period: int = RSI_PERIOD) -> float:
    """Wilder's RSI(14). Returns NaN-safe float."""
    delta    = close.diff()
    gain     = delta.clip(lower=0)
    loss     = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    rsi      = 100 - (100 / (1 + rs))
    val      = float(rsi.iloc[-1])
    return val if val == val else 50.0  # NaN-safe fallback


def _calc_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> float:
    """Average True Range(14). Returns NaN-safe float."""
    high, low, close = df["High"], df["Low"], df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    val = float(tr.rolling(period).mean().iloc[-1])
    return val if val == val else 1.0


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

    if df is None or len(df) < MA_WINDOW + 5:
        return fallback_signal(ticker)

    close      = df["Close"]
    price      = float(close.iloc[-1])
    prev_close = float(close.iloc[-2])
    open_      = float(df["Open"].iloc[-1])
    change     = round(price - prev_close, 2)
    change_pct = round((price - prev_close) / prev_close * 100, 2)

    # ── Compute indicators ────────────────────────────────────────────────────
    ma50      = float(close.rolling(MA_WINDOW).mean().iloc[-1])
    rsi       = _calc_rsi(close)
    atr       = _calc_atr(df)
    vol_avg   = float(df["Volume"].rolling(VOLUME_MA).mean().iloc[-1])
    vol_now   = float(df["Volume"].iloc[-1])
    vol_ratio = vol_now / vol_avg if vol_avg else 1.0

    # ── Entry gate: ALL 4 must pass ───────────────────────────────────────────
    trend_ok  = price > ma50                            # 1. uptrend
    rsi_ok    = RSI_BUY_MIN <= rsi <= RSI_BUY_MAX       # 2. not overbought / not falling knife
    volume_ok = vol_ratio >= VOLUME_MIN                  # 3. real buying pressure
    sent_ok   = sentiment["score"] >= SENT_THRESH        # 4. AI confirms positive news
    entry_ok  = trend_ok and rsi_ok and volume_ok and sent_ok

    # ── Exit gate: ANY one triggers sell ─────────────────────────────────────
    any_exit = (
        not trend_ok
        or rsi > RSI_EXIT
        or sentiment["score"] < SENT_EXIT
    )

    if entry_ok:
        signal = "BUY"
    elif any_exit:
        signal = "SELL"
    else:
        signal = "HOLD"

    # ── ATR-based stop-loss / take-profit ─────────────────────────────────────
    sl_price = round(price - ATR_SL_MULT * atr, 2)   # 1.5× ATR below entry
    tp_price = round(price + ATR_TP_MULT * atr, 2)   # 3.0× ATR above entry (2:1 R/R)

    # ── Reason string ─────────────────────────────────────────────────────────
    score       = sentiment["score"]
    sent_label  = sentiment["label"].upper()
    n_headlines = sentiment.get("headlines_analyzed", 0)
    price_vs_ma = (price - ma50) / ma50 * 100

    if signal == "BUY":
        reason = (
            f"All 4 entry conditions passed for {ticker}. "
            f"FinBERT scored {score:.1f}/10 ({sent_label}) across {n_headlines} headlines. "
            f"Price (${price:.2f}) is {price_vs_ma:+.1f}% above the 50-day MA (${ma50:.2f}) — uptrend confirmed. "
            f"RSI at {rsi:.1f} — not overbought. Volume is {vol_ratio:.1f}× the 20-day average — real demand. "
            f"Stop-loss: ${sl_price} (1.5×ATR below entry). Take-profit: ${tp_price} (3×ATR, 2:1 reward-to-risk)."
        )
    elif signal == "SELL":
        exit_reasons = []
        if not trend_ok:                  exit_reasons.append(f"price (${price:.2f}) broke below 50MA (${ma50:.2f})")
        if rsi > RSI_EXIT:                exit_reasons.append(f"RSI {rsi:.1f} > {RSI_EXIT} — overbought")
        if sentiment["score"] < SENT_EXIT: exit_reasons.append(f"conviction fell to {score:.1f}/10 — negative news")
        reason = (
            f"SELL signal for {ticker}: {'; '.join(exit_reasons)}. "
            f"FinBERT: {score:.1f}/10 ({sent_label}, {n_headlines} headlines). "
            f"Price vs 50MA: {price_vs_ma:+.1f}%. RSI: {rsi:.1f}."
        )
    else:
        failed = []
        if not trend_ok:  failed.append(f"price below 50MA")
        if not rsi_ok:    failed.append(f"RSI {rsi:.1f} outside 30–70")
        if not volume_ok: failed.append(f"volume only {vol_ratio:.1f}× avg (need {VOLUME_MIN}×)")
        if not sent_ok:   failed.append(f"conviction {score:.1f}/10 below {SENT_THRESH}")
        reason = (
            f"HOLD for {ticker}. "
            f"{'Conditions not met: ' + '; '.join(failed) if failed else 'Waiting for entry conditions to align'}. "
            f"FinBERT: {score:.1f}/10 ({sent_label}, {n_headlines} headlines). "
            f"RSI: {rsi:.1f}. Price vs 50MA: {price_vs_ma:+.1f}%."
        )

    if signal in ("BUY", "SELL"):
        save_trade({
            "ticker":      ticker,
            "signal":      signal,
            "price":       round(price, 2),
            "timestamp":   datetime.now().isoformat(),
            "conviction":  round(score, 2),
            "stop_loss":   sl_price,
            "take_profit": tp_price,
            "rsi":         round(rsi, 1),
            "atr":         round(atr, 2),
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
        "rsi":              round(rsi, 1),
        "rsi_ok":           rsi_ok,
        "atr":              round(atr, 2),
        "stop_loss":        sl_price,
        "take_profit":      tp_price,
        "volume_ratio":     round(vol_ratio, 2),
        "volume_ok":        volume_ok,
        "day_high":         round(float(df["High"].iloc[-1]), 2),
        "day_low":          round(float(df["Low"].iloc[-1]), 2),
        "open":             round(open_, 2),
        "volume":           format_volume(int(vol_now)),
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
        "reason":           "Insufficient data to compute signal.",
        "sentiment_label":  "NEUTRAL",
        "conviction_score": 5.0,
        "trend_ok":         False,
        "ma50":             0.0,
        "rsi":              50.0,
        "rsi_ok":           True,
        "atr":              0.0,
        "stop_loss":        0.0,
        "take_profit":      0.0,
        "volume_ratio":     1.0,
        "volume_ok":        False,
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
