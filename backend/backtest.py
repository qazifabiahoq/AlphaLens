"""
AlphaLens - backtest.py
Backtesting engine: AlphaLens strategy vs S&P 500 Buy & Hold

Uses vectorbt for portfolio simulation on 12 months of real OHLCV data.

Strategy (historical simulation):
    Entry : price crosses above 50-day MA  (technical timing, no look-ahead bias)
    Exit  : price crosses below 50-day MA
    Risk  : 2% stop-loss, 5% take-profit attached to every entry

Note on sentiment:
    The live bot (bot.py) adds a FinBERT conviction gate (score >= 7.0) on
    top of the MA50 signal.  We cannot replicate that gate here because
    historical news headlines are not stored — fetching today's headlines and
    applying them to 12-month-old trades would be look-ahead bias (we would
    be "knowing" today's news in the past).  The backtest therefore isolates
    and validates the technical component of the strategy.  The sentiment
    layer is demonstrated live during paper trading.

Outputs:
    equity_curve.png        - Matplotlib static chart
    backtest_results.html   - Plotly interactive chart

Run:
    cd backend
    python backtest.py
"""

import logging
import warnings
import sys
import os

warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import yfinance as yf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta

# Allow running from project root or backend/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# sentiment and NewsFetcher are used in bot.py (live trading only)

