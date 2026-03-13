"""
AlphaLens - backtest.py
Backtesting engine: AlphaLens strategy vs S&P 500 Buy & Hold

Outputs:
    - equity_curve.png  → chart of strategy vs benchmark
    - backtest_results.html → interactive Plotly version

Run:
    python backtest.py
"""

import logging
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import yfinance as yf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta

log = logging.getLogger("AlphaLens.Backtest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

# ── Config ────────────────────────────────────────────────────────────────────
TICKERS          = ["AAPL", "MSFT", "TSLA", "NVDA"]
BENCHMARK_TICKER = "SPY"
INITIAL_CAPITAL  = 10_000.0
MA_WINDOW        = 50
SENTIMENT_THRESH = 0.6    # Simulated FinBERT score threshold (0–1 scale in backtest)
STOP_LOSS_PCT    = 0.02
TAKE_PROFIT_PCT  = 0.05
LOOKBACK_MONTHS  = 12


# ── Data loading ──────────────────────────────────────────────────────────────
def load_data(tickers: list, months: int = 12) -> dict:
    end   = datetime.today()
    start = end - timedelta(days=months * 31)
    data  = {}
    for t in tickers + [BENCHMARK_TICKER]:
        df = yf.download(t, start=start, end=end, progress=False, auto_adjust=True)
        if not df.empty:
            data[t] = df
            log.info(f"  Loaded {t}: {len(df)} rows")
        else:
            log.warning(f"  No data for {t}")
    return data


# ── Simulated sentiment signal ────────────────────────────────────────────────
def simulate_sentiment_signal(price_series: pd.Series) -> pd.Series:
    """
    Proxy for FinBERT sentiment: uses 5-day return momentum as a signal.
    In production this is replaced by real FinBERT scores from sentiment.py.
    Positive 5d momentum → bullish sentiment; negative → bearish.
    Normalized to 0–1 scale.
    """
    momentum   = price_series.pct_change(5).fillna(0)
    # Rolling z-score normalised to 0–1
    mu         = momentum.rolling(20).mean().fillna(0)
    sigma      = momentum.rolling(20).std().fillna(0.01)
    z          = (momentum - mu) / sigma
    signal     = 1 / (1 + np.exp(-z))   # sigmoid
    return signal


# ── Strategy backtest ─────────────────────────────────────────────────────────
def run_strategy(data: dict, ticker: str) -> pd.DataFrame:
    df     = data[ticker].copy()
    prices = df["Close"]

    ma50      = prices.rolling(MA_WINDOW).mean()
    sentiment = simulate_sentiment_signal(prices)

    position    = 0       # 0 = flat, 1 = long
    entry_price = 0.0
    capital     = INITIAL_CAPITAL
    equity      = []

    for i in range(len(prices)):
        price = float(prices.iloc[i])
        ma    = float(ma50.iloc[i]) if not pd.isna(ma50.iloc[i]) else 0.0
        sent  = float(sentiment.iloc[i])

        # Risk exits while in position
        if position == 1:
            pct = (price - entry_price) / entry_price
            if pct <= -STOP_LOSS_PCT or pct >= TAKE_PROFIT_PCT:
                capital     = capital / entry_price * price  # mark to market close
                position    = 0
                entry_price = 0.0

        # Entry signal
        if position == 0 and ma > 0:
            if price > ma and sent >= SENTIMENT_THRESH:
                position    = 1
                entry_price = price

        # Track equity
        if position == 1:
            equity.append(capital * (price / entry_price))
        else:
            equity.append(capital)

    result             = pd.DataFrame(index=df.index)
    result["equity"]   = equity
    result["price"]    = prices.values
    return result


# ── Benchmark: Buy & Hold SPY ─────────────────────────────────────────────────
def run_benchmark(data: dict) -> pd.DataFrame:
    spy    = data[BENCHMARK_TICKER]["Close"]
    equity = INITIAL_CAPITAL * spy / float(spy.iloc[0])
    result = pd.DataFrame({"equity": equity.values}, index=data[BENCHMARK_TICKER].index)
    return result


# ── Metrics ────────────────────────────────────────────────────────────────────
def calc_metrics(equity_series: pd.Series) -> dict:
    returns      = equity_series.pct_change().dropna()
    total_return = (equity_series.iloc[-1] / equity_series.iloc[0] - 1) * 100
    sharpe       = (returns.mean() / returns.std()) * np.sqrt(252) if returns.std() > 0 else 0
    rolling_max  = equity_series.cummax()
    drawdown     = (equity_series - rolling_max) / rolling_max
    max_dd       = drawdown.min() * 100
    return {
        "total_return": round(total_return, 2),
        "sharpe_ratio": round(sharpe, 2),
        "max_drawdown": round(max_dd, 2),
    }


# ── Plot ───────────────────────────────────────────────────────────────────────
def plot_equity_curve(strategy_eq: pd.Series, benchmark_eq: pd.Series, metrics: dict, bench_metrics: dict):
    fig, ax = plt.subplots(figsize=(14, 6))
    fig.patch.set_facecolor("#0F172A")
    ax.set_facecolor("#0F172A")

    # Normalise to $10k start
    s_norm = strategy_eq  / strategy_eq.iloc[0]  * INITIAL_CAPITAL
    b_norm = benchmark_eq / benchmark_eq.iloc[0] * INITIAL_CAPITAL

    ax.plot(strategy_eq.index, s_norm,  color="#F59E0B", linewidth=2.5, label="AlphaLens Strategy")
    ax.plot(benchmark_eq.index, b_norm, color="#64748B", linewidth=1.8, linestyle="--", label="SPY Buy & Hold")

    ax.fill_between(strategy_eq.index, s_norm, b_norm,
                    where=(s_norm > b_norm), alpha=0.15, color="#F59E0B")

    # Formatting
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=30, color="#94A3B8", fontsize=9)
    plt.yticks(color="#94A3B8", fontsize=9)
    for spine in ax.spines.values():
        spine.set_edgecolor("#334155")

    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"${x:,.0f}"))
    ax.set_xlabel("Date", color="#94A3B8", fontsize=10)
    ax.set_ylabel("Portfolio Value", color="#94A3B8", fontsize=10)
    ax.set_title("AlphaLens: Equity Curve vs S&P 500 (12-Month Backtest)",
                 color="white", fontsize=14, fontweight="bold", pad=15)

    # Stats box
    stats_text = (
        f"AlphaLens   Return: {metrics['total_return']:+.1f}%   "
        f"Sharpe: {metrics['sharpe_ratio']:.2f}   "
        f"Max DD: {metrics['max_drawdown']:.1f}%\n"
        f"SPY B&H       Return: {bench_metrics['total_return']:+.1f}%   "
        f"Sharpe: {bench_metrics['sharpe_ratio']:.2f}   "
        f"Max DD: {bench_metrics['max_drawdown']:.1f}%"
    )
    ax.text(0.01, 0.04, stats_text, transform=ax.transAxes,
            fontsize=9, color="#CBD5E1",
            bbox=dict(facecolor="#1E293B", edgecolor="#334155", boxstyle="round,pad=0.5"))

    ax.legend(loc="upper left", facecolor="#1E293B", edgecolor="#334155",
              labelcolor="white", fontsize=10)
    ax.grid(True, color="#1E293B", linewidth=0.8)

    plt.tight_layout()
    plt.savefig("equity_curve.png", dpi=150, bbox_inches="tight", facecolor="#0F172A")
    log.info("✓ Saved: equity_curve.png")

    # HTML version (Plotly)
    try:
        import plotly.graph_objects as go
        fig2 = go.Figure()
        fig2.add_trace(go.Scatter(x=list(strategy_eq.index), y=list(s_norm),
                                  name="AlphaLens", line=dict(color="#F59E0B", width=3)))
        fig2.add_trace(go.Scatter(x=list(benchmark_eq.index), y=list(b_norm),
                                  name="SPY Buy & Hold", line=dict(color="#64748B", width=2, dash="dash")))
        fig2.update_layout(
            title="AlphaLens: Equity Curve vs S&P 500",
            paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
            font=dict(color="white"), hovermode="x unified",
            legend=dict(bgcolor="#1E293B"),
        )
        fig2.write_html("backtest_results.html")
        log.info("✓ Saved: backtest_results.html")
    except ImportError:
        log.info("Plotly not installed — skipping HTML chart (pip install plotly)")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info("=" * 55)
    log.info("  AlphaLens Backtest — 12-Month Strategy Validation")
    log.info("=" * 55)

    log.info("\nLoading market data...")
    data = load_data(TICKERS, months=LOOKBACK_MONTHS)

    log.info("\nRunning strategy on each ticker...")
    strategy_equities = {}
    for t in TICKERS:
        if t in data:
            result              = run_strategy(data, t)
            strategy_equities[t] = result["equity"]
            m = calc_metrics(result["equity"])
            log.info(f"  {t}: Return={m['total_return']:+.1f}%  Sharpe={m['sharpe_ratio']}  MaxDD={m['max_drawdown']}%")

    # Combine tickers into equal-weight portfolio
    combined_df    = pd.DataFrame(strategy_equities)
    portfolio_eq   = combined_df.mean(axis=1)
    portfolio_eq   = portfolio_eq / portfolio_eq.iloc[0] * INITIAL_CAPITAL

    benchmark      = run_benchmark(data)
    benchmark_eq   = pd.Series(
        benchmark["equity"].values,
        index=data[BENCHMARK_TICKER].index
    )

    # Align dates
    common_idx   = portfolio_eq.index.intersection(benchmark_eq.index)
    portfolio_eq = portfolio_eq.loc[common_idx]
    benchmark_eq = benchmark_eq.loc[common_idx]

    metrics       = calc_metrics(portfolio_eq)
    bench_metrics = calc_metrics(benchmark_eq)

    log.info("\n── Results ──────────────────────────────────────")
    log.info(f"  AlphaLens  Total Return : {metrics['total_return']:+.2f}%")
    log.info(f"  AlphaLens  Sharpe Ratio : {metrics['sharpe_ratio']}")
    log.info(f"  AlphaLens  Max Drawdown : {metrics['max_drawdown']}%")
    log.info(f"  SPY B&H    Total Return : {bench_metrics['total_return']:+.2f}%")
    log.info(f"  SPY B&H    Sharpe Ratio : {bench_metrics['sharpe_ratio']}")
    log.info(f"  SPY B&H    Max Drawdown : {bench_metrics['max_drawdown']}%")
    log.info("─" * 50)

    plot_equity_curve(portfolio_eq, benchmark_eq, metrics, bench_metrics)
    log.info("\nBacktest complete ✓")


if __name__ == "__main__":
    main()
