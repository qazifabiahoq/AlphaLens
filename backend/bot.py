"""
AlphaLens - bot.py
LLM-Driven Automated Trading Agent (yfinance + Paper Simulation)

Runs a continuous loop every 5 minutes:
    1. Fetch live price data via yfinance
    2. Compute 50-day moving average trend
    3. Fetch news headlines via NewsFetcher (Yahoo Finance RSS)
    4. Score sentiment with FinBERT via SentimentAgent
    5. Generate BUY / SELL / HOLD signal
    6. Execute paper trade (logged to alphalens.log + trades.json)
    7. Monitor open positions for stop-loss / take-profit exits

Setup:
    pip install -r requirements.txt
    python bot.py
"""

import json
import time
import logging
from datetime import datetime
from pathlib import Path

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

# ── Config ────────────────────────────────────────────────────────────────────
TICKERS           = ["AAPL", "MSFT", "TSLA", "NVDA"]
MA_WINDOW         = 50      # 50-day moving average
SENTIMENT_THRESH  = 7.0     # Min FinBERT conviction (0-10) to enter
STOP_LOSS_PCT     = 0.02    # 2% stop-loss
TAKE_PROFIT_PCT   = 0.05    # 5% take-profit
TRADE_QTY         = 1       # Shares per order
POLL_INTERVAL_SEC = 300     # Seconds between scans (5 min)
TRADES_FILE       = Path("trades.json")


def _load_trades() -> list:
    if TRADES_FILE.exists():
        return json.loads(TRADES_FILE.read_text())
    return []


def _save_trade(record: dict):
    trades = _load_trades()
    trades.append(record)
    TRADES_FILE.write_text(json.dumps(trades, indent=2))


