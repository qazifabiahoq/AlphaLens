export interface SignalData {
  ticker: string;
  company_name: string;
  price: number;
  change: number;
  change_percent: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  sentiment_label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  conviction_score: number;
  trend_ok: boolean;
  ma50: number;
  volume: string;
  day_high: number;
  day_low: number;
  open: number;
  headlines: Headline[];
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

const MOCK_DATA: Record<string, SignalData> = {
  AAPL: {
    ticker: 'AAPL',
    company_name: 'Apple Inc.',
    price: 213.50,
    change: 3.85,
    change_percent: 1.84,
    signal: 'BUY',
    sentiment_label: 'POSITIVE',
    conviction_score: 8.2,
    trend_ok: true,
    ma50: 195.20,
    volume: '54.2M',
    day_high: 214.30,
    day_low: 208.90,
    open: 209.80,
    headlines: [
      {
        title: 'Apple Vision Pro developer interest surges as enterprise use cases expand beyond consumer',
        source: 'Bloomberg',
        sentiment: 'POSITIVE',
        time_ago: '1h ago'
      },
      {
        title: 'iPhone 16 cycle demand tracking ahead of prior year in Asia Pacific channel checks',
        source: 'Barron\'s',
        sentiment: 'POSITIVE',
        time_ago: '3h ago'
      },
      {
        title: 'Apple Services revenue seen reaching 30 percent of total revenue by fiscal 2026',
        source: 'Reuters',
        sentiment: 'POSITIVE',
        time_ago: '5h ago'
      },
      {
        title: 'App Store regulatory pressure in EU may weigh on services margin trajectory',
        source: 'MarketWatch',
        sentiment: 'NEUTRAL',
        time_ago: '8h ago'
      },
      {
        title: 'Berkshire Hathaway maintains Apple as largest portfolio holding through Q1',
        source: 'CNBC',
        sentiment: 'POSITIVE',
        time_ago: '12h ago'
      }
    ]
  },
  MSFT: {
    ticker: 'MSFT',
    company_name: 'Microsoft Corporation',
    price: 415.80,
    change: 1.70,
    change_percent: 0.41,
    signal: 'HOLD',
    sentiment_label: 'NEUTRAL',
    conviction_score: 6.1,
    trend_ok: true,
    ma50: 398.50,
    volume: '21.8M',
    day_high: 417.60,
    day_low: 413.10,
    open: 414.20,
    headlines: [
      {
        title: 'Azure growth rate stabilizes at 29 percent as enterprise AI workloads normalize post-adoption spike',
        source: 'Bloomberg',
        sentiment: 'NEUTRAL',
        time_ago: '2h ago'
      },
      {
        title: 'Microsoft 365 Copilot seat count reaches 400,000 paying enterprise customers',
        source: 'Reuters',
        sentiment: 'POSITIVE',
        time_ago: '4h ago'
      },
      {
        title: 'Antitrust scrutiny of Microsoft Activision integration intensifying in European markets',
        source: 'Financial Times',
        sentiment: 'NEUTRAL',
        time_ago: '7h ago'
      },
      {
        title: 'OpenAI partnership faces renegotiation questions as alternative model providers gain traction',
        source: 'MarketWatch',
        sentiment: 'NEUTRAL',
        time_ago: '9h ago'
      },
      {
        title: 'Azure capacity expansion capex guidance raised for second consecutive quarter',
        source: 'Barron\'s',
        sentiment: 'POSITIVE',
        time_ago: '14h ago'
      }
    ]
  },
  TSLA: {
    ticker: 'TSLA',
    company_name: 'Tesla, Inc.',
    price: 248.90,
    change: 7.68,
    change_percent: 3.18,
    signal: 'BUY',
    sentiment_label: 'POSITIVE',
    conviction_score: 7.8,
    trend_ok: true,
    ma50: 231.40,
    volume: '112.6M',
    day_high: 251.20,
    day_low: 239.80,
    open: 241.30,
    headlines: [
      {
        title: 'Tesla Cybertruck production reaches 1,000 units per week at Gigafactory Texas',
        source: 'Reuters',
        sentiment: 'POSITIVE',
        time_ago: '30m ago'
      },
      {
        title: 'Full Self-Driving v13 rollout to North American fleet begins with supervised mode',
        source: 'CNBC',
        sentiment: 'POSITIVE',
        time_ago: '2h ago'
      },
      {
        title: 'Tesla energy storage deployments hit record 9.4 GWh in latest quarter',
        source: 'Bloomberg',
        sentiment: 'POSITIVE',
        time_ago: '5h ago'
      },
      {
        title: 'European market share pressure from BYD and Volkswagen EV lineup continues in Q1',
        source: 'Financial Times',
        sentiment: 'NEGATIVE',
        time_ago: '9h ago'
      },
      {
        title: 'Elon Musk compensation package appeal ruling expected from Delaware court within 60 days',
        source: 'MarketWatch',
        sentiment: 'NEUTRAL',
        time_ago: '11h ago'
      }
    ]
  },
  NVDA: {
    ticker: 'NVDA',
    company_name: 'NVIDIA Corporation',
    price: 875.20,
    change: -7.85,
    change_percent: -0.89,
    signal: 'HOLD',
    sentiment_label: 'NEUTRAL',
    conviction_score: 4.3,
    trend_ok: true,
    ma50: 820.10,
    volume: '38.9M',
    day_high: 886.20,
    day_low: 871.40,
    open: 882.50,
    headlines: [
      {
        title: 'Blackwell GPU shipment delays due to thermal design revisions push some deliveries to Q3',
        source: 'Bloomberg',
        sentiment: 'NEGATIVE',
        time_ago: '1h ago'
      },
      {
        title: 'NVIDIA data center revenue consensus estimate revised upward by 14 analysts post Jensen remarks',
        source: 'Barron\'s',
        sentiment: 'POSITIVE',
        time_ago: '3h ago'
      },
      {
        title: 'US export control expansion under consideration for H20 chips to additional markets',
        source: 'Reuters',
        sentiment: 'NEGATIVE',
        time_ago: '6h ago'
      },
      {
        title: 'Sovereign AI spending from Middle East governments emerging as new NVIDIA demand driver',
        source: 'CNBC',
        sentiment: 'POSITIVE',
        time_ago: '8h ago'
      },
      {
        title: 'AMD MI300X gaining share in inference workloads as cost-per-token advantage widens',
        source: 'MarketWatch',
        sentiment: 'NEUTRAL',
        time_ago: '13h ago'
      }
    ]
  }
};

const generateEquityCurve = (): EquityPoint[] => {
  const points: EquityPoint[] = [];
  const startDate = new Date('2025-03-13');
  startDate.setFullYear(startDate.getFullYear() - 1);

  let alphalensValue = 10000;
  let spyValue = 10000;

  for (let i = 0; i < 252; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const alphalensChange = (Math.random() - 0.45) * 150;
    const spyChange = (Math.random() - 0.48) * 80;

    alphalensValue += alphalensChange;
    spyValue += spyChange;

    points.push({
      date: date.toISOString().split('T')[0],
      alphalens: Math.round(alphalensValue),
      spy: Math.round(spyValue)
    });
  }

  return points;
};

const MOCK_BACKTEST: BacktestData = {
  equity_curve: generateEquityCurve(),
  metrics: {
    total_return: 23.4,
    vs_spy: 15.3,
    sharpe_ratio: 1.47,
    sortino_ratio: 2.14,
    max_drawdown: -8.2,
    win_rate: 62.4,
    total_trades: 47,
    avg_hold_time: 4.2,
    annualized_return: 24.8,
    spy_return: 8.1
  }
};

let isLive = false;

export async function checkBackendStatus(): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      isLive = false;
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${apiUrl}/api/signal/AAPL`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    isLive = response.ok;
    return response.ok;
  } catch {
    isLive = false;
    return false;
  }
}

export async function getSignalData(ticker: string): Promise<SignalData> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return MOCK_DATA[ticker] || MOCK_DATA.AAPL;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${apiUrl}/api/signal/${ticker}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return MOCK_DATA[ticker] || MOCK_DATA.AAPL;
    }

    const data = await response.json();
    isLive = true;
    return { ...(MOCK_DATA[ticker] || MOCK_DATA.AAPL), ...data };
  } catch {
    isLive = false;
    return MOCK_DATA[ticker] || MOCK_DATA.AAPL;
  }
}

export async function getBacktestData(): Promise<BacktestData> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return MOCK_BACKTEST;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${apiUrl}/api/backtest`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return MOCK_BACKTEST;
    }

    const data = await response.json();
    isLive = true;
    return {
      equity_curve: data.equity_curve ?? MOCK_BACKTEST.equity_curve,
      metrics: { ...MOCK_BACKTEST.metrics, ...data.metrics },
    };
  } catch {
    isLive = false;
    return MOCK_BACKTEST;
  }
}

export async function getPositions(): Promise<Position[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${apiUrl}/api/positions`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    isLive = true;
    return data;
  } catch {
    isLive = false;
    return [];
  }
}

export function getConnectionStatus(): boolean {
  return isLive;
}

export function getAllTickers(): string[] {
  return Object.keys(MOCK_DATA);
}
