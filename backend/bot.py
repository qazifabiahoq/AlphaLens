"""
AlphaLens - LLM-Driven Automated Trading Agent
bot.py: Main executable - run this to start the bot

Install dependencies:
    pip install alpaca-trade-api yfinance pandas transformers torch python-dotenv

Create a .env file with:
    ALPACA_API_KEY=your_key_here
    ALPACA_SECRET_KEY=your_secret_here
    ALPACA_BASE_URL=https://paper-api.alpaca.markets
"""

import os
import time
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

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
MA_WINDOW         = 50       # 50-day moving average
SENTIMENT_THRESH  = 7.0      # Min conviction score (0–10) to trigger BUY
STOP_LOSS_PCT     = 0.02     # 2% stop-loss
TAKE_PROFIT_PCT   = 0.05     # 5% take-profit
TRADE_QTY         = 1        # Shares per order (keep low for paper trading)
POLL_INTERVAL_SEC = 300      # Seconds between main loop runs (5 min)

# ── Alpaca client (graceful fallback to simulation mode) ──────────────────────
try:
    import alpaca_trade_api as tradeapi
    _api = tradeapi.REST(
        os.getenv("ALPACA_API_KEY", ""),
        os.getenv("ALPACA_SECRET_KEY", ""),
        os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets"),
        api_version="v2",
    )
    _api.get_account()          # Validate credentials
    ALPACA_LIVE = True
    log.info("✓ Alpaca Paper Trading API connected")
except Exception as e:
    ALPACA_LIVE = False
    log.warning(f"Alpaca unavailable ({e}). Running in SIMULATION mode.")

from sentiment import SentimentAgent
from market_data import MarketDataHandler