class AlphaLensBot:
    """
    Core trading bot.

    Signal logic:
        BUY  — price > 50-day MA  AND  FinBERT conviction >= SENTIMENT_THRESH
        SELL — in position AND (stop-loss hit | take-profit hit | conviction < 3)
        HOLD — all other cases

    Execution: paper simulation logged to alphalens.log and trades.json.
    """

    def __init__(self):
        self.agent     = SentimentAgent()
        self.market    = MarketDataHandler()
        self.positions: dict = {}   # { ticker: { qty, entry_price } }
        log.info("AlphaLens Bot initialized — yfinance data source")

    # ── Market indicators ─────────────────────────────────────────────────────
    def _current_price(self, ticker: str) -> float:
        df = self.market.get_historical(ticker, period="5d")
        return float(df["Close"].iloc[-1]) if df is not None else 0.0

    def _above_50ma(self, ticker: str) -> tuple[bool, float, float]:
        """Returns (above_ma, price, ma50_value)."""
        df = self.market.get_historical(ticker, period="1y")
        if df is None or len(df) < MA_WINDOW:
            return False, 0.0, 0.0
        price = float(df["Close"].iloc[-1])
        ma    = float(df["Close"].rolling(MA_WINDOW).mean().iloc[-1])
        log.info(f"  {ticker}  price={price:.2f}  50MA={ma:.2f}  above={price > ma}")
        return price > ma, price, ma

    # ── Signal generation ─────────────────────────────────────────────────────
    def generate_signal(self, ticker: str) -> dict:
        headlines            = self.market.get_news(ticker)
        sentiment            = self.agent.analyze(ticker, headlines)
        trend_ok, price, ma  = self._above_50ma(ticker)

        if trend_ok and sentiment["score"] >= SENTIMENT_THRESH:
            signal = "BUY"
        elif not trend_ok or sentiment["score"] < 3.0:
            signal = "SELL"
        else:
            signal = "HOLD"

        return {
            "ticker":    ticker,
            "price":     price,
            "ma50":      ma,
            "signal":    signal,
            "sentiment": sentiment,
            "trend_ok":  trend_ok,
            "timestamp": datetime.now().isoformat(),
        }

    # ── Paper trade execution ─────────────────────────────────────────────────
    def _execute_paper_order(self, ticker: str, side: str, qty: int, price: float):
        sl_price = round(price * (1 - STOP_LOSS_PCT), 2)
        tp_price = round(price * (1 + TAKE_PROFIT_PCT), 2)
        record = {
            "ticker":      ticker,
            "side":        side,
            "qty":         qty,
            "price":       round(price, 2),
            "stop_loss":   sl_price if side == "buy" else None,
            "take_profit": tp_price if side == "buy" else None,
            "timestamp":   datetime.now().isoformat(),
            "signal":      side.upper(),
        }
        _save_trade(record)
        log.info(
            f"  [PAPER] {side.upper()} {qty} {ticker} @ ${price:.2f} | "
            f"SL=${sl_price}  TP=${tp_price}"
        )

    def execute(self, sig: dict):
        ticker = sig["ticker"]
        signal = sig["signal"]
        price  = sig["price"]

        if signal == "BUY" and ticker not in self.positions:
            self._execute_paper_order(ticker, "buy", TRADE_QTY, price)
            self.positions[ticker] = {"qty": TRADE_QTY, "entry_price": price}

        elif signal == "SELL" and ticker in self.positions:
            entry = self.positions.pop(ticker)["entry_price"]
            pnl   = (price - entry) / entry * 100
            self._execute_paper_order(ticker, "sell", TRADE_QTY, price)
            log.info(f"  Closed {ticker} | PnL: {pnl:+.2f}%")

        else:
            log.info(f"  {ticker} → HOLD")

    # ── Intra-position risk management ────────────────────────────────────────
    def check_risk_exits(self):
        for ticker, pos in list(self.positions.items()):
            price = self._current_price(ticker)
            entry = pos["entry_price"]
            pct   = (price - entry) / entry

            if pct <= -STOP_LOSS_PCT:
                log.warning(f"  STOP-LOSS triggered {ticker} ({pct:.2%})")
                self._execute_paper_order(ticker, "sell", pos["qty"], price)
                del self.positions[ticker]

            elif pct >= TAKE_PROFIT_PCT:
                log.info(f"  TAKE-PROFIT triggered {ticker} ({pct:.2%})")
                self._execute_paper_order(ticker, "sell", pos["qty"], price)
                del self.positions[ticker]

    # ── Main loop ─────────────────────────────────────────────────────────────
    def run(self):
        log.info("=" * 60)
        log.info("  AlphaLens Bot — STARTING (Paper Trading Simulation)")
        log.info(f"  Tickers       : {TICKERS}")
        log.info(f"  Data source   : yfinance + Yahoo Finance RSS")
        log.info(f"  Sentiment     : FinBERT (ProsusAI/finbert)")
        log.info(f"  Strategy      : price > MA{MA_WINDOW} AND conviction >= {SENTIMENT_THRESH}")
        log.info(f"  Risk          : SL={STOP_LOSS_PCT*100:.0f}%  TP={TAKE_PROFIT_PCT*100:.0f}%")
        log.info(f"  Poll interval : {POLL_INTERVAL_SEC}s")
        log.info("=" * 60)

        while True:
            log.info(f"\n── Scan @ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ──")
            self.check_risk_exits()

            for ticker in TICKERS:
                log.info(f"\n[{ticker}]")
                result = self.generate_signal(ticker)
                log.info(
                    f"  Signal={result['signal']}  "
                    f"Sentiment={result['sentiment']['label'].upper()} "
                    f"({result['sentiment']['score']:.1f}/10)  "
                    f"Trend={'↑ above MA50' if result['trend_ok'] else '↓ below MA50'}"
                )
                self.execute(result)

            log.info(f"\nOpen positions: {self.positions or 'None'}")
            log.info(f"Sleeping {POLL_INTERVAL_SEC}s...\n")
            time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    bot = AlphaLensBot()
    bot.run()
