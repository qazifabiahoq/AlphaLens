'use client';

import { useState, useEffect } from 'react';
import { Telescope, RefreshCw, TrendingUp, TrendingDown, Check, X, ChevronDown, TriangleAlert as AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getSignalData, getBacktestData, checkBackendStatus, getAllTickers, SignalData, BacktestData } from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('Dashboard');
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [tickerData, setTickerData] = useState<Record<string, SignalData | null>>({});
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const tabs = ['Dashboard', 'Strategy', 'Backtest', 'How It Works', 'About'];
  const tickers = getAllTickers();

  const loadData = async () => {
    setIsRefreshing(true);
    const status = await checkBackendStatus();
    setIsLive(status);

    const data: Record<string, SignalData | null> = {};
    for (const ticker of tickers) {
      data[ticker] = await getSignalData(ticker);
    }
    setTickerData(data);

    const backtest = await getBacktestData();
    setBacktestData(backtest);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 60 seconds
    const refreshInterval = setInterval(loadData, 60000);

    const updateTime = () => {
      const now = new Date();
      const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const hours = estTime.getHours();
      const minutes = estTime.getMinutes();
      const seconds = estTime.getSeconds();
      const day = estTime.getDay();

      setCurrentTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );

      const isWeekday = day >= 1 && day <= 5;
      const marketHours = hours === 9 ? minutes >= 30 : hours > 9 && hours < 16;
      setIsMarketOpen(isWeekday && marketHours);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => { clearInterval(interval); clearInterval(refreshInterval); };
  }, []);

  const currentData = tickerData[selectedTicker] ?? null;

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10">
        <nav className="fixed top-0 left-0 right-0 h-[52px] bg-[var(--bg-surface)] border-b border-[var(--border)] z-50">
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Telescope className="w-5 h-5 text-[var(--accent)]" />
              <div className="flex flex-col">
                <span className="font-sans font-semibold text-[18px] text-white">AlphaLens</span>
                <span className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">
                  Sentiment Intelligence
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 relative">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 h-[52px] font-sans text-[13px] transition-colors relative whitespace-nowrap ${
                    activeTab === tab ? 'text-white' : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-sans text-[var(--text-secondary)]">NYSE</span>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isMarketOpen ? 'bg-[var(--green)]' : 'bg-[var(--red)]'
                  }`}
                />
                <span className="font-mono text-[var(--text-primary)]">
                  {isMarketOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>

              <span className="font-mono text-[14px] text-[var(--text-primary)]">{currentTime} EST</span>

              <div className="px-3 py-1 bg-[var(--accent-dim)] border border-[var(--accent)] rounded-sm flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-[var(--accent)]" />
                <span className="font-mono text-[11px] text-[var(--accent)] uppercase tracking-wide">PAPER</span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isLive ? 'bg-[var(--green)] animate-pulse-ring' : 'bg-[var(--text-muted)]'
                  }`}
                />
                <span className="font-sans text-[12px] text-[var(--text-secondary)] uppercase tracking-wide">
                  {isLive ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
        </nav>

        <main className="pt-[52px]">
          {activeTab === 'Dashboard' && (
            currentData
              ? <DashboardTab
                  tickers={tickers}
                  tickerData={tickerData}
                  selectedTicker={selectedTicker}
                  currentData={currentData}
                  backtestData={backtestData}
                  onTickerSelect={setSelectedTicker}
                  onRefresh={loadData}
                  isRefreshing={isRefreshing}
                />
              : <OfflineMessage message="Start the backend to load live signals." hint="cd backend && uvicorn main:app --reload" />
          )}
          {activeTab === 'Strategy' && <StrategyTab />}
          {activeTab === 'Backtest' && (
            backtestData
              ? <BacktestTab data={backtestData} isMethodologyOpen={isMethodologyOpen} setIsMethodologyOpen={setIsMethodologyOpen} />
              : <OfflineMessage message="Start the backend and wait for backtest to complete." hint="cd backend && uvicorn main:app --reload" />
          )}
          {activeTab === 'How It Works' && <HowItWorksTab />}
          {activeTab === 'About' && <AboutTab />}
        </main>
      </div>
    </div>
  );
}

function OfflineMessage({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-52px)] gap-4">
      <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
      <p className="font-mono text-[14px] text-[var(--text-secondary)]">{message}</p>
      <code className="font-mono text-[12px] text-[var(--accent)] bg-[var(--bg-elevated)] px-4 py-2 rounded-sm">{hint}</code>
    </div>
  );
}

