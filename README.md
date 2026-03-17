# AlphaLens
AI-powered sentiment-driven stock signal platform for equity markets.

**Course:** MMAI 5090 F - Business Applications of AI II | Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi | Dr. Divinus Oppong-Tawiah

---

**To run locally:**

```
# Terminal 1 - backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2 - frontend
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

---

## The Problem

Retail traders are drowning in financial news. Thousands of headlines are published every hour across earnings reports, analyst upgrades, geopolitical events, and market commentary. Most traders either ignore this signal entirely or rely on gut instinct to interpret it. Neither approach is systematic or scalable.

Existing trading tools show prices and charts. They do not tell you what the market is saying in plain language, how confident to be in a signal, or whether the news actually supports the technical setup. The traders who can process news fastest win, and everyone else reacts after the move has already happened.

AlphaLens was built to close that gap.

## What AlphaLens Does

AlphaLens is a stock signal platform that monitors AAPL, MSFT, TSLA, and NVDA in real time. For each ticker it pulls live financial news headlines, scores them with FinBERT (a financial-domain NLP model), checks whether the current price is above or below the 50-day moving average, and combines those two signals into a BUY, SELL, or HOLD decision.

The user opens a dashboard and sees every tracked ticker with its current sentiment score, conviction level, latest headlines, price data, and trading signal, all updated every 60 seconds. The reasoning behind every signal is visible: how many headlines were analyzed, what the conviction score was, and whether the price trend confirmed or contradicted the sentiment reading.

A paper trading bot runs in the background on a 5-minute loop, executing simulated trades when thresholds are met and tracking open positions with stop-loss and take-profit rules. A backtesting engine runs the full strategy across 12 months of historical data and benchmarks the result against the S&P 500.

## How the Signal Works

The signal logic combines two independent inputs.

The first input is news sentiment. AlphaLens feeds up to 10 live headlines per ticker into FinBERT, a BERT model fine-tuned specifically on financial text by ProsusAI. Generic sentiment models trained on social media or product reviews perform poorly on financial language, where the same word can be bullish or bearish depending on context. FinBERT was trained on financial news, analyst reports, and earnings calls. The model returns a probability distribution across positive, neutral, and negative labels. AlphaLens converts that into a conviction score from 0 to 10, penalizing ambiguous results where the neutral probability is high. If FinBERT cannot load (no internet or low RAM), a keyword-based fallback keeps the system running.

The second input is price trend. AlphaLens fetches 12 months of daily OHLCV data via yfinance and computes the 50-day moving average. If the current price is above the MA50, the trend is bullish. If below, it is not.

The decision rule is explicit and deterministic:

- **BUY**: price is above the 50-day MA and FinBERT conviction is at or above 7.0 out of 10
- **SELL**: price is below the 50-day MA, or conviction falls below 3.0
- **HOLD**: everything else

Neither signal alone is enough to trigger a BUY. Both the AI sentiment reading and the technical trend must agree.

## The Paper Trading Bot

The bot (`bot.py`) runs a continuous loop every 5 minutes. At each interval it checks all open positions for stop-loss and take-profit exits, then cycles through every ticker: fetches fresh news, scores sentiment with FinBERT, computes the signal, and executes a simulated trade if the threshold is met. Every trade is logged to the terminal, to `alphalens.log`, and persisted in `trades.json`. Position state is tracked in memory with entry prices and P&L calculations updated at each scan.

## Backtesting

The backtesting engine runs the same strategy across 12 months of historical data for all four tickers using vectorbt for portfolio simulation. FinBERT scores live headlines at the time of the backtest run as a proxy for historical sentiment. Results are benchmarked against SPY and include total return, annualized return, Sharpe ratio, Sortino ratio, maximum drawdown, win rate, and total trade count. The output includes an equity curve rendered as both a static Matplotlib chart and an interactive Plotly visualization.

## The Dashboard

The frontend is a live monitoring interface with five tabs. The main dashboard shows all four tickers with real-time price data, sentiment scores, signal labels, and the latest headlines that drove each analysis. A watchlist sidebar gives at-a-glance status across the full coverage universe. The strategy tab explains the methodology. The backtest tab shows 12 months of simulated performance against SPY. The how-it-works tab documents the signal logic.

The dashboard polls the backend every 60 seconds and displays the current NYSE market hours status and a paper trading indicator so it is always clear what mode the system is operating in.

## Technical Stack

AlphaLens is a full-stack platform with a Next.js 13 frontend built with TypeScript and TailwindCSS, and a Python FastAPI backend. Sentiment analysis runs on ProsusAI/finbert via HuggingFace Transformers with PyTorch. Market data and price history come from yfinance. News headlines are fetched from Yahoo Finance RSS with a 15-minute cache. Backtesting runs on vectorbt. Charts use Recharts on the frontend and Matplotlib plus Plotly on the backend. Trade state is persisted to JSON. All processing happens server-side.

**Strategy parameters:**

| Parameter | Value |
|-----------|-------|
| Tickers | AAPL, MSFT, TSLA, NVDA |
| MA window | 50 days |
| BUY conviction threshold | 7.0 / 10 or above |
| SELL conviction threshold | below 3.0 / 10 |
| Stop-loss | 2% per trade |
| Take-profit | 5% per trade |
| Bot scan interval | 5 minutes |
| Backtest period | 12 months |
| Starting capital | $10,000 |

## API Keys

No API keys are required to run AlphaLens.

FinBERT (ProsusAI/finbert) downloads automatically from HuggingFace on first run (~500MB, one time only). yfinance and Yahoo Finance RSS are both free and require no authentication. All data sources are open and key-free.

## LLM Prompt Design

The sentiment agent uses the following prompt template to frame the FinBERT classification task:

```
You are a financial analyst.
Classify the following news about {ticker} as POSITIVE, NEUTRAL, or NEGATIVE
and rate your conviction from 0 (no signal) to 10 (extremely strong signal).
Headlines:
{headlines}
```

This prompt is constructed for explainability and logged with every signal output so the reasoning behind each decision can be audited. In practice, FinBERT does not process the prompt as free text the way a generative LLM would. The template is used to document what the model was asked to evaluate and is included in the API response under `prompt_used`.

FinBERT runs inference on each headline independently and returns a probability distribution across positive, neutral, and negative labels. AlphaLens averages those probabilities across all headlines for a ticker, then converts the dominant label's probability into a conviction score using the formula:

```
conviction = (dominant_probability * 10) - (neutral_probability * 2)
```

The penalty for high neutral probability ensures that ambiguous or mixed headlines reduce the conviction score rather than producing a falsely confident signal.

## Backtest Results

Results are generated dynamically by running the backtesting engine. Live results are visible in the Backtest tab of the dashboard after starting the app. Representative metrics from a 12-month run on AAPL, MSFT, TSLA, NVDA vs SPY benchmark:

| Metric | AlphaLens Strategy | SPY Benchmark |
|--------|--------------------|---------------|
| Total Return | see dashboard | see dashboard |
| Annualized Return | see dashboard | see dashboard |
| Sharpe Ratio | see dashboard | see dashboard |
| Sortino Ratio | see dashboard | see dashboard |
| Max Drawdown | see dashboard | see dashboard |
| Win Rate | see dashboard | - |
| Total Trades | see dashboard | - |

To generate results: start the backend and open the Backtest tab. The engine runs FinBERT on live headlines for each ticker, builds signals using the same MA50 + conviction thresholds as the live bot, and runs a vectorbt portfolio simulation with stop-loss and take-profit applied. The equity curve chart is also exported as `equity_curve.png` and `equity_curve.html` in the backend folder.

## The Bigger Picture

Markets price in information. The traders who can process that information fastest and most accurately have a structural edge. For individual traders and small teams, keeping up with news at scale has historically been impractical.

AlphaLens demonstrates that financial sentiment analysis with a domain-specific NLP model can be integrated with standard technical analysis rules to produce an automated, explainable signal pipeline. FinBERT brings financial NLP accuracy that would otherwise require significant resources to replicate. vectorbt brings institutional-grade backtesting to a Python backend. The combination produces a platform that is transparent about every decision it makes, which matters in trading as much as the decisions themselves.

A signal that used to require reading dozens of headlines and cross-referencing price charts now happens automatically. That is the whole point.

---

**Team:** Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi

Course: MMAI 5090 F - Business Applications of AI II | Instructor: Dr. Divinus Oppong-Tawiah
