# AlphaLens
AI-powered sentiment-driven trading intelligence platform for equity markets.

**Course:** MMAI 5090 F — Business Applications of AI II &nbsp;|&nbsp; Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi &nbsp;|&nbsp; Dr. Divinus Oppong-Tawiah

---

**To run locally:**

```
# Terminal 1 — backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2 — frontend
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

---

## The Problem

Retail and institutional traders are drowning in financial news. Thousands of headlines are published every hour across earnings reports, analyst upgrades, geopolitical events, and market commentary. Most traders either ignore this signal entirely or rely on gut instinct to interpret it. Neither approach is systematic, and neither is scalable.

Existing trading tools show you prices. They show you charts. They do not tell you what the market is saying in plain language, how confident to be in a signal, or whether the news actually supports the technical setup. The result is that information asymmetry persists — the traders who can process news fastest win, and everyone else reacts after the move has already happened.

AlphaLens was built to close that gap.

## What AlphaLens Does

AlphaLens is a trading intelligence platform that monitors AAPL, MSFT, TSLA, and NVDA in real time, pulls live financial news for each ticker, scores it with a financial-domain AI model, combines that signal with technical price trend data, and generates a BUY, SELL, or HOLD decision — automatically, every five minutes.

The user opens a dashboard and sees every tracked ticker with its current sentiment score, conviction level, latest headlines, price data, and trading signal — all updated continuously. When they want to understand why a signal was generated, every contributing factor is visible: the exact headlines that drove the sentiment score, the technical trend confirmation, and the conviction threshold that determined the outcome.

Behind the dashboard, a live paper trading bot is executing simulated trades based on those signals, tracking open positions with stop-loss and take-profit rules, and logging every decision to a persistent trade history. A full backtesting engine runs the same strategy across twelve months of historical data and compares performance against the S&P 500 benchmark.

The platform makes the entire signal chain visible and auditable. That is what separates it from a black box.

## The Four AI Components

Rather than sending news headlines to a single model and asking it to make a trading decision, AlphaLens separates the work into four specialized components, each optimized for exactly one job.

**The Sentiment Agent** is the AI core. It loads ProsusAI/finbert, a BERT model fine-tuned specifically on financial text, and runs inference on up to ten live headlines per ticker. Generic sentiment models trained on social media or product reviews perform poorly on financial language, where the same word can be bullish or bearish depending on context. FinBERT was trained on financial news, analyst reports, and earnings calls — the exact domain AlphaLens operates in. The agent converts raw probability distributions into a conviction score from 0 to 10, with full explainability: every headline's label and weight is visible in the output. A keyword-based fallback ensures the system keeps running even when the model is unavailable.

**The Market Data Handler** is the data layer. It fetches live news for each ticker from Yahoo Finance RSS feeds with a fifteen-minute cache to avoid rate limiting, and pulls historical OHLCV price data via yfinance for technical calculations. These two data streams — news sentiment and price history — are what the signal engine runs on.

**The Trading Signal Engine** is the decision layer. It combines two independent signals: whether the current price is above or below the fifty-day moving average (trend confirmation), and whether the FinBERT conviction score crosses defined thresholds. A BUY signal requires both price above the MA50 and conviction at or above 7.0. A SELL signal triggers if price falls below the MA50 or conviction drops below 3.0. Everything else is HOLD. No single signal dominates — both the AI and the technical picture must agree before a position is entered.

**The Live Bot** is the execution layer. It runs a continuous loop on a five-minute interval, checks all open positions for stop-loss and take-profit exits, then cycles through each ticker to fetch new news, score sentiment, compute the signal, and execute paper trades when the threshold is met. Every decision is logged to both a file and the terminal. The bot maintains live position state with entry prices, P&L calculations, and full trade history persisted to JSON.

## Why This Architecture

Separating sentiment analysis, data aggregation, signal computation, and trade execution into distinct components means each one can be tested, debugged, and improved independently. When the sentiment scores change, it is immediately clear whether the issue is in the model, the news feed, or the signal thresholds. When a trade is executed, the full reasoning chain that produced it is already logged.

The architecture also makes the system explainable. Every output — the conviction score, the signal decision, the trade entry — traces back to specific inputs a user can inspect. In trading, explainability is not optional. Decisions need to be understood, reviewed, and justified, not just accepted.

## The Dashboard

The frontend is a live monitoring interface with five sections. The main dashboard shows all four tickers with real-time price data, sentiment scores, signal labels, and the latest headlines that drove the analysis. A watchlist sidebar provides at-a-glance status across the full coverage universe. The strategy tab explains the methodology. The backtest tab shows twelve months of simulated performance against SPY with full statistics. The how it works tab documents the signal logic for any user who wants to understand the system before trusting it.

The dashboard polls the backend every sixty seconds and shows the current NYSE market hours status and a paper trading indicator so it is always clear what mode the system is operating in.

## Backtesting

The backtesting engine runs the full strategy — FinBERT sentiment scoring plus MA50 crossover — across twelve months of historical data for all four tickers. It uses vectorbt for portfolio simulation with the same stop-loss and take-profit parameters as the live bot. Output includes total return, annualized return, Sharpe ratio, Sortino ratio, maximum drawdown, win rate, and trade count, all benchmarked against the S&P 500. Results are rendered as both a static equity curve chart and an interactive Plotly visualization.

## Technical Stack

AlphaLens is a full-stack platform with a Next.js 13 frontend built with TypeScript and TailwindCSS, and a Python FastAPI backend. AI inference runs on ProsusAI/finbert via HuggingFace Transformers with PyTorch. Market data comes from yfinance and Yahoo Finance RSS. Backtesting runs on vectorbt. Charts use Recharts on the frontend and Matplotlib plus Plotly on the backend. Trade state is persisted to JSON. All API credentials are stored server-side only.

**Strategy parameters:**

| Parameter | Value |
|-----------|-------|
| Tickers | AAPL, MSFT, TSLA, NVDA |
| MA window | 50 days |
| BUY conviction threshold | ≥ 7.0 / 10 |
| SELL conviction threshold | < 3.0 / 10 |
| Stop-loss | 2% per trade |
| Take-profit | 5% per trade |
| Bot scan interval | 5 minutes |
| Backtest period | 12 months |
| Starting capital | $10,000 |

## The Bigger Picture

Markets price in information. The traders and systems that process information fastest and most accurately have a structural edge. For individual traders and small teams, that has historically meant falling behind institutions with dedicated research desks and proprietary data feeds.

AlphaLens demonstrates that the core of the information processing workflow — reading financial news, interpreting sentiment, confirming against technical structure, and generating an actionable signal — can be fully automated with open-source tools and publicly available data. FinBERT brings financial NLP accuracy that was previously accessible only to well-resourced teams. vectorbt brings institutional-grade backtesting to a Python backend. The combination produces a platform that any team can run, inspect, and build on.

A signal that used to require reading dozens of headlines and cross-referencing price charts now takes five minutes of automated processing. That is the whole point.

---

**Team:** Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi

Course: MMAI 5090 F — Business Applications of AI II | Instructor: Dr. Divinus Oppong-Tawiah
