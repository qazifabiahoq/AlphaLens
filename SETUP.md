# AlphaLens — Setup Guide
**How to run this project on your computer (Windows)**

---

## STEP 1 — Install the required software (do this once)

You need 3 programs installed before anything else.

### 1A. Install Python 3.11
1. Go to **https://www.python.org/downloads/**
2. Click the big yellow **Download Python 3.11.x** button
3. Run the installer
4. ⚠️ **IMPORTANT:** On the first screen, check the box that says **"Add Python to PATH"**
5. Click **Install Now**

Check it worked — open any terminal and type:
```
python --version
```
You should see `Python 3.11.x`

---

### 1B. Install Node.js
1. Go to **https://nodejs.org**
2. Click **Windows Installer (.msi)** — the green LTS button
3. Run the installer
4. Keep clicking **Next** (don't change anything, don't check the extra tools box)
5. Click **Install** then **Finish**

Check it worked:
```
node --version
npm --version
```
Both should show a version number.

---

### 1C. Install VS Code
1. Go to **https://code.visualstudio.com**
2. Click **Download for Windows**
3. Run the installer, keep clicking Next

---

## STEP 2 — Enable Windows Long Paths (Windows only, do once)

Some packages have very long file names that Windows blocks by default. Fix it:

1. Press the **Windows key**
2. Search for **PowerShell**
3. Right-click **Windows PowerShell** → click **"Run as administrator"**
4. Click **Yes**
5. Paste this command and press Enter:
```
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```
6. You should see `LongPathsEnabled : 1` — that means it worked
7. **Restart your computer**

---

## STEP 3 — Download the project

1. Go to **https://github.com/qazifabiahoq/AlphaLens**
2. Click the green **Code** button → click **Download ZIP**
3. Go to your Downloads folder
4. Right-click the ZIP file → **Extract All** → click **Extract**
5. You should now have a folder called **AlphaLens-main**

---

## STEP 4 — Open the project in VS Code

1. Open **VS Code**
2. Click **File** → **Open Folder**
3. Find and select the **AlphaLens-main** folder
4. Click **Select Folder**

You should see all the project files on the left side.

---

## STEP 5 — Open two terminals

You need two terminals open at the same time.

1. Press **Ctrl + `** (the backtick key, top left of keyboard) to open Terminal 1
2. Click the **+** icon in the terminal panel to open Terminal 2

They will appear as tabs at the bottom. You'll switch between them.

---

## STEP 6 — Install Python packages (Terminal 1)

In **Terminal 1**, type these commands one at a time:

```
cd backend
```
```
pip install fastapi uvicorn yfinance pandas numpy matplotlib transformers torch requests python-dotenv plotly
```

⚠️ This will take **5–10 minutes** because it downloads large packages including the AI model. Just wait. Don't close the terminal.

When you see the `PS C:\...>` prompt come back, it's done.

---

## STEP 7 — Install frontend packages (Terminal 2)

Click on **Terminal 2** and type:

```
npm install
```

This takes 1–2 minutes. Wait for the prompt to come back.

---

## STEP 8 — Create the environment file

This file tells the frontend where the backend is running.

1. In VS Code, look at the left panel (Explorer)
2. Right-click on the **AlphaLens-main** folder (the top one)
3. Click **New File**
4. Name it exactly: `.env.local`
5. Click on the file to open it
6. Paste this inside:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
7. Press **Ctrl + S** to save

⚠️ Do NOT put this file on GitHub. It stays only on your computer.

---

## STEP 9 — Run the project

Now you run both terminals at the same time.

### Terminal 1 — Start the backend:
```
python -m uvicorn api_server:app --reload
```

Wait until you see:
```
INFO: Uvicorn running on http://127.0.0.1:8000
```
That means the backend is running. **Leave this terminal open.**

### Terminal 2 — Start the frontend:
```
npm run dev
```

Wait until you see:
```
Local: http://localhost:3000
```
That means the frontend is running. **Leave this terminal open too.**

---

## STEP 10 — Open the dashboard

Open your browser and go to:

**http://localhost:3000**

You should see the AlphaLens dashboard. In the top right it should say **LIVE** (green dot).

---

## STEP 11 — Run the trading bot (for the demo)

To show the live bot working (what you show the prof):

Stop Terminal 1 with **Ctrl + C**, then run:
```
python bot.py
```

You will see the bot scanning stocks every 5 minutes in the terminal — showing news fetching, FinBERT sentiment scoring, and trade signals. This is the live demo.

---

## STEP 12 — Run the backtest (generates the charts)

In Terminal 1, run:
```
python backtest.py
```

This will:
1. Download real 12-month price data from yfinance
2. Run FinBERT on live news headlines
3. Simulate the strategy using vectorbt
4. Save two output files in the backend folder:
   - `equity_curve.png` — the chart image
   - `backtest_results.html` — interactive chart

⚠️ This needs vectorbt installed first:
```
pip install vectorbt
```
Then run `python backtest.py`

---

## Notes

- **Prices show $0.00?** Normal — the market is closed. Real prices show on weekdays 9:30am–4:00pm EST.
- **Sentiment shows 5.0 NEUTRAL?** Normal after hours — Yahoo Finance RSS has fewer headlines at night.
- **FinBERT first run takes a long time?** It downloads a ~500MB AI model the first time. After that it's cached and starts instantly.
- **Both terminals must stay open** while using the dashboard. If you close one, the app stops working.

---

## Quick reference — commands you use every time

| What | Terminal | Command |
|------|----------|---------|
| Start backend | Terminal 1 (in backend folder) | `python -m uvicorn api_server:app --reload` |
| Start frontend | Terminal 2 (in root folder) | `npm run dev` |
| Run the bot | Terminal 1 (in backend folder) | `python bot.py` |
| Run backtest | Terminal 1 (in backend folder) | `python backtest.py` |

Then open **http://localhost:3000** in your browser.