class AlphaLensBot:
    """
    Core trading bot.

    Decision Logic:
        BUY  → price > 50-day MA  AND  sentiment conviction >= SENTIMENT_THRESH
        SELL → in position AND (stop-loss hit | take-profit hit | conviction < 3)
        HOLD → all other cases
    """

    def __init__(self):
        self.agent    = SentimentAgent()
        self.market   = MarketDataHandler()
        self.positions = {}   # { ticker: { qty, entry_price } }
        log.info("AlphaLens Bot initialized")

    # ── Indicators ───────────────────────────────────────────────────────────
    def _current_price(self, ticker: str) -> float:
        df = self.market.get_historical(ticker, period="5d")
        return float(df["Close"].iloc[-1]) if df is not None else 0.0

    def _above_50ma(self, ticker: str) -> bool:
        df = self.market.get_historical(ticker, period="1y")
        if df is None or len(df) < MA_WINDOW:
            return False
        ma    = df["Close"].rolling(MA_WINDOW).mean().iloc[-1]
        price = df["Close"].iloc[-1]
        log.info(f"  {ticker} price={price:.2f}  50MA={ma:.2f}  above={price > ma}")
        return float(price) > float(ma)

    # ── Signal ───────────────────────────────────────────────────────────────
    def generate_signal(self, ticker: str) -> dict:
        headlines = self.market.get_news(ticker)
        sentiment = self.agent.analyze(ticker, headlines)
        trend_ok  = self._above_50ma(ticker)
        price     = self._current_price(ticker)

        if trend_ok and sentiment["score"] >= SENTIMENT_THRESH:
            signal = "BUY"
        elif not trend_ok or sentiment["score"] < 3.0:
            signal = "SELL"
        else:
            signal = "HOLD"

        return {
            "ticker":    ticker,
            "price":     price,
            "signal":    signal,
            "sentiment": sentiment,
            "trend_ok":  trend_ok,
            "timestamp": datetime.now().isoformat(),
        }

    # ── Execution ─────────────────────────────────────────────────────────────
    def _place_order(self, ticker: str, side: str, qty: int):
        if ALPACA_LIVE:
            try:
                order = _api.submit_order(
                    symbol     = ticker,
                    qty        = qty,
                    side       = side,
                    type       = "market",
                    time_in_force = "gtc",
                )
                log.info(f"  ✓ Order submitted: {side.upper()} {qty} {ticker} | id={order.id}")
                return order
            except Exception as e:
                log.error(f"  ✗ Order failed: {e}")
                return None
        else:
            log.info(f"  [SIM] {side.upper()} {qty} {ticker} @ ${self._current_price(ticker):.2f}")
            return {"id": "SIM", "side": side, "qty": qty, "symbol": ticker}

    def _attach_stop_loss(self, ticker: str, entry_price: float):
        """Bracket order: stop-loss + take-profit legs."""
        sl_price = round(entry_price * (1 - STOP_LOSS_PCT), 2)
        tp_price = round(entry_price * (1 + TAKE_PROFIT_PCT), 2)
        log.info(f"  Risk controls: SL=${sl_price}  TP=${tp_price}")
        if ALPACA_LIVE:
            try:
                _api.submit_order(
                    symbol        = ticker,
                    qty           = TRADE_QTY,
                    side          = "sell",
                    type          = "stop",
                    stop_price    = str(sl_price),
                    time_in_force = "gtc",
                )
            except Exception as e:
                log.error(f"  Stop-loss order failed: {e}")

    def execute(self, signal_result: dict):
        ticker = signal_result["ticker"]
        signal = signal_result["signal"]
        price  = signal_result["price"]

        if signal == "BUY" and ticker not in self.positions:
            order = self._place_order(ticker, "buy", TRADE_QTY)
            if order:
                self.positions[ticker] = {"qty": TRADE_QTY, "entry_price": price}
                self._attach_stop_loss(ticker, price)

        elif signal == "SELL" and ticker in self.positions:
            order = self._place_order(ticker, "sell", TRADE_QTY)
            if order:
                entry = self.positions.pop(ticker)["entry_price"]
                pnl   = (price - entry) / entry * 100
                log.info(f"  Closed {ticker} | PnL: {pnl:+.2f}%")

        else:
            log.info(f"  {ticker} → HOLD (no action)")

    # ── Risk check: intra-position stop/take-profit ────────────────────────
    def check_risk_exits(self):
        for ticker, pos in list(self.positions.items()):
            price = self._current_price(ticker)
            entry = pos["entry_price"]
            pct   = (price - entry) / entry

            if pct <= -STOP_LOSS_PCT:
                log.warning(f"  STOP-LOSS triggered for {ticker} ({pct:.2%})")
                self._place_order(ticker, "sell", pos["qty"])
                del self.positions[ticker]

            elif pct >= TAKE_PROFIT_PCT:
                log.info(f"  TAKE-PROFIT triggered for {ticker} ({pct:.2%})")
                self._place_order(ticker, "sell", pos["qty"])
                del self.positions[ticker]

    # ── Main loop ─────────────────────────────────────────────────────────────
    def run(self):
        log.info("=" * 60)
        log.info("  AlphaLens Bot — STARTING")
        log.info(f"  Tickers : {TICKERS}")
        log.info(f"  Mode    : {'LIVE PAPER' if ALPACA_LIVE else 'SIMULATION'}")
        log.info("=" * 60)

        while True:
            log.info(f"\n── Scan @ {datetime.now().strftime('%H:%M:%S')} ──")
            self.check_risk_exits()

            for ticker in TICKERS:
                log.info(f"\n[{ticker}]")
                result = self.generate_signal(ticker)
                log.info(
                    f"  Signal={result['signal']}  "
                    f"Sentiment={result['sentiment']['label']} "
                    f"({result['sentiment']['score']:.1f}/10)  "
                    f"Trend={'↑' if result['trend_ok'] else '↓'}"
                )
                self.execute(result)

            log.info(f"\nPositions: {self.positions or 'None'}")
            log.info(f"Sleeping {POLL_INTERVAL_SEC}s...\n")
            time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    bot = AlphaLensBot()
    bot.run()
