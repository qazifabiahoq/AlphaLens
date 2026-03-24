# AlphaLens
An AI-powered trading assistant that reads financial news, scores how positive or negative it is, and combines that with price data to decide whether to buy, sell, or hold a stock.

**Course:** MMAI 5090 F - Business Applications of AI II | Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi | Dr. Divinus Oppong-Tawiah

---

**To run locally:**

```
# Terminal 1 - backend
cd backend
python -m uvicorn api_server:app --reload

# Terminal 2 - frontend
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

---

## The Problem

Every day, thousands of news articles, earnings reports, and analyst opinions are published about publicly traded companies. If you are a regular person trying to invest, there is no realistic way to read all of it. Even professional traders miss things.

Most trading apps just show you a price chart. They do not tell you what the news is saying right now, whether that news is good or bad, or how confident you should be in any given signal. By the time a regular person reads the news and decides to act, the price has often already moved.

AlphaLens was built to automate that reading and decision-making process.

---

## What AlphaLens Does

AlphaLens watches four stocks in real time: Apple (AAPL), Microsoft (MSFT), Tesla (TSLA), and NVIDIA (NVDA).

Every 60 seconds it pulls the latest news headlines for each stock, runs those headlines through an AI model to figure out whether the news is positive or negative, checks a few price-based signals, and then outputs a BUY, SELL, or HOLD recommendation.

It does not just look at one thing. It checks four separate conditions before recommending a buy. If even one of those conditions fails, it stays out of the trade. This makes the system conservative by design, which is a good thing when real money is involved.

There is also a simulated trading bot that runs in the background and pretends to buy and sell with fake money. This is called paper trading, and it lets you test the strategy without any financial risk. A separate backtesting tool tests the same strategy on the past 12 months of real historical data to see how it would have performed.

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

AlphaLens uses a library called vectorbt to simulate the strategy on 12 months of historical price data for all four stocks. The simulated portfolio starts with $10,000.

The backtest tests the technical component of the strategy: the 50-day moving average crossover with ATR-based stop-loss and take-profit. The FinBERT sentiment gate is not applied in the backtest because historical news headlines are not stored. Using today's headlines to judge trades from 12 months ago would be look-ahead bias, meaning the backtest would be cheating by using information that did not exist at trade time. The sentiment layer is validated through live paper trading in bot.py instead.

Results are compared against SPY, which is an ETF that tracks the S&P 500 index. The S&P 500 is a basket of 500 large US companies and is the standard benchmark that most investment strategies are measured against. If AlphaLens cannot beat simply buying and holding SPY, that is an important thing to know.

The backtest produces:
- Total return (how much the portfolio grew in percentage terms)
- Annualized return (what that growth looks like averaged over a full year)
- Sharpe ratio (how much return you got per unit of risk taken; higher is better)
- Sortino ratio (similar to Sharpe but only penalizes downside volatility, not upside)
- Maximum drawdown (the largest peak-to-trough loss the portfolio experienced)
- Win rate (the percentage of trades that were profitable)
- Total trade count

The equity curve is saved as both a static image (`equity_curve.png`) and an interactive chart (`equity_curve.html`) in the backend folder.

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

No API keys are required to run AlphaLens.

FinBERT downloads automatically from HuggingFace the first time you run the backend. This is a one-time download of about 500MB. After that it runs locally with no internet required for the model itself. yfinance and Yahoo Finance RSS are both completely free and require no account or authentication. Everything is open and ready to run out of the box.

---

## Backtest Results

Results are generated live by the backtesting engine and are visible in the Backtest tab of the dashboard after starting the app. To generate results yourself, start the backend and click the Backtest tab. The engine will run FinBERT on current headlines for each ticker, apply the same four-condition signal rules used by the live bot, simulate trades over the past 12 months using vectorbt, and display the results alongside the SPY benchmark.

The equity curve is also exported automatically as `equity_curve.png` and `equity_curve.html` in the backend folder.

| Metric | AlphaLens Strategy | SPY Benchmark |
|--------|--------------------|---------------|
| Total Return | see dashboard | see dashboard |
| Annualized Return | see dashboard | see dashboard |
| Sharpe Ratio | see dashboard | see dashboard |
| Sortino Ratio | see dashboard | see dashboard |
| Max Drawdown | see dashboard | see dashboard |
| Win Rate | see dashboard | not applicable |
| Total Trades | see dashboard | not applicable |

---

## The Bigger Picture

Stock markets move on information. When a company reports better earnings than expected, its price goes up. When a product gets recalled, it goes down. The people who read that information first and act on it fastest are the ones who profit. Everyone else reacts after the move has already happened.

AlphaLens is a demonstration that you can automate the reading and the reacting. A domain-specific AI model handles the news. A transparent rule engine handles the decision. Volatility-adjusted risk management handles the exits. None of the logic is hidden or mysterious. Every signal comes with a plain-language explanation of exactly what was checked and why the decision was made.

The result is a system that can process four stocks, analyze dozens of headlines, compute technical indicators, and output a reasoned BUY, SELL, or HOLD recommendation every 60 seconds without any human involvement. That is the whole point.

---

**Team:** Noelia Cornejo · Dedan Deus · Emily Bendeck Garay · Qazi Fabia Hoq · Esha Malhi

Course: MMAI 5090 F - Business Applications of AI II | Instructor: Dr. Divinus Oppong-Tawiah
