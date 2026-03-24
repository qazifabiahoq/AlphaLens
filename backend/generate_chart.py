"""
AlphaLens - generate_chart.py
Simple chart generator using only pandas, numpy, matplotlib, yfinance.
No vectorbt needed. Run this if backtest.py crashes.

Run:
    cd backend
    python generate_chart.py
"""

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

TICKERS          = ["AAPL", "MSFT", "TSLA", "NVDA"]
BENCHMARK_TICKER = "SPY"
INITIAL_CAPITAL  = 10_000.0
MA_WINDOW        = 50
STOP_LOSS_PCT    = 0.02
TAKE_PROFIT_PCT  = 0.05
LOOKBACK_MONTHS  = 12

print("=" * 60)
print("  AlphaLens Chart Generator (no vectorbt)")
print("=" * 60)

# ── Download data ─────────────────────────────────────────────
end   = datetime.today()
start = end - timedelta(days=LOOKBACK_MONTHS * 31)

print(f"\nDownloading {LOOKBACK_MONTHS}-month data...")
data = {}
for t in TICKERS + [BENCHMARK_TICKER]:
    df = yf.download(t, start=start, end=end, progress=False, auto_adjust=True)
    if not df.empty:
        data[t] = df
        print(f"  {t}: {len(df)} rows")
    else:
        print(f"  WARNING: No data for {t}")

# ── Build price DataFrame ─────────────────────────────────────
prices = {}
for t in TICKERS:
    if t not in data:
        continue
    close = data[t]["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    prices[t] = close

price_df = pd.DataFrame(prices)
price_df.index = pd.to_datetime(price_df.index)

# ── MA50 crossover signals ────────────────────────────────────
ma50        = price_df.rolling(MA_WINDOW).mean()
above_ma    = price_df > ma50

# ── Simple backtest with stop-loss / take-profit ──────────────
per_ticker  = INITIAL_CAPITAL / len(price_df.columns)
equity_list = []

all_trades = []

for ticker in price_df.columns:
    prices_t = price_df[ticker].dropna()
    sig_t    = above_ma[ticker].reindex(prices_t.index).fillna(False)

    cash     = per_ticker
    position = 0.0
    entry_px = 0.0
    eq       = []

    for i, (dt, px) in enumerate(prices_t.items()):
        if np.isnan(px):
            eq.append(cash + position * px if not np.isnan(px) else cash)
            continue

        if position > 0:
            chg = (px - entry_px) / entry_px
            if chg <= -STOP_LOSS_PCT or chg >= TAKE_PROFIT_PCT or not sig_t.iloc[i]:
                cash     += position * px * (1 - 0.001)
                all_trades.append(chg * 100)
                position  = 0.0
                entry_px  = 0.0

        if position == 0 and sig_t.iloc[i]:
            shares   = cash / px * (1 - 0.001)
            position = shares
            cash     = 0.0
            entry_px = px

        eq.append(cash + position * px)

    equity_list.append(pd.Series(eq, index=prices_t.index, name=ticker))

# ── Aggregate equity ──────────────────────────────────────────
strat_df  = pd.concat(equity_list, axis=1).sum(axis=1)
strat_df  = strat_df / strat_df.iloc[0] * INITIAL_CAPITAL

# ── SPY benchmark ─────────────────────────────────────────────
spy_close = data[BENCHMARK_TICKER]["Close"]
if isinstance(spy_close, pd.DataFrame):
    spy_close = spy_close.iloc[:, 0]
spy_close.index = pd.to_datetime(spy_close.index)
spy_eq = INITIAL_CAPITAL * spy_close / spy_close.iloc[0]

# ── Metrics ───────────────────────────────────────────────────
common   = strat_df.index.intersection(spy_eq.index)
strat_eq = strat_df.loc[common]
spy_eq   = spy_eq.loc[common]

def calc_metrics(eq):
    ret  = eq.pct_change().dropna()
    tr   = (eq.iloc[-1] / eq.iloc[0] - 1) * 100
    sh   = float(ret.mean() / ret.std() * np.sqrt(252)) if ret.std() > 0 else 0.0
    roll = eq.cummax()
    mdd  = float(((eq - roll) / roll).min() * 100)
    return tr, sh, mdd

strat_ret, strat_sh, strat_dd = calc_metrics(strat_eq)
spy_ret,   spy_sh,   spy_dd   = calc_metrics(spy_eq)

total_tr = len(all_trades)
win_rate = round(sum(1 for t in all_trades if t > 0) / total_tr * 100, 1) if total_tr > 0 else 0.0

print("\n── Results ─────────────────────────────────────────────────")
print(f"  AlphaLens  Total Return    : {strat_ret:+.2f}%")
print(f"  AlphaLens  Sharpe Ratio    : {strat_sh:.2f}")
print(f"  AlphaLens  Max Drawdown    : {strat_dd:.2f}%")
print(f"  AlphaLens  Total Trades    : {total_tr}")
print(f"  AlphaLens  Win Rate        : {win_rate:.1f}%")
print(f"  SPY B&H    Total Return    : {spy_ret:+.2f}%")
print(f"  SPY B&H    Sharpe Ratio    : {spy_sh:.2f}")
print(f"  SPY B&H    Max Drawdown    : {spy_dd:.2f}%")
print("─" * 60)

# ── Plot ──────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(14, 6))
fig.patch.set_facecolor("#0F172A")
ax.set_facecolor("#0F172A")

ax.plot(strat_eq.index, strat_eq, color="#F59E0B", linewidth=2.5,
        label="AlphaLens (MA50 + Stops)")
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
    "AlphaLens: Equity Curve vs S&P 500  (12-Month Backtest | MA50 Crossover + Stops)",
    color="white", fontsize=13, fontweight="bold", pad=15,
)

stats_text = (
    f"AlphaLens   Return: {strat_ret:+.1f}%   "
    f"Sharpe: {strat_sh:.2f}   "
    f"Max DD: {strat_dd:.1f}%   "
    f"Trades: {total_tr}   Win: {win_rate:.1f}%\n"
    f"SPY B&H     Return: {spy_ret:+.1f}%   "
    f"Sharpe: {spy_sh:.2f}   "
    f"Max DD: {spy_dd:.1f}%"
)
ax.text(0.01, 0.04, stats_text, transform=ax.transAxes,
        fontsize=8.5, color="#CBD5E1",
        bbox=dict(facecolor="#1E293B", edgecolor="#334155", boxstyle="round,pad=0.5"))

ax.legend(loc="upper left", facecolor="#1E293B", edgecolor="#334155",
          labelcolor="white", fontsize=10)
ax.grid(True, color="#1E293B", linewidth=0.8)
plt.tight_layout()
plt.savefig("equity_curve.png", dpi=150, bbox_inches="tight", facecolor="#0F172A")
print("✓ Saved: equity_curve.png")

# Plotly HTML (optional)
try:
    import plotly.graph_objects as go
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=list(strat_eq.index), y=list(strat_eq),
        name="AlphaLens (MA50 + Stops)",
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
    print("✓ Saved: backtest_results.html")
except ImportError:
    print("(plotly not installed — skipping HTML chart)")

print("\nDone ✓")
print(f"\nCopy these numbers into your README results table:")
print(f"  Total Return : {strat_ret:+.2f}%  vs SPY {spy_ret:+.2f}%")
print(f"  Sharpe Ratio : {strat_sh:.2f}  vs SPY {spy_sh:.2f}")
print(f"  Max Drawdown : {strat_dd:.2f}%  vs SPY {spy_dd:.2f}%")
print(f"  Total Trades : {total_tr}")
print(f"  Win Rate     : {win_rate:.1f}%")