function DashboardTab({
  tickers,
  tickerData,
  selectedTicker,
  currentData,
  backtestData,
  onTickerSelect,
  onRefresh,
  isRefreshing,
}: {
  tickers: string[];
  tickerData: Record<string, SignalData | null>;
  selectedTicker: string;
  currentData: SignalData;
  backtestData: BacktestData | null;
  onTickerSelect: (ticker: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex">
      <aside className="w-[200px] border-r border-[var(--border)] bg-[var(--bg-surface)] min-h-[calc(100vh-52px)]">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">
              WATCHLIST
            </h2>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-[var(--bg-elevated)] rounded-sm transition-colors disabled:opacity-50"
              title="Refresh prices"
            >
              <RefreshCw className={`w-3 h-3 text-[var(--text-secondary)] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2">
            {tickers.map((ticker) => {
              const data = tickerData[ticker];
              if (!data) return null;

              return (
                <button
                  key={ticker}
                  onClick={() => onTickerSelect(ticker)}
                  className={`w-full p-2 rounded-sm text-left transition-all ${
                    selectedTicker === ticker
                      ? 'bg-[var(--bg-elevated)] border-l-2 border-[var(--accent)]'
                      : 'hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="font-mono text-[14px] font-bold text-white">{ticker}</div>
                      <div className="font-sans text-[11px] text-[var(--text-secondary)]">
                        {data.company_name?.split(' ')[0] || ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[13px] text-white">${data.price.toFixed(2)}</div>
                      <div
                        className={`font-mono text-[11px] ${
                          data.change >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                        }`}
                      >
                        {data.change >= 0 ? '+' : ''}
                        {data.change_percent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <span
                      className={`font-mono text-[9px] px-2 py-0.5 rounded-sm uppercase tracking-wide ${
                        data.signal === 'BUY'
                          ? 'bg-[var(--green)]/20 text-[var(--green)]'
                          : data.signal === 'SELL'
                          ? 'bg-[var(--red)]/20 text-[var(--red)]'
                          : 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      }`}
                    >
                      {data.signal}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="font-sans text-[10px] text-[var(--text-secondary)]">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex">
        <div className="flex-1 p-6">
          <div className="mb-6 pb-4 border-b border-[var(--border)]">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="font-mono text-[28px] font-bold text-white">{currentData.ticker}</h1>
                  <span className="font-sans text-[14px] text-[var(--text-secondary)]">
                    {currentData.company_name}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[32px] text-white">${currentData.price.toFixed(2)}</span>
                <div className="flex items-center gap-1">
                  {currentData.change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[var(--green)]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[var(--red)]" />
                  )}
                  <span
                    className={`font-mono text-[18px] ${
                      currentData.change >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                    }`}
                  >
                    {currentData.change >= 0 ? '+' : ''}
                    {currentData.change.toFixed(2)} ({currentData.change >= 0 ? '+' : ''}
                    {currentData.change_percent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_200px] gap-6 mb-6">
            <div>
              <div className="mb-2">
                <span className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">
                  SENTIMENT SCORE
                </span>
              </div>
              <div className="mb-2">
                <span
                  className={`font-mono text-[72px] font-bold ${
                    currentData.conviction_score >= 7
                      ? 'text-[var(--green)]'
                      : currentData.conviction_score >= 3
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--red)]'
                  }`}
                >
                  {currentData.conviction_score.toFixed(1)}
                </span>
              </div>
              <div className="mb-3">
                <span
                  className={`font-mono text-[13px] uppercase tracking-widest ${
                    currentData.sentiment_label === 'POSITIVE'
                      ? 'text-[var(--green)]'
                      : currentData.sentiment_label === 'NEGATIVE'
                      ? 'text-[var(--red)]'
                      : 'text-[var(--accent)]'
                  }`}
                >
                  {currentData.sentiment_label}
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--border)] rounded-sm overflow-hidden">
                <div
                  className={`h-full ${
                    currentData.conviction_score >= 7
                      ? 'bg-[var(--green)]'
                      : currentData.conviction_score >= 3
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--red)]'
                  }`}
                  style={{ width: `${(currentData.conviction_score / 10) * 100}%` }}
                />
              </div>
            </div>

            <div
              className={`border rounded-sm p-4 ${
                currentData.signal === 'BUY'
                  ? 'bg-[var(--green)]/10 border-[var(--green)]'
                  : currentData.signal === 'SELL'
                  ? 'bg-[var(--red)]/10 border-[var(--red)]'
                  : 'bg-[var(--accent)]/10 border-[var(--accent)]'
              }`}
            >
              <div className="text-center mb-4">
                <span
                  className={`font-mono text-[36px] font-bold ${
                    currentData.signal === 'BUY'
                      ? 'text-[var(--green)]'
                      : currentData.signal === 'SELL'
                      ? 'text-[var(--red)]'
                      : 'text-[var(--accent)]'
                  }`}
                >
                  {currentData.signal}
                </span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    ok: currentData.trend_ok,
                    label: `Uptrend: price above 50-day MA ($${currentData.ma50?.toFixed(2)})`,
                  },
                  {
                    ok: currentData.rsi_ok,
                    label: `RSI ${currentData.rsi?.toFixed(1)} in range 30–70 (not overbought)`,
                  },
                  {
                    ok: currentData.volume_ok,
                    label: `Volume ${currentData.volume_ratio?.toFixed(1)}× 20-day avg (real demand)`,
                  },
                  {
                    ok: currentData.conviction_score >= 7,
                    label: `AI conviction ${currentData.conviction_score?.toFixed(1)}/10 ≥ 7.0`,
                  },
                ].map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    {ok ? (
                      <Check className="w-4 h-4 text-[var(--green)]" />
                    ) : (
                      <X className="w-4 h-4 text-[var(--red)]" />
                    )}
                    <span className="font-sans text-[11px] text-[var(--text-primary)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-3">
            {[
              { label: '50-DAY MA', value: `$${currentData.ma50.toFixed(2)}` },
              { label: 'CURRENT PRICE', value: `$${currentData.price.toFixed(2)}` },
              { label: 'DAY RANGE', value: `$${currentData.day_low.toFixed(2)} – $${currentData.day_high.toFixed(2)}` },
              { label: 'VOLUME', value: currentData.volume },
            ].map((metric) => (
              <div key={metric.label} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-3">
                <div className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">{metric.label}</div>
                <div className="font-mono text-[13px] text-white">{metric.value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'RSI (14)', value: currentData.rsi != null ? currentData.rsi.toFixed(1) : 'N/A' },
              { label: 'ATR (14)', value: currentData.atr != null ? `$${currentData.atr.toFixed(2)}` : 'N/A' },
              { label: 'STOP LOSS', value: currentData.stop_loss != null ? `$${currentData.stop_loss.toFixed(2)}` : 'N/A' },
              { label: 'TAKE PROFIT', value: currentData.take_profit != null ? `$${currentData.take_profit.toFixed(2)}` : 'N/A' },
            ].map((metric) => (
              <div key={metric.label} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-3">
                <div className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">{metric.label}</div>
                <div className="font-mono text-[13px] text-white">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="border border-[var(--border)] rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--bg-elevated)]">
                  {['OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOL'].map((header) => (
                    <th
                      key={header}
                      className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-wide px-4 py-2 text-left"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono text-[13px] text-white px-4 py-2">${currentData.open.toFixed(2)}</td>
                  <td className="font-mono text-[13px] text-white px-4 py-2">${currentData.day_high.toFixed(2)}</td>
                  <td className="font-mono text-[13px] text-white px-4 py-2">${currentData.day_low.toFixed(2)}</td>
                  <td className="font-mono text-[13px] text-white px-4 py-2">${currentData.price.toFixed(2)}</td>
                  <td className="font-mono text-[13px] text-white px-4 py-2">{currentData.volume}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {currentData.reason && (
            <div className={`mt-6 rounded-sm border p-4 ${
              currentData.signal === 'BUY'
                ? 'border-[var(--green)]/40 bg-[var(--green)]/5'
                : currentData.signal === 'SELL'
                ? 'border-[var(--red)]/40 bg-[var(--red)]/5'
                : 'border-[var(--accent)]/40 bg-[var(--accent)]/5'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${
                  currentData.signal === 'BUY' ? 'text-[var(--green)]'
                  : currentData.signal === 'SELL' ? 'text-[var(--red)]'
                  : 'text-[var(--accent)]'
                }`}>FinBERT Analysis</span>
                <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-wide">
                  — why {currentData.signal}?
                </span>
              </div>
              <p className="font-sans text-[12px] text-[var(--text-primary)] leading-relaxed">
                {currentData.reason}
              </p>
            </div>
          )}
        </div>

        <aside className="w-[340px] border-l border-[var(--border)] bg-[var(--bg-surface)] min-h-[calc(100vh-52px)] p-4">
          <div className="mb-4">
            <h2 className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-widest mb-1">
              HEADLINES
            </h2>
            <span className="font-mono text-[12px] text-[var(--accent)]">{currentData.ticker}</span>
          </div>

          <div className="space-y-3">
            {currentData.headlines.map((headline, idx) => (
              <div
                key={idx}
                className="py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer rounded-sm px-2"
              >
                <h3 className="font-sans text-[13px] text-[var(--text-primary)] mb-2 leading-tight">
                  {headline.title}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-[11px] text-[var(--text-secondary)]">{headline.source}</span>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="font-sans text-[11px] text-[var(--text-secondary)]">{headline.time_ago}</span>
                  <span
                    className={`font-mono text-[9px] px-2 py-0.5 rounded-sm uppercase ${
                      headline.sentiment === 'POSITIVE'
                        ? 'bg-[var(--green)]/20 text-[var(--green)]'
                        : headline.sentiment === 'NEGATIVE'
                        ? 'bg-[var(--red)]/20 text-[var(--red)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {headline.sentiment}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="font-sans text-[10px] text-[var(--text-muted)]">Powered by Yahoo Finance RSS</p>
          </div>
        </aside>
      </div>

      {backtestData && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="grid grid-cols-[70%_30%]">
            <div className="p-6 border-r border-[var(--border)]">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-sans text-[12px] text-[var(--text-primary)] uppercase tracking-wide">
                    STRATEGY PERFORMANCE
                  </h2>
                  <span className="font-sans text-[11px] text-[var(--text-secondary)]">12-Month Backtest</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={backtestData.equity_curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
                  />
                  <YAxis
                    stroke="var(--text-secondary)"
                    tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-bright)',
                      borderRadius: '2px',
                      fontFamily: 'IBM Plex Mono',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(0)}`, '']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="alphalens"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    name="AlphaLens"
                  />
                  <Line
                    type="monotone"
                    dataKey="spy"
                    stroke="#334155"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name="SPY"
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="flex items-center gap-6 mt-3 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-[var(--accent)]" />
                  <span className="font-sans text-[11px] text-[var(--text-secondary)]">AlphaLens</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-[#334155]" style={{ backgroundImage: 'linear-gradient(to right, #334155 50%, transparent 50%)', backgroundSize: '8px 1px' }} />
                  <span className="font-sans text-[11px] text-[var(--text-secondary)]">SPY</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <h3 className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                BACKTEST METRICS
              </h3>

              <div className="space-y-3">
                {[
                  { label: 'Total Return', value: `+${backtestData.metrics.total_return.toFixed(1)}%`, color: 'text-[var(--green)]' },
                  { label: 'vs S&P 500', value: `+${backtestData.metrics.vs_spy.toFixed(1)}%`, color: 'text-[var(--green)]' },
                  { label: 'Sharpe Ratio', value: backtestData.metrics.sharpe_ratio.toFixed(2), color: 'text-white' },
                  { label: 'Max Drawdown', value: `${backtestData.metrics.max_drawdown.toFixed(1)}%`, color: 'text-[var(--red)]' },
                  { label: 'Win Rate', value: `${backtestData.metrics.win_rate.toFixed(1)}%`, color: 'text-white' },
                  { label: 'Total Trades', value: backtestData.metrics.total_trades.toString(), color: 'text-white' },
                ].map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                    <span className="font-sans text-[11px] text-[var(--text-secondary)]">{metric.label}</span>
                    <span className={`font-mono text-[14px] ${metric.color}`}>{metric.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StrategyTab() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-12">
        <div className="mb-3">
          <span className="font-sans text-[11px] text-[var(--accent)] uppercase tracking-widest">SIGNAL LOGIC</span>
        </div>
        <h2 className="font-sans text-[24px] font-semibold text-white mb-2">
          How AlphaLens Generates Trading Decisions
        </h2>
        <p className="font-sans text-[14px] text-[var(--text-secondary)] mb-8">
          All 4 entry conditions must pass simultaneously. Any single failure produces a HOLD. This prevents the bot from acting on partial signals, the most common cause of systematic trading losses.
        </p>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">CONDITION 1: TREND</span>
            </div>
            <h3 className="font-sans text-[16px] font-semibold text-white mb-3">Price Above 50-Day MA</h3>
            <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed mb-3">
              The 50-day moving average is called the institutional line. When price is above it, the majority of investors who bought in the last 50 days are sitting on profit; they have no reason to panic-sell, and momentum is on your side. Buying below the 50MA means fighting the trend. Every professional trader checks this first.
            </p>
            <p className="font-sans text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
              Why not the 200-day? The 200MA is a long-term signal, too slow for a news-driven strategy. The 50MA responds to trend shifts in weeks, not months, which matches our 5-minute polling cycle.
            </p>
            <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm p-3">
              price {'>'} MA(50) = True
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
            <div className="mb-3">
              <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">CONDITION 2: MOMENTUM</span>
            </div>
            <h3 className="font-sans text-[16px] font-semibold text-white mb-3">RSI Between 30 and 70</h3>
            <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed mb-3">
              RSI (Relative Strength Index) measures how fast a stock is moving relative to itself. Above 70 means the stock has already run hard; you would be buying at the top, paying someone else's profit. Below 30 means the stock is still falling and no one knows where it stops (catching a falling knife). The 30-70 band is the healthy zone: the stock has real momentum but has not overextended.
            </p>
            <p className="font-sans text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
              Without RSI, a trend-following bot will buy stocks that already surged 15% on news, right before they pull back. RSI prevents chasing.
            </p>
            <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm p-3">
              30 {'<='} RSI(14) {'<='} 70 = True
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
            <div className="mb-3">
              <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">CONDITION 3: VOLUME</span>
            </div>
            <h3 className="font-sans text-[16px] font-semibold text-white mb-3">Volume ≥ 1.1× 20-Day Average</h3>
            <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed mb-3">
              Price moves on low volume are unreliable. If a stock rises 2% but only a handful of trades happened, the move can reverse the moment one large seller appears. When volume is above its 20-day average, it means real market participation: institutions, funds, and retail traders are all involved. That price move will hold.
            </p>
            <p className="font-sans text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
              Volume is the market's conviction score. High volume on an up day = real demand. High volume on a down day = real selling pressure. We only enter when the buying side has the evidence.
            </p>
            <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm p-3">
              volume / avg_volume(20) {'>'}{'>'}= 1.1 = True
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
            <div className="mb-3">
              <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">CONDITION 4: AI SENTIMENT</span>
            </div>
            <h3 className="font-sans text-[16px] font-semibold text-white mb-3">FinBERT Conviction ≥ 7.0 / 10</h3>
            <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed mb-3">
              This is the AI layer. FinBERT reads financial news the same way a research analyst would, understanding context and nuance, not just keywords. "Apple misses estimates" and "Apple beats estimates" share most of the same words, but FinBERT classifies them correctly. A score of 7.0+ means strongly positive signals across multiple headlines, not just one.
            </p>
            <p className="font-sans text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
              Why 7.0 and not 5.0? A score of 5 means the AI is uncertain, close to neutral. We need the AI to be confident, not just slightly positive. The 7.0 threshold filters noise and focuses on stories with real market impact.
            </p>
            <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm p-3">
              finbert_conviction {'>'}{'>'}= 7.0 = True
            </div>
          </div>
        </div>

        <div className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 rounded-sm p-4 text-center">
          <p className="font-mono text-[13px] text-[var(--accent)]">
            BUY = trend ∧ rsi_ok ∧ volume_ok ∧ sentiment_ok
          </p>
          <p className="font-sans text-[12px] text-[var(--text-secondary)] mt-1">
            All four must be True simultaneously. One failure = HOLD, regardless of how strong the others are.
          </p>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-sans text-[20px] font-semibold text-white mb-2">EXIT CONDITIONS</h2>
        <p className="font-sans text-[13px] text-[var(--text-secondary)] mb-6">
          Positions are monitored continuously. Any single exit condition closes the trade immediately. No waiting.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            {
              label: 'Trend Break',
              trigger: 'Price < MA50',
              desc: 'The primary trend has reversed. The institutional support that justified the entry is gone. Staying in a downtrend is the most common mistake retail traders make.',
            },
            {
              label: 'Overbought Exit',
              trigger: 'RSI > 75',
              desc: 'The stock has moved too far, too fast. RSI above 75 is where professional traders begin taking profits. We exit before the inevitable pullback.',
            },
            {
              label: 'Sentiment Collapse',
              trigger: 'Conviction < 3.0',
              desc: 'The AI detects a shift to negative news coverage mid-position. News-driven positions must be exited when the news turns. This is the entire premise of the system.',
            },
          ].map((item) => (
            <div key={item.label} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-4">
              <div className="font-sans text-[11px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">{item.label}</div>
              <div className="font-mono text-[13px] font-bold text-[var(--red)] mb-2">{item.trigger}</div>
              <p className="font-sans text-[12px] text-[var(--text-primary)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-sans text-[20px] font-semibold text-white mb-2">RISK MANAGEMENT: ATR-BASED</h2>
        <p className="font-sans text-[13px] text-[var(--text-secondary)] mb-6">
          Stop-loss and take-profit are calculated from ATR (Average True Range), not fixed percentages. ATR measures how much a stock typically moves in a single day. TSLA moves ~$8/day. MSFT moves ~$3/day. A 2% fixed stop treats them identically, which is wrong. ATR-based levels respect each stock's own volatility personality.
        </p>

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Stop-Loss',
              value: '1.5 × ATR',
              desc: 'Entry price minus 1.5× the 14-day ATR. Gives the stock room to breathe through normal intraday noise without triggering on a routine fluctuation.',
            },
            {
              label: 'Take-Profit',
              value: '3.0 × ATR',
              desc: 'Entry price plus 3x the ATR. This creates a 2:1 reward-to-risk ratio on every trade, a professional standard. Win half your trades and still come out ahead.',
            },
            {
              label: 'Conviction Floor',
              value: '3.0 / 10',
              desc: 'If FinBERT conviction drops below 3 mid-position, the thesis for holding is gone. Sentiment-based entries require sentiment-based exits.',
            },
          ].map((item) => (
            <div key={item.label} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-4">
              <div className="font-sans text-[11px] text-[var(--text-secondary)] uppercase tracking-wide mb-2">{item.label}</div>
              <div className="font-mono text-[20px] font-bold text-[var(--accent)] mb-2">{item.value}</div>
              <p className="font-sans text-[12px] text-[var(--text-primary)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-sans text-[20px] font-semibold text-white mb-6">
          WHAT FINBERT UNDERSTANDS THAT RULES CANNOT
        </h2>

        <div className="grid grid-cols-[1fr_400px] gap-8">
          <div className="font-sans text-[14px] text-[var(--text-primary)] leading-relaxed space-y-4">
            <p>
              Financial news contains context that simple keyword rules miss entirely. The headline "Apple beats
              estimates by a wide margin" and "Apple misses estimates by a wide margin" share most of the same words.
              FinBERT, trained on over 10,000 financial documents including earnings call transcripts and analyst
              reports, captures the semantic difference.
            </p>
            <p>
              AlphaLens uses FinBERT exclusively for text interpretation. All numerical computations, moving averages,
              percentage calculations, and order sizing are handled in Python without any LLM involvement.
            </p>
          </div>

          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--bg-elevated)]">
                  <th className="font-sans text-[10px] text-[var(--text-secondary)] uppercase px-3 py-2 text-left">
                    Headline
                  </th>
                  <th className="font-sans text-[10px] text-[var(--text-secondary)] uppercase px-3 py-2 text-left">
                    Keyword
                  </th>
                  <th className="font-sans text-[10px] text-[var(--text-secondary)] uppercase px-3 py-2 text-left">
                    FinBERT
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-white">Beats estimates</td>
                  <td className="px-3 py-2 text-[var(--green)]">POSITIVE</td>
                  <td className="px-3 py-2 text-[var(--green)]">POSITIVE (0.91)</td>
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-white">Misses estimates</td>
                  <td className="px-3 py-2 text-[var(--red)]">NEGATIVE</td>
                  <td className="px-3 py-2 text-[var(--red)]">NEGATIVE (0.87)</td>
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-white">In line with expectations</td>
                  <td className="px-3 py-2 text-[var(--green)]">POSITIVE (false)</td>
                  <td className="px-3 py-2 text-[var(--accent)]">NEUTRAL (0.78)</td>
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-white">Mixed results with strong services</td>
                  <td className="px-3 py-2 text-[var(--red)]">NEGATIVE (false)</td>
                  <td className="px-3 py-2 text-[var(--green)]">POSITIVE (0.65)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-sans text-[20px] font-semibold text-white mb-6">GUARDRAILS</h2>

        <div className="space-y-3">
          {[
            'Does not feed price numbers or financial data into the language model',
            'Does not act on a single headline regardless of its sentiment score',
            'Does not override programmatic stop-loss rules based on LLM output',
            'Does not hold more than one open position per ticker simultaneously',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <X className="w-5 h-5 text-[var(--red)] flex-shrink-0 mt-0.5" />
              <span className="font-sans text-[14px] text-[var(--text-primary)]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BacktestTab({ data, isMethodologyOpen, setIsMethodologyOpen }: { data: BacktestData; isMethodologyOpen: boolean; setIsMethodologyOpen: (open: boolean) => void }) {
  return (
    <div className="px-6 py-12">
      <div className="max-w-6xl mx-auto mb-8">
        <h1 className="font-sans text-[32px] font-bold text-white mb-2">12-MONTH STRATEGY VALIDATION</h1>
        <p className="font-mono text-[14px] text-[var(--text-secondary)]">
          {data.equity_curve[0]?.date} to {data.equity_curve[data.equity_curve.length - 1]?.date}
        </p>
      </div>

      <div className="max-w-6xl mx-auto mb-8">
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data.equity_curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: '2px',
                  fontFamily: 'IBM Plex Mono',
                  fontSize: '11px',
                }}
                formatter={(value: number) => [`$${value.toFixed(0)}`, '']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Line type="monotone" dataKey="alphalens" stroke="var(--accent)" strokeWidth={2} dot={false} name="AlphaLens" />
              <Line
                type="monotone"
                dataKey="spy"
                stroke="#334155"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="SPY"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-8">
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-elevated)]">
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-6 py-3 text-left">
                  Metric
                </th>
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-6 py-3 text-right">
                  AlphaLens
                </th>
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-6 py-3 text-right">
                  SPY Buy and Hold
                </th>
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-6 py-3 text-right">
                  Edge
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Total Return</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+{data.metrics.total_return.toFixed(1)}%</td>
                <td className="px-6 py-3 text-right text-white">+{data.metrics.spy_return.toFixed(1)}%</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+{data.metrics.vs_spy.toFixed(1)}%</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Annualized Return</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+{data.metrics.annualized_return.toFixed(1)}%</td>
                <td className="px-6 py-3 text-right text-white">+{(data.metrics.spy_return * 1.05).toFixed(1)}%</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+{(data.metrics.annualized_return - data.metrics.spy_return * 1.05).toFixed(1)}%</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Sharpe Ratio</td>
                <td className="px-6 py-3 text-right text-white">{data.metrics.sharpe_ratio.toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-white">0.71</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+{(data.metrics.sharpe_ratio - 0.71).toFixed(2)}</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Sortino Ratio</td>
                <td className="px-6 py-3 text-right text-white">{data.metrics.sortino_ratio.toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-white">0.98</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+{(data.metrics.sortino_ratio - 0.98).toFixed(2)}</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Max Drawdown</td>
                <td className="px-6 py-3 text-right text-[var(--red)]">{data.metrics.max_drawdown.toFixed(1)}%</td>
                <td className="px-6 py-3 text-right text-white">-10.4%</td>
                <td className="px-6 py-3 text-right text-[var(--green)]">+2.2%</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Win Rate</td>
                <td className="px-6 py-3 text-right text-white">{data.metrics.win_rate.toFixed(1)}%</td>
                <td className="px-6 py-3 text-right text-[var(--text-secondary)]">N/A</td>
                <td className="px-6 py-3 text-right text-[var(--text-secondary)]">N/A</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Total Trades</td>
                <td className="px-6 py-3 text-right text-white">{data.metrics.total_trades}</td>
                <td className="px-6 py-3 text-right text-white">1</td>
                <td className="px-6 py-3 text-right text-[var(--text-secondary)]">N/A</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-6 py-3 text-white">Avg Hold Time</td>
                <td className="px-6 py-3 text-right text-white">{data.metrics.avg_hold_time.toFixed(1)} days</td>
                <td className="px-6 py-3 text-right text-[var(--text-secondary)]">N/A</td>
                <td className="px-6 py-3 text-right text-[var(--text-secondary)]">N/A</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-8">
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm overflow-hidden">
          <button
            onClick={() => setIsMethodologyOpen(!isMethodologyOpen)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <span className="font-sans text-[14px] font-semibold text-white">METHODOLOGY</span>
            <ChevronDown
              className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${
                isMethodologyOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isMethodologyOpen && (
            <div className="px-6 py-4 border-t border-[var(--border)] font-sans text-[14px] text-[var(--text-primary)] leading-relaxed space-y-3">
              <p>
                Historical OHLCV data sourced from Yahoo Finance via yfinance library
              </p>
              <p>
                Sentiment proxy in backtest uses 5-day price momentum normalized to 0-10 scale (real FinBERT requires
                live news which is unavailable historically without paid APIs)
              </p>
              <p>
                Look-ahead bias prevention: all signals computed using only data at time T with no future information
              </p>
              <p>Equal-weight portfolio rebalanced across AAPL, MSFT, TSLA, NVDA</p>
              <p>
                Transaction costs not modeled (real performance would be slightly lower)
              </p>
              <p>Benchmark: SPY ETF total return over identical period</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="border-l-2 border-[var(--accent)] bg-[var(--bg-surface)] rounded-sm p-6">
          <div className="mb-4">
            <span className="font-sans text-[11px] text-[var(--accent)] uppercase tracking-widest">
              KNOWN LIMITATIONS
            </span>
          </div>

          <div className="space-y-3">
            {[
              'The backtest sentiment signal is a momentum proxy. Live mode uses real FinBERT inference on actual headlines, which will produce different signal timing.',
              'The 4-stock portfolio is highly correlated. A broad market downturn would affect all positions simultaneously.',
              'Past backtest results do not predict future performance. Live paper trading results will differ.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <span className="font-sans text-[14px] text-[var(--text-primary)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorksTab() {
  const techStack = [
    { name: 'Python 3.11', desc: 'Core runtime and data processing' },
    { name: 'FastAPI', desc: 'Backend API serving signals to frontend' },
    { name: 'ProsusAI FinBERT', desc: 'Financial sentiment classification model' },
    { name: 'HuggingFace Transformers', desc: 'Local model inference, no API costs' },
    { name: 'Paper Simulation', desc: 'Trade logging to trades.json with stop-loss & take-profit' },
    { name: 'yfinance', desc: 'Free historical OHLCV data' },
    { name: 'pandas + NumPy', desc: 'Time-series computation and normalization' },
    { name: 'Next.js 14', desc: 'Frontend application framework' },
    { name: 'Tailwind CSS', desc: 'Utility-first styling' },
    { name: 'Recharts', desc: 'Chart components' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-16">
        <h2 className="font-sans text-[24px] font-bold text-white mb-8">THE PIPELINE</h2>

        <div className="flex items-center gap-4">
          {[
            {
              title: 'NEWS INGESTION',
              desc: 'Yahoo Finance RSS pulls headlines for each ticker on a 5-minute polling cycle. Headlines are deduplicated and stored in a rolling 24-hour window.',
            },
            {
              title: 'LLM ANALYSIS',
              desc: 'Each headline is passed individually to ProsusAI/FinBERT running locally via HuggingFace Transformers. The model returns probability scores across three classes: positive, neutral, negative.',
            },
            {
              title: 'CONVICTION SCORING',
              desc: 'Probabilities are aggregated across all headlines in the 24-hour window. A conviction score from 0 to 10 is computed using the dominant class probability minus a neutral dampening penalty.',
            },
            {
              title: 'SIGNAL GENERATION',
              desc: 'Four conditions are evaluated: (1) price above 50-day MA, (2) RSI between 30–70, (3) volume ≥ 1.1× 20-day average, (4) FinBERT conviction ≥ 7.0. All four must pass simultaneously. Any failure = HOLD.',
            },
            {
              title: 'EXECUTION',
              desc: 'BUY signals trigger a paper trade with ATR-based stop-loss (1.5× ATR below entry) and take-profit (3× ATR above entry). Position size is risk-adjusted: 1% of portfolio ÷ stop distance. All trades logged to trades.json.',
            },
          ].map((step, idx) => (
            <div key={idx} className="flex items-stretch flex-1">
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-4 flex-1">
                <div className="mb-2">
                  <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">
                    STEP {idx + 1}
                  </span>
                </div>
                <h3 className="font-sans text-[12px] font-bold text-white mb-2">{step.title}</h3>
                <p className="font-sans text-[11px] text-[var(--text-primary)] leading-relaxed">{step.desc}</p>
              </div>
              {idx < 4 && (
                <div className="flex items-center px-2">
                  <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-[var(--accent)]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <h2 className="font-sans text-[24px] font-bold text-white mb-2">THE RULE-BASED ENGINE</h2>
        <p className="font-sans text-[14px] text-[var(--text-secondary)] mb-8">
          Every trade decision passes through four deterministic filters. These are hard gates written in Python. If any gate returns False, the signal is HOLD regardless of how strong the others are.
        </p>

        <div className="space-y-4">
          {[
            {
              rule: '50-Day Moving Average',
              gate: 'price > MA(50)',
              why: 'The MA50 is the most widely watched trend line by professional and institutional traders. When price is above it, the crowd is on your side: the last 50 days of buyers are in profit and not panic-selling. Buying below the MA means betting against the prevailing trend, which statistically loses more often than it wins. This is the first question any experienced trader asks: "Is this stock in an uptrend?"',
              tag: 'TREND FILTER',
            },
            {
              rule: 'RSI Between 30 and 70',
              gate: '30 ≤ RSI(14) ≤ 70',
              why: 'RSI tells you how fast and how far a stock has moved relative to its own history. Above 70 means the stock is overbought; it has already had its run and you are buying at the peak right before a pullback. Below 30 means oversold; the stock is still falling and there is no floor yet. The 30-70 zone is where stocks have healthy upward momentum without being stretched. This single rule prevents the most common retail trading mistake: chasing a stock after it already moved.',
              tag: 'MOMENTUM FILTER',
            },
            {
              rule: 'Volume ≥ 1.1× 20-Day Average',
              gate: 'volume / avg_vol(20) ≥ 1.1',
              why: 'Price without volume is a rumor. Volume is the market\'s vote of confidence. When more shares than usual are trading on an up day, it means real buyers (institutions, funds, large accounts) are participating. A stock that moves 2% on half its normal volume can reverse the moment one big seller appears. A stock that moves on 1.5x volume is being accumulated. Volume confirms the move is real, not a thin-market illusion.',
              tag: 'CONFIRMATION FILTER',
            },
            {
              rule: 'FinBERT Conviction ≥ 7.0',
              gate: 'finbert_score ≥ 7.0 / 10',
              why: 'This is the AI edge. FinBERT is trained on financial documents and understands sentiment the way a research analyst does. It knows "Apple misses estimates" is bad even though "misses" is just one word. A score of 7.0+ means the model found strongly positive signals across multiple recent headlines, not just a single ambiguous story. Scores of 5-6 are too noisy; the market has already priced in neutral news. We need the AI to be confident, not just slightly optimistic.',
              tag: 'AI SENTIMENT FILTER',
            },
          ].map((item) => (
            <div key={item.rule} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <span className="font-mono text-[9px] text-[var(--accent)] uppercase tracking-widest">{item.tag}</span>
                  <h3 className="font-sans text-[15px] font-semibold text-white mt-0.5">{item.rule}</h3>
                </div>
                <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm px-3 py-1.5 shrink-0">
                  {item.gate}
                </div>
              </div>
              <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed">{item.why}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 border border-[var(--accent)]/20 bg-[var(--accent)]/5 rounded-sm p-5">
          <div className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest mb-2">WHY ALL 4 TOGETHER?</div>
          <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed">
            Each rule alone is insufficient. MA50 tells you the trend but not whether the stock is overextended. RSI tells you momentum but not the direction. Volume tells you participation but not the news context. FinBERT tells you the news story but not the price action. Together, they create a multi-dimensional filter that requires the trend, the momentum, the market participation, and the news sentiment to all align before committing capital. This is how professional systematic traders reduce false signals.
          </p>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="font-sans text-[24px] font-bold text-white mb-6">TECH STACK</h2>

        <div className="grid grid-cols-3 gap-4">
          {techStack.map((tech) => (
            <div key={tech.name} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-4">
              <div className="font-mono text-[13px] font-semibold text-white mb-1">{tech.name}</div>
              <div className="font-sans text-[12px] text-[var(--text-secondary)]">{tech.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <h2 className="font-sans text-[24px] font-bold text-white mb-6">SYSTEM ARCHITECTURE</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {['Yahoo Finance RSS', 'NewsFetcher', 'MarketDataHandler'].map((box, idx) => (
              <div key={box} className="flex items-center flex-1">
                <div className="border border-[var(--border-bright)] bg-[var(--bg-surface)] rounded-sm px-4 py-3 flex-1 text-center">
                  <span className="font-mono text-[10px] text-white">{box}</span>
                </div>
                {idx < 2 && (
                  <div className="px-2">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-[var(--accent)]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[var(--accent)]" />
          </div>

          <div className="flex items-center gap-4">
            {[
              { label: 'SentimentAgent / FinBERT', sub: 'AI Brain' },
              { label: 'Rule Engine', sub: 'MA50 + RSI + Volume' },
              { label: 'Signal Generator', sub: 'BUY / HOLD / SELL' },
              { label: 'Execution + ATR Risk', sub: 'SL / TP / Sizing' },
            ].map((box, idx) => (
              <div key={box.label} className="flex items-center flex-1">
                <div className="border border-[var(--border-bright)] bg-[var(--bg-surface)] rounded-sm px-4 py-3 flex-1 text-center">
                  <span className="font-mono text-[10px] text-white block">{box.label}</span>
                  <span className="font-sans text-[9px] text-[var(--text-secondary)] block mt-0.5">{box.sub}</span>
                </div>
                {idx < 3 && (
                  <div className="px-2">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-[var(--accent)]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-sans text-[24px] font-bold text-white mb-6">API REFERENCE</h2>

        <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-elevated)]">
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-4 py-3 text-left">
                  Endpoint
                </th>
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-4 py-3 text-left">
                  Method
                </th>
                <th className="font-sans text-[11px] text-[var(--text-secondary)] uppercase px-4 py-3 text-left">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-[12px]">
              <tr className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--accent)]">/api/signal/{'{ticker}'}</td>
                <td className="px-4 py-3 text-[var(--green)]">GET</td>
                <td className="px-4 py-3 text-[var(--text-primary)]">
                  Returns signal data for a specific ticker
                </td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--accent)]">/api/backtest</td>
                <td className="px-4 py-3 text-[var(--green)]">GET</td>
                <td className="px-4 py-3 text-[var(--text-primary)]">Returns backtest equity curve and metrics</td>
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--accent)]">/api/positions</td>
                <td className="px-4 py-3 text-[var(--green)]">GET</td>
                <td className="px-4 py-3 text-[var(--text-primary)]">Returns currently open positions</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-16">
        <h2 className="font-sans text-[28px] font-bold text-white mb-6">ABOUT ALPHALENS</h2>

        <div className="font-sans text-[15px] text-[var(--text-primary)] leading-relaxed space-y-4">
          <p>
            AlphaLens is a systematic trading research platform combining transformer-based natural language processing
            with classical technical analysis. The core thesis is that public news sentiment is a measurable,
            processable signal that precedes price movement in liquid equities when combined with trend confirmation.
          </p>
          <p>
            Every decision AlphaLens makes is fully explainable. Each signal shows the exact conditions that triggered
            it, the individual headline scores that contributed to the conviction reading, and the specific technical
            state at time of signal generation. Black-box trading systems hide failure modes. AlphaLens surfaces them.
          </p>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="font-sans text-[28px] font-bold text-white mb-8">THE TEAM</h2>

        <p className="font-sans text-[15px] text-[var(--text-primary)] leading-relaxed">
          Dedan Deus, Emily Bendeck Garay, Esha Malhi, Noelia Cornejo, Qazi Fabia Hoq
        </p>
      </div>

      <div className="mb-16">
        <h2 className="font-sans text-[28px] font-bold text-white mb-6">BUILT FOR</h2>

        <p className="font-sans text-[15px] text-[var(--text-primary)] leading-relaxed">
          AlphaLens was developed for Business Applications of AI at the Schulich School of Business, MMai program, York University.
        </p>
      </div>

      <div>
        <div className="border border-[var(--text-muted)] bg-[var(--bg-surface)] rounded-sm p-6">
          <div className="mb-3">
            <span className="font-sans text-[11px] text-[var(--text-muted)] uppercase tracking-widest">
              DISCLAIMER
            </span>
          </div>
          <p className="font-sans text-[13px] text-[var(--text-secondary)] leading-relaxed">
            AlphaLens operates exclusively in paper trading simulation mode. No real capital is deployed or at risk.
            This platform exists for research and educational purposes. Nothing on this platform constitutes financial
            advice, investment recommendations, or an offer to buy or sell any security. Past backtest performance does
            not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  );
}
