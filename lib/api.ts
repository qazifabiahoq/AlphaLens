export interface SignalData {
  ticker: string;
  company_name: string;
  price: number;
  change: number;
  change_percent: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  sentiment_label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  conviction_score: number;
  // Rule-based indicators
  trend_ok: boolean;
  ma50: number;
  rsi: number;
  rsi_ok: boolean;
  atr: number;
  stop_loss: number;
  take_profit: number;
  volume_ratio: number;
  volume_ok: boolean;
  // OHLCV
  volume: string;
  day_high: number;
  day_low: number;
  open: number;
  headlines: Headline[];
  guardrail_warnings: string[];
}

export interface Headline {
  title: string;
  source: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  time_ago: string;
}

export interface BacktestData {
  equity_curve: EquityPoint[];
  metrics: BacktestMetrics;
}

export interface EquityPoint {
  date: string;
  alphalens: number;
  spy: number;
}

export interface BacktestMetrics {
  total_return: number;
  vs_spy: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  avg_hold_time: number;
  annualized_return: number;
  spy_return: number;
}

export interface Position {
  ticker: string;
  entry_price: number;
  current_price: number;
  quantity: number;
  pnl: number;
  pnl_percent: number;
}

const TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA'];

let isLive = false;

function getApiUrl(): string | null {
  return process.env.NEXT_PUBLIC_API_URL || null;
}

export async function checkBackendStatus(): Promise<boolean> {
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) { isLive = false; return false; }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 2000);
    const response   = await fetch(`${apiUrl}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    isLive = response.ok;
    return response.ok;
  } catch {
    isLive = false;
    return false;
  }
}

export async function getSignalData(ticker: string): Promise<SignalData | null> {
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) return null;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);
    const response   = await fetch(`${apiUrl}/api/signal/${ticker}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    isLive = true;
    return await response.json() as SignalData;
  } catch {
    isLive = false;
    return null;
  }
}

export async function getBacktestData(): Promise<BacktestData | null> {
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) return null;

    const controller = new AbortController();
    // Backtest runs FinBERT + vectorbt — allow up to 2 minutes on first run
    const timeoutId  = setTimeout(() => controller.abort(), 120000);
    const response   = await fetch(`${apiUrl}/api/backtest`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    isLive = true;
    return await response.json() as BacktestData;
  } catch {
    isLive = false;
    return null;
  }
}

export async function getPositions(): Promise<Position[]> {
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) return [];

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 3000);
    const response   = await fetch(`${apiUrl}/api/positions`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return [];

    isLive = true;
    const data = await response.json();
    return data.positions ?? [];
  } catch {
    isLive = false;
    return [];
  }
}

export function getConnectionStatus(): boolean {
  return isLive;
}

export function getAllTickers(): string[] {
  return TICKERS;
}
