'use client';

import { useState, useEffect } from 'react';
import { Telescope, RefreshCw, TrendingUp, TrendingDown, Check, X, ChevronDown, TriangleAlert as AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getSignalData, getBacktestData, checkBackendStatus, getAllTickers, SignalData, BacktestData } from '@/lib/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('Dashboard');
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [tickerData, setTickerData] = useState<Record<string, SignalData>>({});
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(false);
  const [isMethodologyOpen, setIsMethodologyOpen] = useState<boolean>(true);

  const tabs = ['Dashboard', 'Strategy', 'Backtest', 'How It Works', 'About'];
  const tickers = getAllTickers();

  useEffect(() => {
    const loadData = async () => {
      const status = await checkBackendStatus();
      setIsLive(status);

      const data: Record<string, SignalData> = {};
      for (const ticker of tickers) {
        data[ticker] = await getSignalData(ticker);
      }
      setTickerData(data);

      const backtest = await getBacktestData();
      setBacktestData(backtest);
    };

    loadData();

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

    return () => clearInterval(interval);
  }, []);

  const currentData = tickerData[selectedTicker];

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
                  {isLive ? 'LIVE' : 'DEMO'}
                </span>
              </div>
            </div>
          </div>
        </nav>

        <main className="pt-[52px]">
          {activeTab === 'Dashboard' && currentData && (
            <DashboardTab
              tickers={tickers}
              tickerData={tickerData}
              selectedTicker={selectedTicker}
              currentData={currentData}
              backtestData={backtestData}
              onTickerSelect={setSelectedTicker}
            />
          )}
          {activeTab === 'Strategy' && <StrategyTab />}
          {activeTab === 'Backtest' && backtestData && (
            <BacktestTab data={backtestData} isMethodologyOpen={isMethodologyOpen} setIsMethodologyOpen={setIsMethodologyOpen} />
          )}
          {activeTab === 'How It Works' && <HowItWorksTab />}
          {activeTab === 'About' && <AboutTab />}
        </main>
      </div>
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
}: {
  tickers: string[];
  tickerData: Record<string, SignalData>;
  selectedTicker: string;
  currentData: SignalData;
  backtestData: BacktestData | null;
  onTickerSelect: (ticker: string) => void;
}) {
  return (
    <div className="flex">
      <aside className="w-[200px] border-r border-[var(--border)] bg-[var(--bg-surface)] min-h-[calc(100vh-52px)]">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">
              WATCHLIST
            </h2>
            <button className="p-1 hover:bg-[var(--bg-elevated)] rounded-sm transition-colors">
              <RefreshCw className="w-3 h-3 text-[var(--text-secondary)]" />
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
                <div className="flex items-center gap-2">
                  {currentData.trend_ok ? (
                    <Check className="w-4 h-4 text-[var(--green)]" />
                  ) : (
                    <X className="w-4 h-4 text-[var(--red)]" />
                  )}
                  <span className="font-sans text-[11px] text-[var(--text-primary)]">
                    Price above 50-day MA
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {currentData.conviction_score >= 7 ? (
                    <Check className="w-4 h-4 text-[var(--green)]" />
                  ) : (
                    <X className="w-4 h-4 text-[var(--red)]" />
                  )}
                  <span className="font-sans text-[11px] text-[var(--text-primary)]">
                    Conviction above 7.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: '50-DAY MA', value: `$${currentData.ma50.toFixed(2)}` },
              { label: 'CURRENT PRICE', value: `$${currentData.price.toFixed(2)}` },
              {
                label: 'DAY RANGE',
                value: `$${currentData.day_low.toFixed(2)} - $${currentData.day_high.toFixed(2)}`,
              },
              { label: 'VOLUME', value: currentData.volume },
            ].map((metric) => (
              <div key={metric.label} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-3">
                <div className="font-sans text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                  {metric.label}
                </div>
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
            <p className="font-sans text-[10px] text-[var(--text-muted)]">Powered by Alpaca News API</p>
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
        <h2 className="font-sans text-[24px] font-semibold text-white mb-8">
          How AlphaLens Generates Trading Decisions
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
            <div className="mb-3">
              <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">
                CONDITION 1 OF 2
              </span>
            </div>
            <h3 className="font-sans text-[18px] font-semibold text-white mb-4">Technical Filter</h3>
            <p className="font-sans text-[14px] text-[var(--text-primary)] leading-relaxed mb-4">
              The stock price must be trading above its 50-day simple moving average. This confirms the underlying
              trend is upward before any position is opened. Momentum without sentiment is noise. AlphaLens requires
              the trend first.
            </p>
            <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm p-3">
              price &gt; MA50 = True
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-6">
            <div className="mb-3">
              <span className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-wide">
                CONDITION 2 OF 2
              </span>
            </div>
            <h3 className="font-sans text-[18px] font-semibold text-white mb-4">Sentiment Filter</h3>
            <p className="font-sans text-[14px] text-[var(--text-primary)] leading-relaxed mb-4">
              FinBERT analyzes all news headlines published in the last 24 hours for the target ticker. The average
              conviction score across all headlines must exceed 7.0 out of 10. A single strong headline is not
              sufficient.
            </p>
            <div className="font-mono text-[12px] text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border)] rounded-sm p-3">
              conviction_score &gt;= 7.0 = True
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="font-sans text-[14px] text-[var(--accent)]">
            Both conditions must return True. Either condition failing produces a HOLD signal.
          </p>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="font-sans text-[20px] font-semibold text-white mb-6">RISK FRAMEWORK</h2>

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Stop-Loss',
              value: '-2.00%',
              desc: 'Automatic sell if price drops 2% below entry. No exceptions.',
            },
            {
              label: 'Take-Profit',
              value: '+5.00%',
              desc: 'Position closes at 5% gain to lock returns systematically.',
            },
            {
              label: 'Conviction Floor',
              value: '3.0/10',
              desc: 'Mid-position sentiment collapse triggers exit review.',
            },
          ].map((item) => (
            <div key={item.label} className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-sm p-4">
              <div className="font-sans text-[11px] text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                {item.label}
              </div>
              <div className="font-mono text-[24px] font-bold text-[var(--accent)] mb-2">{item.value}</div>
              <p className="font-sans text-[13px] text-[var(--text-primary)] leading-relaxed">{item.desc}</p>
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
    { name: 'Alpaca Trade API', desc: 'Paper trading order execution' },
    { name: 'yfinance', desc: 'Free historical OHLCV data' },
    { name: 'pandas + NumPy', desc: 'Time-series computation and normalization' },
    { name: 'Next.js 14', desc: 'Frontend application framework' },
    { name: 'Tailwind CSS', desc: 'Utility-first styling' },
    { name: 'Recharts', desc: 'Chart components' },
    { name: 'Render', desc: 'Python backend hosting' },
    { name: 'Vercel', desc: 'Frontend deployment' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-16">
        <h2 className="font-sans text-[24px] font-bold text-white mb-8">THE PIPELINE</h2>

        <div className="flex items-center gap-4">
          {[
            {
              title: 'NEWS INGESTION',
              desc: 'Alpaca News API and Yahoo Finance RSS pull headlines for each ticker on a 5-minute polling cycle. Headlines are deduplicated and stored in a rolling 24-hour window.',
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
              desc: 'The conviction score is combined with a 50-day moving average check. Both conditions must pass. If either fails, the signal is HOLD regardless of individual strength.',
            },
            {
              title: 'EXECUTION',
              desc: 'Qualifying BUY signals submit market orders via the Alpaca Paper Trading API. Each order is immediately bracketed with a 2% stop-loss and 5% take-profit order.',
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
            {['Alpaca News API', 'Yahoo Finance RSS', 'MarketDataHandler'].map((box, idx) => (
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
            {['SentimentAgent / FinBERT', 'Signal Generator', 'Execution Engine', 'Alpaca Paper Trading'].map(
              (box, idx) => (
                <div key={box} className="flex items-center flex-1">
                  <div className="border border-[var(--border-bright)] bg-[var(--bg-surface)] rounded-sm px-4 py-3 flex-1 text-center">
                    <span className="font-mono text-[10px] text-white">{box}</span>
                  </div>
                  {idx < 3 && (
                    <div className="px-2">
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-[var(--accent)]" />
                    </div>
                  )}
                </div>
              )
            )}
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
