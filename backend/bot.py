"""
AlphaLens - bot.py
Rule-Based + Sentiment Trading Bot (yfinance + Paper Simulation)

Entry requires ALL 4 conditions:
    1. Price > 50-day MA         — stock must be in an uptrend
    2. RSI(14) between 30–70     — not overbought, not a falling knife
    3. Volume ≥ 1.1× 20-day avg  — real buying pressure behind the move
    4. FinBERT conviction ≥ 7.0  — AI confirms strongly positive news

Exit on ANY condition:
    1. Price drops below 50-day MA    — trend broken
    2. RSI(14) rises above 75         — overbought, take profit
    3. FinBERT conviction < 3.0       — sentiment turned negative
    4. Stop-loss: entry − 1.5×ATR(14) — volatility-adjusted floor
    5. Take-profit: entry + 3×ATR(14) — 2:1 reward-to-risk target

Position sizing:
    Risk 1% of portfolio per trade.
    Qty = floor((portfolio × 1%) / (1.5 × ATR))  — bet less on volatile stocks.

Setup:
    pip install -r requirements.txt
    python bot.py
"""

import json
import time
import logging
from datetime import datetime
from pathlib import Path
from math import floor

import numpy as np
import pandas as pd

from sentiment import SentimentAgent
from market_data import MarketDataHandler

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("alphalens.log"),
    ],
)
log = logging.getLogger("AlphaLens")

# ── Strategy config ───────────────────────────────────────────────────────────
TICKERS           = ["AAPL", "MSFT", "TSLA", "NVDA"]

MA_WINDOW         = 50      # 50-day simple moving average (trend filter)
RSI_PERIOD        = 14      # Standard RSI lookback
RSI_BUY_MIN       = 30      # Below 30 = falling knife
RSI_BUY_MAX       = 70      # Above 70 = overbought / don't chase
RSI_EXIT          = 75      # Exit existing position when overbought

ATR_PERIOD        = 14      # ATR lookback for volatility-adjusted levels
ATR_SL_MULT       = 1.5     # Stop-loss = entry − 1.5 × ATR
ATR_TP_MULT       = 3.0     # Take-profit = entry + 3 × ATR (2:1 R/R)

VOLUME_MA         = 20      # Rolling window for average volume
VOLUME_MIN        = 1.1     # Volume must be ≥ 1.1× the 20-day average

SENTIMENT_THRESH  = 7.0     # Min FinBERT conviction to enter (0–10 scale)
SENTIMENT_EXIT    = 3.0     # Exit when conviction drops below this

PORTFOLIO_VALUE   = 10_000  # Paper portfolio size ($)
RISK_PER_TRADE    = 0.01    # Risk 1% of portfolio per trade

POLL_INTERVAL_SEC = 300     # Seconds between full scans (5 min)
TRADES_FILE       = Path("trades.json")


# ── Indicator helpers ─────────────────────────────────────────────────────────
def _calc_rsi(close: pd.Series, period: int = RSI_PERIOD) -> float:
    """Wilder's RSI. Returns 50 if not enough data."""
    delta    = close.diff()
    gain     = delta.clip(lower=0)
    loss     = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    rsi      = 100 - (100 / (1 + rs))
    val      = float(rsi.iloc[-1])
    return val if val == val else 50.0


def _calc_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> float:
    """Average True Range — measures how much a stock moves day-to-day."""
    high, low, close = df["High"], df["Low"], df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    val = float(tr.rolling(period).mean().iloc[-1])
    return val if val == val else 1.0


def _load_trades() -> list:
    if TRADES_FILE.exists():
        return json.loads(TRADES_FILE.read_text())
    return []


def _save_trade(record: dict):
    trades = _load_trades()
    trades.append(record)
    TRADES_FILE.write_text(json.dumps(trades, indent=2))