log = logging.getLogger("AlphaLens.Backtest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

# ── Config ────────────────────────────────────────────────────────────────────
TICKERS           = ["AAPL", "MSFT", "TSLA", "NVDA"]
BENCHMARK_TICKER  = "SPY"
INITIAL_CAPITAL   = 10_000.0
MA_WINDOW         = 50
CONVICTION_THRESH = 7.0   # live bot threshold (not applied in backtest — no historical news)
STOP_LOSS_PCT     = 0.02
TAKE_PROFIT_PCT   = 0.05
LOOKBACK_MONTHS   = 12


# ── Step 1: Load historical OHLCV data ───────────────────────────────────────
def load_price_data(tickers: list, months: int = 12) -> dict:
    end   = datetime.today()
    start = end - timedelta(days=months * 31)
    data  = {}

    log.info(f"\nDownloading {months}-month OHLCV data...")
    for t in tickers + [BENCHMARK_TICKER]:
        df = yf.download(t, start=start, end=end, progress=False, auto_adjust=True)
        if not df.empty:
            data[t] = df
            log.info(f"  {t}: {len(df)} rows")
        else:
            log.warning(f"  No data for {t}")

    return data


# ── Step 2: Build vectorbt signal DataFrames ─────────────────────────────────
def build_signals(data: dict):
    """
    Returns (price_df, entries, exits) as aligned DataFrames.

    Entry condition: price crosses above MA50 (pure technical, no look-ahead bias)
    Exit  condition: price crosses below MA50

    Sentiment is NOT applied here because historical news headlines are not
    available — using today's headlines for past dates would be look-ahead bias.
    The sentiment gate is active in the live bot (bot.py).
    """
    prices_dict = {}
    for t in TICKERS:
        if t not in data:
            continue
        close = data[t]["Close"]
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        prices_dict[t] = close

    price_df = pd.DataFrame(prices_dict)
    price_df.index = pd.to_datetime(price_df.index)

    ma50           = price_df.rolling(MA_WINDOW).mean()
    price_above_ma = price_df > ma50
    prev_above_ma  = price_above_ma.shift(1).fillna(False)

    entries = price_above_ma & ~prev_above_ma   # crosses ABOVE MA50 (crossover, not level)
    exits   = ~price_above_ma & prev_above_ma   # crosses BELOW MA50 (crossunder, not level)

    return price_df, entries, exits


# ── Step 3: vectorbt portfolio simulation ────────────────────────────────────
def run_vectorbt_backtest(price_df: pd.DataFrame, entries: pd.DataFrame, exits: pd.DataFrame):
    """
    Use vectorbt.Portfolio.from_signals() to simulate the strategy.
    Each ticker gets an equal share of INITIAL_CAPITAL.
    Stop-loss and take-profit orders are attached to every entry.
    """
    try:
        import vectorbt as vbt
    except ImportError:
        raise ImportError(
            "vectorbt is not installed.  Run:  pip install vectorbt"
        )

    per_ticker_cash = INITIAL_CAPITAL / len(price_df.columns)

    portfolio = vbt.Portfolio.from_signals(
        close=price_df,
        entries=entries,
        exits=exits,
        sl_stop=STOP_LOSS_PCT,
        tp_stop=TAKE_PROFIT_PCT,
        init_cash=per_ticker_cash,
        fees=0.001,
        freq="D",
    )

    return portfolio


# ── Step 4: Performance metrics ───────────────────────────────────────────────
def calc_portfolio_metrics(portfolio) -> dict:
    total_value = portfolio.value().sum(axis=1)
    returns     = total_value.pct_change().dropna()

    total_return = (total_value.iloc[-1] / total_value.iloc[0] - 1) * 100
    sharpe       = float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0.0
    rolling_max  = total_value.cummax()
    max_dd       = float(((total_value - rolling_max) / rolling_max).min() * 100)

    downside = returns[returns < 0]
    sortino  = (
        float(returns.mean() / downside.std() * np.sqrt(252))
        if len(downside) > 1 and downside.std() > 0
        else 0.0
    )

    annualized = ((total_value.iloc[-1] / total_value.iloc[0]) ** (252 / len(total_value)) - 1) * 100

    try:
        trades   = portfolio.trades.records_readable
        total_tr = len(trades)
        win_rate = round(float((trades["PnL"] > 0).mean() * 100), 1) if total_tr > 0 else 0.0
        dur = trades["Duration"]
        avg_hold = round(float(dur.dt.days.mean() if hasattr(dur, "dt") else dur.mean()), 1) if total_tr > 0 else 0.0
    except Exception:
        total_tr, win_rate, avg_hold = 0, 0.0, 0.0

    return {
        "total_return":      round(total_return, 2),
        "annualized_return": round(annualized, 2),
        "sharpe_ratio":      round(sharpe, 2),
        "sortino_ratio":     round(sortino, 2),
        "max_drawdown":      round(max_dd, 2),
        "total_trades":      total_tr,
        "win_rate":          win_rate,
        "avg_hold_days":     avg_hold,
    }


def calc_benchmark_metrics(spy_series: pd.Series) -> dict:
    spy_eq  = INITIAL_CAPITAL * spy_series / spy_series.iloc[0]
    returns = spy_eq.pct_change().dropna()
    total_r = (spy_eq.iloc[-1] / spy_eq.iloc[0] - 1) * 100
    sharpe  = float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0.0
    max_dd  = float(((spy_eq - spy_eq.cummax()) / spy_eq.cummax()).min() * 100)
    return {
        "total_return": round(total_r, 2),
        "sharpe_ratio": round(sharpe, 2),
        "max_drawdown": round(max_dd, 2),
    }


# ── Step 5: Plot equity curve ─────────────────────────────────────────────────
def plot_equity_curve(portfolio, spy_series: pd.Series, metrics: dict, bench_metrics: dict):
    total_value = portfolio.value().sum(axis=1)
    strat_eq    = total_value / total_value.iloc[0] * INITIAL_CAPITAL
    spy_eq      = INITIAL_CAPITAL * spy_series / spy_series.iloc[0]

    common   = strat_eq.index.intersection(spy_eq.index)
    strat_eq = strat_eq.loc[common]
    spy_eq   = spy_eq.loc[common]

    fig, ax = plt.subplots(figsize=(14, 6))
    fig.patch.set_facecolor("#0F172A")
    ax.set_facecolor("#0F172A")

    ax.plot(strat_eq.index, strat_eq, color="#F59E0B", linewidth=2.5,
            label="AlphaLens (MA50 + ATR stops)")
    ax.plot(spy_eq.index,   spy_eq,   color="#64748B", linewidth=1.8,
            linestyle="--", label="SPY Buy & Hold")
    ax.fill_between(strat_eq.index, strat_eq, spy_eq,
                    where=(strat_eq > spy_eq), alpha=0.15, color="#F59E0B")

    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=30, color="#94A3B8", fontsize=9)
    plt.yticks(color="#94A3B8", fontsize=9)
    for spine in ax.spines.values():
        spine.set_edgecolor("#334155")

    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"${x:,.0f}"))
    ax.set_xlabel("Date", color="#94A3B8", fontsize=10)
    ax.set_ylabel("Portfolio Value", color="#94A3B8", fontsize=10)
    ax.set_title(
        "AlphaLens: Equity Curve vs S&P 500  (12-Month Backtest | MA50 Crossover + ATR Stops)",
        color="white", fontsize=13, fontweight="bold", pad=15,
    )

    stats_text = (
        f"AlphaLens   Return: {metrics['total_return']:+.1f}%   "
        f"Sharpe: {metrics['sharpe_ratio']:.2f}   "
        f"Sortino: {metrics['sortino_ratio']:.2f}   "
        f"Max DD: {metrics['max_drawdown']:.1f}%   "
        f"Trades: {metrics['total_trades']}   Win: {metrics['win_rate']:.1f}%\n"
        f"SPY B&H     Return: {bench_metrics['total_return']:+.1f}%   "
        f"Sharpe: {bench_metrics['sharpe_ratio']:.2f}   "
        f"Max DD: {bench_metrics['max_drawdown']:.1f}%"
    )
    ax.text(0.01, 0.04, stats_text, transform=ax.transAxes,
            fontsize=8.5, color="#CBD5E1",
            bbox=dict(facecolor="#1E293B", edgecolor="#334155", boxstyle="round,pad=0.5"))

    ax.legend(loc="upper left", facecolor="#1E293B", edgecolor="#334155",
              labelcolor="white", fontsize=10)
    ax.grid(True, color="#1E293B", linewidth=0.8)
    plt.tight_layout()
    plt.savefig("equity_curve.png", dpi=150, bbox_inches="tight", facecolor="#0F172A")
    log.info("✓ Saved: equity_curve.png")

    # Plotly interactive HTML
    try:
        import plotly.graph_objects as go
        fig2 = go.Figure()
        fig2.add_trace(go.Scatter(
            x=list(strat_eq.index), y=list(strat_eq),
            name="AlphaLens (MA50 + ATR stops)",
            line=dict(color="#F59E0B", width=3),
        ))
        fig2.add_trace(go.Scatter(
            x=list(spy_eq.index), y=list(spy_eq),
            name="SPY Buy & Hold",
            line=dict(color="#64748B", width=2, dash="dash"),
        ))
        fig2.update_layout(
            title="AlphaLens: Equity Curve vs S&P 500",
            paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
            font=dict(color="white"), hovermode="x unified",
            legend=dict(bgcolor="#1E293B"),
        )
        fig2.write_html("backtest_results.html")
        log.info("✓ Saved: backtest_results.html")
    except ImportError:
        log.info("plotly not installed — skipping HTML chart")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info("=" * 60)
    log.info("  AlphaLens Backtest — MA50 Crossover + ATR Stop/Target")
    log.info("  (Technical component only — sentiment runs live in bot.py)")
    log.info("=" * 60)

    # 1. Historical price data
    data = load_price_data(TICKERS, months=LOOKBACK_MONTHS)

    # 2. Build entry/exit signal arrays (MA50 crossover, no look-ahead bias)
    price_df, entries, exits = build_signals(data)

    # 3. vectorbt portfolio simulation
    log.info("\nRunning vectorbt portfolio simulation...")
    portfolio = run_vectorbt_backtest(price_df, entries, exits)

    # 4. SPY benchmark series
    spy_close = data[BENCHMARK_TICKER]["Close"]
    if isinstance(spy_close, pd.DataFrame):
        spy_close = spy_close.iloc[:, 0]
    spy_close.index = pd.to_datetime(spy_close.index)

    # 5. Metrics
    metrics       = calc_portfolio_metrics(portfolio)
    bench_metrics = calc_benchmark_metrics(spy_close)

    log.info("\n── Results ─────────────────────────────────────────────────")
    log.info(f"  AlphaLens  Total Return    : {metrics['total_return']:+.2f}%")
    log.info(f"  AlphaLens  Annualized      : {metrics['annualized_return']:+.2f}%")
    log.info(f"  AlphaLens  Sharpe Ratio    : {metrics['sharpe_ratio']}")
    log.info(f"  AlphaLens  Sortino Ratio   : {metrics['sortino_ratio']}")
    log.info(f"  AlphaLens  Max Drawdown    : {metrics['max_drawdown']}%")
    log.info(f"  AlphaLens  Total Trades    : {metrics['total_trades']}")
    log.info(f"  AlphaLens  Win Rate        : {metrics['win_rate']}%")
    log.info(f"  AlphaLens  Avg Hold (days) : {metrics['avg_hold_days']}")
    log.info(f"  SPY B&H    Total Return    : {bench_metrics['total_return']:+.2f}%")
    log.info(f"  SPY B&H    Sharpe Ratio    : {bench_metrics['sharpe_ratio']}")
    log.info(f"  SPY B&H    Max Drawdown    : {bench_metrics['max_drawdown']}%")
    log.info("─" * 60)

    # 6. Charts
    plot_equity_curve(portfolio, spy_close, metrics, bench_metrics)
    log.info("\nBacktest complete ✓")

    return portfolio, metrics, bench_metrics


if __name__ == "__main__":
    main()
