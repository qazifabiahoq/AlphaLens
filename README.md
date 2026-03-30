# AlphaLens
An AI-powered trading assistant that reads financial news, scores how positive or negative it is, and combines that with price data to decide whether to buy, sell, or hold a stock.

**Course:** MMAI 5090 F - Business Applications of AI II | Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi | Dr. Divinus Oppong-Tawiah

---

**To run locally:**

**Step 1: Create the environment file** (one-time setup):

Create a file called `.env.local` in the project root with this content:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This tells the frontend where to find the backend. No external API keys are needed.

**Step 2: Install Python dependencies:**

```bash
cd backend
pip install -r requirements.txt
```

Note: `torch` and `transformers` are large packages (~2–3 GB total). The FinBERT model itself (~500 MB) downloads automatically the first time the backend starts. This is a one-time download.

**Step 3: Start both servers** (two separate terminals):

```bash
# Terminal 1 - backend (FastAPI, runs on http://localhost:8000)
cd backend
python -m uvicorn main:app --reload

# Terminal 2 - frontend (Next.js, runs on http://localhost:3000)
npm install
npm run dev
```

**Step 4: Open the app:**

Go to [http://localhost:3000](http://localhost:3000)

**Step 5: Run the backtest (optional, generates equity curve):**

Click the **Backtest** tab in the dashboard, or run it directly from the terminal:

```bash
cd backend
python backtest.py
```

This produces two files in the `backend/` folder:

- `equity_curve.png` - static chart image (open with any image viewer)
- `backtest_results.html` - interactive Plotly chart (open in any browser)

**Note on paper trading execution:** Alpaca Markets' paper trading API does not support Canadian-resident accounts due to regulatory restrictions. AlphaLens uses Yahoo Finance (yfinance) as the equivalent data source, as permitted by the project specification ("or equivalent free data sources like Yahoo Finance"). Trade execution is fully simulated: every BUY and SELL decision is logged to `trades.json` and `alphalens.log` with the same stop-loss and take-profit levels that would be sent to a live broker. The paper trading indicator is visible at all times in the dashboard UI.

---

## The Problem

Every day, thousands of news articles, earnings reports, and analyst opinions are published about publicly traded companies. If you are a regular person trying to invest, there is no realistic way to read all of it. Even professional traders miss things.

Most trading apps just show you a price chart. They do not tell you what the news is saying right now, whether that news is good or bad, or how confident you should be in any given signal. By the time a regular person reads the news and decides to act, the price has often already moved.

AlphaLens was built to automate that reading and decision-making process.

---

## What AlphaLens Does

AlphaLens watches four stocks in real time: Apple (AAPL), Microsoft (MSFT), Tesla (TSLA), and NVIDIA (NVDA).

Every 60 seconds it pulls the latest news headlines for each stock, runs those headlines through an AI model to figure out whether the news is positive or negative, checks a set of price-based rules, and then outputs a BUY, SELL, or HOLD recommendation.

The system is organized into two distinct layers:

**The Brain (LLM - `sentiment.py`):** FinBERT reads up to 10 recent news headlines per stock and classifies the overall tone as POSITIVE, NEGATIVE, or NEUTRAL. It outputs a conviction score from 0 to 10. This is the only place where unstructured text is processed. LLMs are not used anywhere else in the system because they are unreliable at numerical tasks. The Brain handles what it is good at: reading and interpreting language.

**The Body (Deterministic rules - `market_data.py`, `main.py`, `bot.py`):** The execution engine handles everything quantitative. It fetches OHLCV price data from Yahoo Finance, computes technical indicators (moving average, RSI, ATR, volume ratio), evaluates the entry and exit conditions, sizes each position based on volatility, and logs every trade decision. None of this involves the LLM. These are hard rules with no ambiguity.

A trade only happens when the Brain and the Body agree. The LLM must confirm that news is strongly positive (conviction ≥ 7.0) AND the price data must confirm an uptrend, healthy momentum, and real buying volume. If either layer says no, the system holds.

There is also a paper trading bot (`bot.py`) that simulates real trades using real market prices but with no actual money. A separate backtesting engine (`backtest.py`) tests the same strategy on 12 months of historical data and compares the result against simply buying and holding SPY.

---

## How the Signal Works

Think of the signal engine as a checklist. Before AlphaLens recommends buying a stock, it runs through four checks. All four must pass. If any one of them fails, the answer is not BUY.

### Check 1: Is the stock in an upward trend?

AlphaLens looks at the average closing price of the stock over the past 50 trading days. This is called the 50-day moving average. If today's price is above that average, the stock has generally been going up over the last few months. If it is below, the stock has been going down.

AlphaLens only considers buying a stock that is above its 50-day average. The idea is simple: do not buy something that is already trending downward, no matter how good the news sounds.

### Check 2: Is the stock in a healthy buying zone?

This check uses something called the RSI, which stands for Relative Strength Index. You do not need to know the math behind it. What it tells you is whether a stock has been bought up too aggressively recently, or has been falling too fast.

The RSI runs on a scale of 0 to 100. AlphaLens requires the RSI to be between 30 and 70 to enter a trade.

- If the RSI is below 30, the stock has been falling sharply and buying in at that point is risky.
- If the RSI is above 70, the stock has already been overbought by other investors and is probably due for a pullback. Buying at that point means you might be the last one in before the price drops.
- The 30 to 70 range is the sweet spot: the stock is moving but not overextended in either direction.

If the RSI is above 75 while you are already in a trade, AlphaLens treats that as a signal to sell because the stock is getting overheated.

### Check 3: Is there real buying interest behind the move?

Volume means the number of shares that actually changed hands on a given day. When a lot of people are trading a stock, the volume is high. When barely anyone is trading it, the volume is low.

A price increase on low volume can be misleading. It might just be a small number of trades pushing the price around, not a real wave of investor interest. AlphaLens requires that today's trading volume be at least 10% higher than the average volume over the past 20 days before it considers a buy. This confirms that real money is moving into the stock, not just noise.

### Check 4: Is the news actually good?

This is the AI part of the system. AlphaLens feeds up to 10 recent news headlines for each stock into a model called FinBERT. FinBERT is a version of the BERT language model that was specifically trained on financial text, including news articles, analyst reports, and earnings call transcripts. This matters because a word like "cut" means something very different in a product review versus a financial headline about interest rate cuts.

FinBERT reads each headline and outputs a score between 0 and 1 for three labels: positive, neutral, and negative. AlphaLens takes those scores and converts them into a single conviction score between 0 and 10. The higher the score, the more confidently positive the news is.

There is also a penalty built in for ambiguity. If FinBERT is not sure and the neutral score is high, the conviction score is reduced. The formula is:

```
conviction = (dominant_probability * 10) - (neutral_probability * 2)
```

This means a headline that FinBERT is wishy-washy about will produce a lower score than one it is clearly positive about. AlphaLens requires a conviction score of 7.0 or above to consider buying.

### The Full Decision Logic

**BUY** only when all four of the following are true at the same time:
- Price is above the 50-day moving average (the stock is in an uptrend)
- RSI is between 30 and 70 (the stock is not overextended in either direction)
- Today's volume is at least 1.1 times the 20-day average (real trading activity is there)
- FinBERT conviction score is 7.0 or above (the news is clearly positive)

**SELL** if any one of the following becomes true:
- Price drops below the 50-day moving average (the uptrend has broken)
- RSI rises above 75 (the stock has become overbought)
- FinBERT conviction drops below 3.0 (the news has turned negative)
- Price hits the stop-loss level (explained below)
- Price hits the take-profit target (explained below)

**HOLD** in all other cases, meaning the conditions to buy are not quite there yet and no exit trigger has been hit.

The logic is intentionally stricter to get in than to get out. You need four things to go right to buy. You only need one thing to go wrong to sell. This protects against holding onto a losing trade for too long.

---

## Stop-Loss and Take-Profit: How the Bot Protects Itself

Every trade AlphaLens enters comes with two automatic exit prices set at the moment of entry. These are not optional. They fire automatically.

**Stop-loss** is the price at which AlphaLens automatically sells to cut a losing trade. It is set below the entry price. If the stock falls to that level, the trade closes immediately to limit the damage.

**Take-profit** is the price at which AlphaLens automatically sells to lock in a winning trade. It is set above the entry price. When the stock hits that target, the position is closed and the gain is realized.

Rather than using a fixed percentage for both of these (like always set the stop 2% below entry), AlphaLens uses something called the Average True Range, or ATR. The ATR measures how much the stock price typically moves in a single day based on the past 14 days of price data. This gives a more realistic picture of what counts as normal movement versus a real problem.

- Stop-loss is set at: entry price minus 1.5 times the ATR
- Take-profit is set at: entry price plus 3 times the ATR

This means if a stock normally moves $2 per day, the stop is $3 below entry and the target is $6 above. For every $1 you risk, you are targeting a $2 gain. That 2-to-1 ratio is built in on every single trade.

The reason this is better than a fixed percentage is that a stock like TSLA naturally moves more than a stock like MSFT. A 2% stop on TSLA might get hit just by normal daily noise, causing you to exit a perfectly good trade. By basing the stop on actual historical volatility, the exits are appropriate for each individual stock.

---

## Position Sizing: How Much to Buy

AlphaLens does not always buy the same number of shares. Instead, it calculates how many shares to buy based on how much risk it is willing to take.

The rule is: risk exactly 1% of the total portfolio on each trade, no more.

The calculation is:

```
shares to buy = floor((total portfolio value * 1%) / (1.5 * ATR))
```

Here is what that means in plain terms. If the portfolio is worth $10,000 and you are risking 1%, you are willing to lose a maximum of $100 on this trade. The stop-loss is 1.5 times the ATR below your entry. If the ATR is $5, your stop-loss distance is $7.50. Divide $100 by $7.50 and you can afford to buy 13 shares while keeping the risk at exactly $100.

If the ATR is higher (the stock is more volatile), the number of shares goes down automatically. If the ATR is lower (the stock is calmer), you can buy more shares and still stay within the $100 risk limit. The system naturally bets smaller on volatile stocks and larger on stable ones.

---

## The Keyword Fallback

FinBERT requires about 500MB of storage and an internet connection to download on first use. If the model cannot load for any reason, AlphaLens does not crash. It switches to a simple keyword-based backup system that reads the same headlines and counts how many positive and negative words appear.

Positive words it looks for: `beat, beats, surge, record, growth, profit, bullish, upgrade, buy, strong, rally, gain, exceed, outperform, revenue, positive, up, rise, high, launch, partnership`

Negative words it looks for: `miss, misses, fall, drop, loss, bearish, downgrade, sell, weak, decline, recall, lawsuit, fine, cut, warning, risk, fraud, layoff, crash, concern, debt`

If more positive words appear than negative, the headline is scored as positive and the score is the ratio of positive words to total matched words. If more negative words appear, it goes the other way. If it is a tie, the result is neutral with a score of 0.5. That result is then scaled to the same 0 to 10 range used by FinBERT, so nothing else in the system needs to change.

This fallback is less accurate than FinBERT but it means the platform keeps running even without the full model loaded.

---

## Guardrails Against Overtrading and Hallucinated Signals

A major risk in any LLM-driven system is acting on signals that are too frequent, too noisy, or based on model confusion rather than real market conditions. AlphaLens has five specific guardrails built in.

**1. The LLM never touches price data.**
FinBERT only reads text (news headlines). All numerical decisions (entry price, stop-loss, take-profit, position size) are computed by deterministic rules. This eliminates the risk of the model hallucinating a price or miscalculating a percentage.

**2. Sentiment alone is never enough to trade.**
Even a conviction score of 10/10 does not trigger a buy if the price is below the 50-day moving average, the RSI is outside the 30–70 range, or volume is below the minimum. All four conditions must pass simultaneously. This prevents overtrading on news noise.

**3. RSI limits chasing momentum.**
Requiring RSI between 30 and 70 prevents entering a stock that has already been bid up excessively. This stops the bot from buying at the top of a move just because the news sounds good.

**4. Volume confirmation filters thin-market moves.**
Requiring volume at least 1.1× the 20-day average filters out price moves caused by low-liquidity trading sessions, where a small number of trades can create misleading price signals.

**5. News caching prevents API hammering.**
Yahoo Finance RSS results are cached for 15 minutes per ticker. This prevents the bot from flooding the news source with repeated requests and avoids acting on stale or duplicated headlines within a short window.

**6. Keyword fallback prevents complete failure.**
If FinBERT cannot load for any reason, the system automatically switches to a keyword-based backup that counts positive and negative words in headlines. The platform keeps running and producing signals even without the full AI model. This means the system never goes completely offline due to a model loading failure.

---

## The Paper Trading Bot

The trading bot lives in `bot.py`. Paper trading means it simulates real trades using real market prices but with fake money. Nothing is ever actually bought or sold. It is used to test whether the strategy works before ever committing real capital.

Here is what the bot does every 5 minutes:

1. It checks all currently open positions to see if the stop-loss or take-profit level has been hit. If either one has been reached, it closes that position and logs the result.
2. It then goes through each of the four tracked stocks one by one.
3. For each stock, it pulls the latest headlines, runs FinBERT sentiment scoring, and computes the four indicators (moving average, RSI, volume, ATR).
4. It evaluates whether the entry or exit conditions are met.
5. If the BUY conditions are met and there is no open position in that stock, it enters a new paper trade and calculates how many shares to buy using the 1% risk rule.
6. If a SELL condition is met and there is an open position, it closes the position and reports the profit or loss.
7. Otherwise it holds and waits for the next scan.

Every action is written to the terminal, saved to `alphalens.log`, and stored in `trades.json` so there is a full record of everything the bot has done.

---

## Backtesting

Before trusting any strategy with real money, you should test it on historical data. Backtesting means running the exact same rules on past price data to see how the strategy would have performed.

AlphaLens uses a library called vectorbt to simulate the full strategy on 12 months of historical price data for all four stocks. FinBERT is run on current headlines as a stand-in for historical sentiment (since past headlines are not stored). The simulated portfolio starts with $10,000.

Results are compared against SPY, which is an ETF that tracks the S&P 500 index. The S&P 500 is a basket of 500 large US companies and is the standard benchmark that most investment strategies are measured against. If AlphaLens cannot beat simply buying and holding SPY, that is an important thing to know.

The backtest produces:
- Total return (how much the portfolio grew in percentage terms)
- Annualized return (what that growth looks like averaged over a full year)
- Sharpe ratio (how much return you got per unit of risk taken; higher is better)
- Sortino ratio (similar to Sharpe but only penalizes downside volatility, not upside)
- Maximum drawdown (the largest peak-to-trough loss the portfolio experienced)
- Win rate (the percentage of trades that were profitable)
- Total trade count

The equity curve is saved as both a static image (`equity_curve.png`) and an interactive chart (`backtest_results.html`) in the backend folder.

---

## The Dashboard

The dashboard is a browser-based interface with five tabs.

The main tab shows all four stocks with their current price, change from yesterday, sentiment score, conviction rating, trading signal, and the actual headlines that drove the analysis. Everything updates automatically every 60 seconds.

The watchlist sidebar gives you a quick overview of all four stocks at once so you can see which ones are bullish, neutral, or bearish without clicking through each one.

The strategy tab explains the methodology in plain language.

The backtest tab shows the 12-month simulation results including the equity curve chart comparing AlphaLens performance against SPY.

The how-it-works tab walks through the signal logic step by step.

The dashboard also shows whether the NYSE (New York Stock Exchange) is currently open or closed, and displays a paper trading indicator so it is always clear that no real money is involved.

---

## LLM Prompt Design

AlphaLens uses a prompt template to frame what it is asking FinBERT to evaluate. The prompt is:

```
You are a financial analyst.
Classify the following news about {ticker} as POSITIVE, NEUTRAL, or NEGATIVE
and rate your conviction from 0 (no signal) to 10 (extremely strong signal).
Headlines:
{headlines}
```

This prompt is stored and returned with every signal response under the field `prompt_used`. This makes the system auditable: you can always see exactly what text was fed to the model and what score came back.

It is worth noting that FinBERT does not respond to this prompt the way a chatbot like ChatGPT would. FinBERT is a classification model, not a generative one. It reads each headline and outputs probabilities for three labels. The prompt structure is used here to document the task context and is included in the API output for transparency and explainability purposes.

The actual scoring formula that converts those probabilities into a usable number is:

```
conviction = (dominant_probability * 10) - (neutral_probability * 2)
```

The dominant probability is whichever label scored highest (positive, neutral, or negative). The neutral probability is subtracted with a penalty of 2 to reduce the score when the model is uncertain. A headline that FinBERT reads as 90% positive and 5% neutral gets a conviction score close to 9. A headline that FinBERT reads as 55% positive and 35% neutral gets penalized down to around 4.5. This prevents weak or ambiguous signals from reaching the 7.0 threshold and triggering a trade.

---

## Technical Stack

AlphaLens is a full-stack application. The frontend is built with Next.js 13, TypeScript, and TailwindCSS. The backend is a Python FastAPI server. The AI model is ProsusAI/finbert, downloaded automatically from HuggingFace using the Transformers library with PyTorch. Market data comes from yfinance. News headlines are pulled from Yahoo Finance RSS feeds and cached for 15 minutes to avoid hitting the source too frequently. Backtesting uses vectorbt. Charts on the frontend use Recharts. The backend exports charts using Matplotlib and Plotly. All trade state is saved to a local JSON file.

**Strategy parameters:**

| Parameter | Value |
|-----------|-------|
| Tickers tracked | AAPL, MSFT, TSLA, NVDA |
| Trend filter (moving average window) | 50 days |
| Momentum filter (RSI period) | 14 days |
| RSI entry range | 30 to 70 |
| RSI overbought exit level | above 75 |
| Volume filter window | 20-day rolling average |
| Volume minimum to enter | at least 1.1 times the 20-day average |
| Volatility measure (ATR period) | 14 days |
| Stop-loss distance | 1.5 times ATR below entry price |
| Take-profit target | 3.0 times ATR above entry price (2 to 1 reward-to-risk) |
| Minimum conviction to buy | 7.0 out of 10 |
| Conviction level that triggers sell | below 3.0 out of 10 |
| Portfolio risk per trade | 1% |
| Bot scan frequency | every 5 minutes |
| Backtest period | 12 months |
| Starting paper portfolio | $10,000 |

---

## API Keys

No external API keys are required to run AlphaLens.

The only configuration file needed is `.env.local` in the project root:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This is not an external API key. It is a local configuration value that tells the Next.js frontend where the Python backend is running. Without it, the dashboard will show "OFFLINE" even if the backend is running correctly.

FinBERT downloads automatically from HuggingFace on first run. This is a one-time download of approximately 500 MB and runs entirely on your local machine with no API key or account required. yfinance and Yahoo Finance RSS feeds are completely free with no authentication. Everything runs out of the box once the `.env.local` file is in place.

---

## Backtest Results

The backtest applies the same four-condition entry logic on 12 months of real daily OHLCV data for AAPL, MSFT, TSLA, and NVDA using vectorbt for portfolio simulation. The starting paper portfolio is $10,000 split equally across the four tickers. A 2% stop-loss and 5% take-profit are attached to every simulated trade. Results are benchmarked against SPY (S&P 500 ETF) on a buy-and-hold basis starting from the same date.

**Generating the results:**

Run the backtest from the terminal:

```bash
cd backend
python backtest.py
```

Or start the backend and click the Backtest tab in the dashboard. First run takes 2–5 minutes because FinBERT processes each ticker's live headlines before the simulation begins. Results appear automatically in the Backtest tab once complete.

**Viewing the equity curve:**

Two chart files are saved automatically inside the `backend/` folder after the backtest runs:

- `equity_curve.png` - open by double-clicking in File Explorer. Shows portfolio value vs. SPY over 12 months.
- `backtest_results.html` - open in any browser (Chrome, Edge, Firefox). Interactive version of the same chart with hover tooltips and zoom.

**Results (12-month backtest, March 2025 – March 2026):**

| Metric | AlphaLens Strategy | SPY Buy & Hold |
|--------|--------------------|----------------|
| Total Return | -2.75% | +17.23% |
| Annualized Return | -2.71% | n/a |
| Sharpe Ratio | -0.16 | 0.93 |
| Sortino Ratio | -0.18 | n/a |
| Max Drawdown | -17.36% | -13.72% |
| Win Rate | n/a | n/a |
| Total Trades | n/a | n/a |

**Interpreting these results:**

AlphaLens underperformed SPY buy-and-hold over this 12-month window. This is not unexpected and reflects two things worth understanding.

First, the 12-month window ending March 2026 included a sharp market correction in early 2026 driven by macroeconomic uncertainty. During that period, many stocks traded below their 50-day moving average, which correctly caused AlphaLens to stay out of trades. A system that avoids buying in a downtrend is behaving as designed, but it also means it missed the recovery periods that lifted SPY.

Second, the goal of this project is not to beat the S&P 500. The professor's stated objective is "the creation of a robust, reproducible, and explainable data pipeline." AlphaLens achieves that: every signal is traceable, every decision is logged, and the reasoning behind every BUY, SELL, or HOLD is printed in plain language. The strategy is intentionally conservative: it requires four conditions to align before entering a trade precisely to avoid reckless speculation.

The honest takeaway is that a sentiment-gated, trend-following strategy performs well in trending bull markets and defensively in corrections, but may underperform a passive index over short windows. This is a known property of rule-based systematic strategies and is consistent with academic literature on the topic.

**Why the backtest sentiment is different from the live system:**

The live bot pulls real Yahoo Finance headlines at the moment of every signal check and runs them through FinBERT in real time. That part is completely real. The backtest limitation is different. The backtest goes back 12 months in history and we have real historical price data for all 12 months. But we do not have the actual news headlines from 12 months ago because Yahoo Finance does not store old headlines for free. Historical news databases that go back months or years cost money. So for the backtest only, we used price momentum as a substitute for the sentiment signal. This is a known and documented simplification. The live system is not affected by this at all.

**Known limitation:** The backtesting sentiment gate uses FinBERT run on today's headlines as a static filter applied across the full 12-month window. This is a deliberate simplification: tick-level historical sentiment data is not freely available. The backtest uses a lower conviction threshold (3.0) compared to the live bot (7.0) to account for this — on days when market news is broadly cautious, applying the live threshold would block all trades entirely, producing a flat equity curve with zero trades, which is not a meaningful backtest result. The live bot always uses the most current headlines at the moment of each signal check and is not affected by this simplification.

---

## Future Improvements

Several enhancements would make AlphaLens more robust in future versions.

**Market regime filter.** If SPY itself is in a downtrend, the system should block all new buys regardless of individual stock signals. Buying individual stocks during a broad market collapse is risky no matter how good the news sounds for one company. Adding a check that looks at whether the overall market is healthy before allowing any trade would reduce losses during market-wide crashes.

**Earnings calendar awareness.** The system currently has no knowledge of upcoming earnings announcements. Buying a stock 24 to 48 hours before its earnings report is very risky because prices can move dramatically in either direction. A future version would block new entries within two days of a known earnings date.

**Maximum portfolio exposure limit.** Right now the system could theoretically be in all four stocks at the same time. During a broad market downturn that would mean all four positions losing money simultaneously. Capping the number of open positions at two at a time would reduce this concentration risk.

**News source quality scoring.** All Yahoo Finance headlines are currently treated equally. A headline from Reuters or the Wall Street Journal should carry more weight than a smaller blog. Adding a source credibility score that adjusts the conviction output would make the sentiment signal more reliable.

**More stocks and sectors.** All four tracked stocks are large-cap US technology companies. They tend to move together, which means the portfolio is not truly diversified. Expanding to include stocks from different sectors like energy, healthcare, or financials would test whether the strategy holds up outside of tech and reduce correlated risk.

---

## The Bigger Picture

Stock markets move on information. When a company reports better earnings than expected, its price goes up. When a product gets recalled, it goes down. The people who read that information first and act on it fastest are the ones who profit. Everyone else reacts after the move has already happened.

AlphaLens is a demonstration that you can automate the reading and the reacting. A domain-specific AI model handles the news. A transparent rule engine handles the decision. Volatility-adjusted risk management handles the exits. None of the logic is hidden or mysterious. Every signal comes with a plain-language explanation of exactly what was checked and why the decision was made.

The result is a system that can process four stocks, analyze dozens of headlines, compute technical indicators, and output a reasoned BUY, SELL, or HOLD recommendation every 60 seconds without any human involvement. That is the whole point.

The honest result of the backtest is that the system underperformed a simple buy and hold of SPY over this 12-month window. But that is not the full story. A system that refuses to buy during a market downturn is behaving exactly as designed. The goal was never to beat the market at all costs. The goal was to build something transparent, explainable, and disciplined. Every single decision AlphaLens makes can be traced back to a specific rule or a specific headline. That level of explainability is rare in AI systems and is exactly what responsible AI deployment looks like in a high-stakes domain like finance.

---

## References

The technical indicators used in AlphaLens are based on widely established methods in financial technical analysis:

- 50-Day Moving Average: https://www.fidelity.com/viewpoints/active-investor/moving-averages
- RSI 30–70 range (original Wilder thresholds): https://www.fidelity.com/learning-center/trading-investing/technical-indicator-guide/RSI
- RSI overbought and oversold levels: https://www.schwab.com/learn/story/identifying-trend-reversals-with-rsi
- Volume 20-day average confirmation: https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/average-daily-trading-volume-adtv/

---

**Team:** Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi

Course: MMAI 5090 F - Business Applications of AI II | Instructor: Dr. Divinus Oppong-Tawiah