# ── Bot ───────────────────────────────────────────────────────────────────────
class AlphaLensBot:
    """
    4-condition entry / 5-condition exit paper trading bot.
    Positions: {ticker: {qty, entry_price, stop_loss, take_profit}}
    """

    def __init__(self):
        self.agent     = SentimentAgent()
        self.market    = MarketDataHandler()
        self.positions: dict = {}
        log.info("AlphaLens Bot initialized — 4-condition rule engine")

    # ── Compute indicators ────────────────────────────────────────────────────
    def _compute_indicators(self, ticker: str) -> dict | None:
        df = self.market.get_historical(ticker, period="1y")
        if df is None or len(df) < MA_WINDOW + 5:
            return None

        close   = df["Close"]
        price   = float(close.iloc[-1])
        ma50    = float(close.rolling(MA_WINDOW).mean().iloc[-1])
        rsi     = _calc_rsi(close)
        atr     = _calc_atr(df)
        vol_avg = float(df["Volume"].rolling(VOLUME_MA).mean().iloc[-1])
        vol_now = float(df["Volume"].iloc[-1])
        vol_ratio = vol_now / vol_avg if vol_avg else 1.0

        return {
            "price":     price,
            "ma50":      ma50,
            "rsi":       rsi,
            "atr":       atr,
            "vol_ratio": vol_ratio,
        }

    # ── Signal generation ─────────────────────────────────────────────────────
    def generate_signal(self, ticker: str) -> dict:
        headlines = self.market.get_news(ticker)
        sentiment = self.agent.analyze(ticker, headlines)
        ind       = self._compute_indicators(ticker)

        if ind is None:
            return {"ticker": ticker, "signal": "HOLD", "price": 0.0,
                    "atr": 1.0, "stop_loss": 0.0, "take_profit": 0.0,
                    "sentiment": sentiment}

        price    = ind["price"]
        atr      = ind["atr"]
        sl_price = round(price - ATR_SL_MULT * atr, 2)
        tp_price = round(price + ATR_TP_MULT * atr, 2)

        # Entry: all 4 must pass
        trend_ok  = price > ind["ma50"]
        rsi_ok    = RSI_BUY_MIN <= ind["rsi"] <= RSI_BUY_MAX
        volume_ok = ind["vol_ratio"] >= VOLUME_MIN
        sent_ok   = sentiment["score"] >= SENTIMENT_THRESH
        entry_ok  = trend_ok and rsi_ok and volume_ok and sent_ok

        # Exit: any one triggers sell
        any_exit = (
            not trend_ok
            or ind["rsi"] > RSI_EXIT
            or sentiment["score"] < SENTIMENT_EXIT
        )

        if entry_ok and ticker not in self.positions:
            signal = "BUY"
        elif any_exit and ticker in self.positions:
            signal = "SELL"
        else:
            signal = "HOLD"

        log.info(
            f"  {ticker}  ${price:.2f}  MA50=${ind['ma50']:.2f}  "
            f"RSI={ind['rsi']:.1f}  vol={ind['vol_ratio']:.2f}x  "
            f"sent={sentiment['score']:.1f}/10  → {signal}"
        )

        return {
            "ticker":      ticker,
            "price":       price,
            "signal":      signal,
            "sentiment":   sentiment,
            "indicators":  ind,
            "trend_ok":    trend_ok,
            "rsi_ok":      rsi_ok,
            "volume_ok":   volume_ok,
            "sent_ok":     sent_ok,
            "stop_loss":   sl_price,
            "take_profit": tp_price,
            "atr":         atr,
            "timestamp":   datetime.now().isoformat(),
        }

    # ── Position sizing (ATR-based) ───────────────────────────────────────────
    def _calc_qty(self, atr: float) -> int:
        dollar_risk   = PORTFOLIO_VALUE * RISK_PER_TRADE   # e.g. $100
        stop_distance = ATR_SL_MULT * atr
        qty           = floor(dollar_risk / stop_distance) if stop_distance > 0 else 1
        return max(1, qty)

    # ── Paper execution ───────────────────────────────────────────────────────
    def _execute_paper_order(self, ticker: str, side: str, qty: int, price: float,
                              sl: float | None = None, tp: float | None = None):
        _save_trade({
            "ticker":      ticker,
            "side":        side,
            "qty":         qty,
            "price":       round(price, 2),
            "stop_loss":   sl,
            "take_profit": tp,
            "timestamp":   datetime.now().isoformat(),
            "signal":      side.upper(),
        })
        if side == "buy":
            log.info(
                f"  [PAPER] BUY {qty} {ticker} @ ${price:.2f} | "
                f"SL=${sl}  TP=${tp}  (ATR-based, 2:1 R/R)"
            )
        else:
            log.info(f"  [PAPER] SELL {qty} {ticker} @ ${price:.2f}")

    def execute(self, sig: dict):
        ticker, signal, price = sig["ticker"], sig["signal"], sig["price"]

        if signal == "BUY" and ticker not in self.positions:
            qty = self._calc_qty(sig["atr"])
            self._execute_paper_order(ticker, "buy", qty, price,
                                       sl=sig["stop_loss"], tp=sig["take_profit"])
            self.positions[ticker] = {
                "qty":         qty,
                "entry_price": price,
                "stop_loss":   sig["stop_loss"],
                "take_profit": sig["take_profit"],
            }

        elif signal == "SELL" and ticker in self.positions:
            pos = self.positions.pop(ticker)
            pnl = (price - pos["entry_price"]) / pos["entry_price"] * 100
            self._execute_paper_order(ticker, "sell", pos["qty"], price)
            log.info(f"  Closed {ticker} | PnL: {pnl:+.2f}%")

        else:
            log.info(f"  {ticker} → HOLD")

    # ── ATR-based SL/TP monitoring ────────────────────────────────────────────
    def check_risk_exits(self):
        for ticker, pos in list(self.positions.items()):
            df = self.market.get_historical(ticker, period="5d")
            if df is None:
                continue
            price = float(df["Close"].iloc[-1])

            if price <= pos["stop_loss"]:
                pct = (price - pos["entry_price"]) / pos["entry_price"] * 100
                log.warning(f"  STOP-LOSS {ticker} @ ${price:.2f} ({pct:+.2f}%)")
                self._execute_paper_order(ticker, "sell", pos["qty"], price)
                del self.positions[ticker]

            elif price >= pos["take_profit"]:
                pct = (price - pos["entry_price"]) / pos["entry_price"] * 100
                log.info(f"  TAKE-PROFIT {ticker} @ ${price:.2f} ({pct:+.2f}%)")
                self._execute_paper_order(ticker, "sell", pos["qty"], price)
                del self.positions[ticker]

    # ── Main loop ─────────────────────────────────────────────────────────────
    def run(self):
        log.info("=" * 60)
        log.info("  AlphaLens — 4-Condition Rule-Based + AI Sentiment Bot")
        log.info(f"  Entry (ALL 4): trend | RSI 30-70 | volume≥1.1x | conviction≥7.0")
        log.info(f"  Exit (ANY):    trend break | RSI>75 | conviction<3.0 | SL/TP")
        log.info(f"  Sizing: 1% portfolio risk / trade, ATR-adjusted stop distance")
        log.info("=" * 60)

        while True:
            log.info(f"\n── Scan @ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ──")
            self.check_risk_exits()

            for ticker in TICKERS:
                log.info(f"\n[{ticker}]")
                result = self.generate_signal(ticker)
                self.execute(result)

            log.info(f"\nOpen positions: {list(self.positions.keys()) or 'None'}")
            log.info(f"Sleeping {POLL_INTERVAL_SEC}s...\n")
            time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    bot = AlphaLensBot()
    bot.run()
