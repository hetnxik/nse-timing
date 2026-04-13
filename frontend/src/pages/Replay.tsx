import { useState, useCallback } from "react";
import { apiClient, ReplayResult, ReplayStrategyParams } from "../api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from "recharts";

const STOCKS_LIST = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN",
  "BAJFINANCE", "KOTAKBANK", "LT", "WIPRO", "TITAN", "AXISBANK", "ASIANPAINT",
  "MARUTI", "NESTLEIND", "ULTRACEMCO", "POWERGRID", "NTPC", "SUNPHARMA",
  "DRREDDY", "DIVISLAB", "CIPLA", "TECHM", "HCLTECH", "INDUSINDBK", "M&M",
  "TATAMOTORS", "ONGC", "BPCL"
];

interface ChartPoint {
  date: string;
  price: number;
  portfolio: number;
  score: number;
  action: string | null;
  position: boolean;
}

interface StockPerformance {
  ticker: string;
  total_trades: number;
  win_rate: number | null;
  total_return_pct: number;
  final_value: number;
}

interface AllStocksReplay {
  summary: {
    stocks_simulated: number;
    stocks_failed: number;
    portfolio_per_stock: number;
    total_initial_capital: number;
    total_final_value: number;
    overall_return_pct: number;
    total_trades: number;
    closed_trades: number;
    avg_return_per_stock: number | null;
  };
  all_trades: Array<{
    entry_date: string;
    exit_date: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
    exit_reason: string;
    ticker: string;
  }>;
  per_stock: StockPerformance[];
  top_performers: StockPerformance[];
  bottom_performers: StockPerformance[];
  failed: Array<{ ticker: string; error: string }>;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${color ?? "text-slate-900 dark:text-slate-100"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Default MDC strategy parameters
const DEFAULT_STRATEGY: ReplayStrategyParams = {
  entry_score: 65,
  entry_rsi_min: 25,
  entry_rsi_max: 55,
  entry_momentum_min: 5,
  entry_high_ratio_min: 0.65,
  entry_pct_b_max: 0.55,
  require_bull_regime: true,
  exit_score_threshold: 35,
  exit_max_days: 126,
  stop_atr_mult: 2.0,
  reentry_cooldown_days: 5,
  // Win rate filter defaults
  win_rate_filter_enabled: false,
  win_rate_min_trades: 5,
  win_rate_threshold: 40,
  win_rate_penalty_score: 75,
  // Circuit breaker defaults
  circuit_breaker_enabled: false,
  circuit_breaker_consecutive_stops: 2,
  circuit_breaker_pause_days: 30,
};

export function Replay() {
  const [mode, setMode] = useState<"single" | "all">("all");
  const [ticker, setTicker] = useState("RELIANCE.NS");
  const [portfolioSize, setPortfolioSize] = useState("1000000");
  const [riskPct, setRiskPct] = useState("1");
  const [showStrategy, setShowStrategy] = useState(false);
  const [strategy, setStrategy] = useState<ReplayStrategyParams>(DEFAULT_STRATEGY);
  const [loading, setLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<ReplayResult | null>(null);
  const [allResult, setAllResult] = useState<AllStocksReplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  const runReplay = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSingleResult(null);
    setAllResult(null);
    setSelectedStock(null);
    try {
      if (mode === "single") {
        const data = await apiClient.getReplay(
          ticker,
          parseFloat(portfolioSize),
          parseFloat(riskPct) / 100,
          strategy
        );
        setSingleResult(data);
      } else {
        const data = await apiClient.getReplayAll(
          parseFloat(portfolioSize),
          parseFloat(riskPct) / 100,
          strategy
        );
        setAllResult(data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setLoading(false);
    }
  }, [mode, ticker, portfolioSize, riskPct, strategy]);

  // Transform timeline for chart (single stock mode)
  const chartData: ChartPoint[] = singleResult?.timeline.map((t) => ({
    date: t.date,
    price: t.price,
    portfolio: t.portfolio_value,
    score: t.score,
    action: t.action,
    position: !!t.position,
  })) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Strategy Replay (2-Year Simulation)</h1>
      <p className="text-sm text-slate-500">
        Walk through 2 years of historical data day-by-day. Simulate on a single stock or the full NSE universe.
      </p>

      {/* Controls */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-slate-50 dark:bg-slate-800/50">
        {/* Mode Selection */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "single"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
            }`}
          >
            Single Stock
          </button>
          <button
            onClick={() => setMode("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "all"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
            }`}
          >
            All 100 Stocks
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {mode === "single" && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Stock</label>
              <select
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              >
                {STOCKS_LIST.map((s) => (
                  <option key={s} value={`${s}.NS`}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Portfolio per Stock (₹)</label>
            <input
              type="number"
              value={portfolioSize}
              onChange={(e) => setPortfolioSize(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Risk per Trade (%)</label>
            <input
              type="number"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runReplay}
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors ${
                loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Simulating…" : mode === "all" ? "Run All Stocks Replay" : "Run 2Y Replay"}
            </button>
          </div>
        </div>
        {mode === "all" && (
          <p className="text-xs text-slate-400 mt-2">
            Simulates ₹{parseInt(portfolioSize).toLocaleString()} on each of 100 stocks. Total capital: ₹{(parseInt(portfolioSize) * 100).toLocaleString()}
          </p>
        )}
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        {/* Strategy Parameters Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setShowStrategy(!showStrategy)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600"
          >
            <span>{showStrategy ? "▼" : "▶"}</span>
            Strategy Parameters
            {!showStrategy && (
              <span className="text-xs text-slate-400 font-normal">
                (Score ≥{strategy.entry_score}, RSI {strategy.entry_rsi_min}-{strategy.entry_rsi_max}, Cooldown: {strategy.reentry_cooldown_days}d)
              </span>
            )}
          </button>

          {showStrategy && (
            <div className="mt-3 space-y-4">
              {/* Entry Conditions */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Entry Conditions</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Min Score</label>
                    <input
                      type="number"
                      value={strategy.entry_score}
                      onChange={(e) => setStrategy(s => ({ ...s, entry_score: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">RSI Min</label>
                    <input
                      type="number"
                      value={strategy.entry_rsi_min}
                      onChange={(e) => setStrategy(s => ({ ...s, entry_rsi_min: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">RSI Max</label>
                    <input
                      type="number"
                      value={strategy.entry_rsi_max}
                      onChange={(e) => setStrategy(s => ({ ...s, entry_rsi_max: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Min Momentum %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={strategy.entry_momentum_min}
                      onChange={(e) => setStrategy(s => ({ ...s, entry_momentum_min: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Min 52W Ratio</label>
                    <input
                      type="number"
                      step="0.01"
                      value={strategy.entry_high_ratio_min}
                      onChange={(e) => setStrategy(s => ({ ...s, entry_high_ratio_min: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Max %B</label>
                    <input
                      type="number"
                      step="0.01"
                      value={strategy.entry_pct_b_max}
                      onChange={(e) => setStrategy(s => ({ ...s, entry_pct_b_max: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={strategy.require_bull_regime}
                    onChange={(e) => setStrategy(s => ({ ...s, require_bull_regime: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <span className="text-slate-600 dark:text-slate-400">Require Bull Regime (price above 200-DMA)</span>
                </label>
              </div>

              {/* Exit Conditions */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Exit Conditions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Score Exit Threshold</label>
                    <input
                      type="number"
                      value={strategy.exit_score_threshold}
                      onChange={(e) => setStrategy(s => ({ ...s, exit_score_threshold: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Max Hold Days</label>
                    <input
                      type="number"
                      value={strategy.exit_max_days}
                      onChange={(e) => setStrategy(s => ({ ...s, exit_max_days: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Stop Loss (ATR ×)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={strategy.stop_atr_mult}
                      onChange={(e) => setStrategy(s => ({ ...s, stop_atr_mult: parseFloat(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Re-entry Cooldown (days)</label>
                    <input
                      type="number"
                      value={strategy.reentry_cooldown_days}
                      onChange={(e) => setStrategy(s => ({ ...s, reentry_cooldown_days: parseInt(e.target.value) || 0 }))}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                    />
                    <p className="text-xs text-slate-400 mt-1">No entry for N days after stop loss</p>
                  </div>
                </div>
              </div>

              {/* Advanced Filters */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Advanced Filters (Per-Stock State Tracking)</h4>

                {/* Win Rate Filter */}
                <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={strategy.win_rate_filter_enabled}
                      onChange={(e) => setStrategy(s => ({ ...s, win_rate_filter_enabled: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm font-medium">Win Rate Filter</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">Block or penalize stocks with poor historical win rates</p>
                  {strategy.win_rate_filter_enabled && (
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Min Trades for History</label>
                        <input
                          type="number"
                          value={strategy.win_rate_min_trades}
                          onChange={(e) => setStrategy(s => ({ ...s, win_rate_min_trades: parseInt(e.target.value) || 0 }))}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Min Win Rate %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={strategy.win_rate_threshold}
                          onChange={(e) => setStrategy(s => ({ ...s, win_rate_threshold: parseFloat(e.target.value) || 0 }))}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Penalty Entry Score</label>
                        <input
                          type="number"
                          value={strategy.win_rate_penalty_score}
                          onChange={(e) => setStrategy(s => ({ ...s, win_rate_penalty_score: parseInt(e.target.value) || 0 }))}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Circuit Breaker */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={strategy.circuit_breaker_enabled}
                      onChange={(e) => setStrategy(s => ({ ...s, circuit_breaker_enabled: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm font-medium">Consecutive Stop Circuit Breaker</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">Pause trading after N consecutive stop losses on same stock</p>
                  {strategy.circuit_breaker_enabled && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Consecutive Stops to Trigger</label>
                        <input
                          type="number"
                          value={strategy.circuit_breaker_consecutive_stops}
                          onChange={(e) => setStrategy(s => ({ ...s, circuit_breaker_consecutive_stops: parseInt(e.target.value) || 0 }))}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Pause Duration (days)</label>
                        <input
                          type="number"
                          value={strategy.circuit_breaker_pause_days}
                          onChange={(e) => setStrategy(s => ({ ...s, circuit_breaker_pause_days: parseInt(e.target.value) || 0 }))}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Presets */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStrategy(DEFAULT_STRATEGY)}
                  className="text-xs px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Reset to MDC Optimal
                </button>
                <button
                  onClick={() => setStrategy({ ...DEFAULT_STRATEGY, entry_score: 55, entry_rsi_min: 20, entry_rsi_max: 65 })}
                  className="text-xs px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Preset: Relaxed
                </button>
                <button
                  onClick={() => setStrategy({ ...DEFAULT_STRATEGY, entry_score: 75, entry_momentum_min: 10 })}
                  className="text-xs px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Preset: Aggressive
                </button>
                <button
                  onClick={() => setStrategy({ ...DEFAULT_STRATEGY, win_rate_filter_enabled: true, circuit_breaker_enabled: true })}
                  className="text-xs px-3 py-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
                >
                  Preset: Filters On
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single Stock Results */}
      {singleResult && mode === "single" && (
        <SingleStockResults result={singleResult} chartData={chartData} strategy={strategy} />
      )}

      {/* All Stocks Results */}
      {allResult && mode === "all" && (
        <AllStocksResults
          result={allResult}
          onSelectStock={setSelectedStock}
          selectedStock={selectedStock}
          strategy={strategy}
        />
      )}
    </div>
  );
}

function SingleStockResults({ result, chartData, strategy }: { result: ReplayResult; chartData: ChartPoint[]; strategy: ReplayStrategyParams }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Trades"
          value={String(result.stats.total_trades)}
          sub={`${result.stats.closed_trades} closed`}
        />
        <StatCard
          label="Win Rate"
          value={result.stats.win_rate != null ? `${result.stats.win_rate.toFixed(0)}%` : "—"}
          color={result.stats.win_rate != null && result.stats.win_rate >= 50 ? "text-green-600" : "text-red-500"}
        />
        <StatCard
          label="Total Return"
          value={`${result.stats.total_return_pct >= 0 ? "+" : ""}${result.stats.total_return_pct.toFixed(1)}%`}
          sub={`₹${result.stats.final_value.toLocaleString()}`}
          color={result.stats.total_return_pct >= 0 ? "text-green-600" : "text-red-500"}
        />
        <StatCard
          label="Avg Return/Trade"
          value={result.stats.avg_return != null ? `${result.stats.avg_return >= 0 ? "+" : ""}${result.stats.avg_return.toFixed(1)}%` : "—"}
        />
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Price vs Portfolio Value</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d) => d.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const p = payload[0].payload as ChartPoint;
                    return (
                      <div className="bg-white dark:bg-slate-900 p-2 border rounded text-xs">
                        <p className="font-semibold">{p.date}</p>
                        <p>Price: ₹{p.price.toFixed(2)}</p>
                        <p>Portfolio: ₹{p.portfolio.toLocaleString()}</p>
                        <p>Score: {p.score.toFixed(0)}</p>
                        {p.action && <p className="text-blue-600 font-semibold">Action: {p.action}</p>}
                        {p.position && <p className="text-green-600">In Position</p>}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="price"
                  name="Stock Price"
                  stroke="#64748b"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Composite Score Over Time</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d) => d.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const p = payload[0].payload as ChartPoint;
                    return (
                      <div className="bg-white dark:bg-slate-900 p-2 border rounded text-xs">
                        <p className="font-semibold">{p.date}</p>
                        <p>Score: {p.score.toFixed(0)}</p>
                        {p.action && <p className="text-blue-600 font-semibold">Action: {p.action}</p>}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={65} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Entry (65)", fontSize: 10 }} />
                <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Exit (35)", fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Score"
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Export for LLM */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Export for LLM Analysis</h3>
          <button
            onClick={() => {
              const exportData = {
                simulation_config: {
                  ticker: result.ticker,
                  portfolio_size: "₹10,00,000",
                  risk_per_trade: "1%",
                  period: "2 years",
                },
                mdc_strategy_thresholds: {
                  min_score: strategy.entry_score,
                  rsi_range: `${strategy.entry_rsi_min}-${strategy.entry_rsi_max}`,
                  min_momentum: `${strategy.entry_momentum_min}%`,
                  min_52w_ratio: strategy.entry_high_ratio_min,
                  max_pct_b: strategy.entry_pct_b_max,
                  require_bull_regime: strategy.require_bull_regime,
                  exit_score_threshold: strategy.exit_score_threshold,
                  exit_max_days: strategy.exit_max_days,
                  stop_atr_mult: strategy.stop_atr_mult,
                  reentry_cooldown_days: strategy.reentry_cooldown_days,
                  exit_conditions: [`stop_loss (${strategy.stop_atr_mult}x ATR)`, "target (upper BB)", `regime_change (score<${strategy.exit_score_threshold} + below 200-DMA)`, `time_stop (${strategy.exit_max_days} days)`, `reentry_cooldown (${strategy.reentry_cooldown_days} days after stop)`],
                  advanced_filters: {
                    win_rate_filter: strategy.win_rate_filter_enabled ? {
                      min_trades_for_history: strategy.win_rate_min_trades,
                      min_win_rate_pct: strategy.win_rate_threshold,
                      penalty_entry_score: strategy.win_rate_penalty_score,
                    } : "disabled",
                    circuit_breaker: strategy.circuit_breaker_enabled ? {
                      consecutive_stops_trigger: strategy.circuit_breaker_consecutive_stops,
                      pause_duration_days: strategy.circuit_breaker_pause_days,
                    } : "disabled",
                  },
                },
                results_summary: {
                  total_trades: result.stats.total_trades,
                  win_rate: `${result.stats.win_rate?.toFixed(1) ?? "N/A"}%`,
                  total_return: `${result.stats.total_return_pct >= 0 ? "+" : ""}${result.stats.total_return_pct.toFixed(2)}%`,
                  final_value: `₹${result.stats.final_value.toLocaleString()}`,
                  avg_return_per_trade: result.stats.avg_return != null ? `${result.stats.avg_return >= 0 ? "+" : ""}${result.stats.avg_return.toFixed(2)}%` : "N/A",
                  best_trade: result.stats.best_trade != null ? `+${result.stats.best_trade.toFixed(2)}%` : "N/A",
                  worst_trade: result.stats.worst_trade != null ? `${result.stats.worst_trade.toFixed(2)}%` : "N/A",
                },
                all_trades: result.trades.map((t) => ({
                  entry: t.entry_date,
                  exit: t.exit_date,
                  return_pct: `${t.pnl_pct >= 0 ? "+" : ""}${t.pnl_pct.toFixed(2)}%`,
                  exit_reason: t.exit_reason.replace("exit_", ""),
                })),
              };
              const prompt = `Below is the MDC strategy backtest results for ${result.ticker} over 2 years.

ANALYZE THESE RESULTS AND SUGGEST PARAMETER OPTIMIZATIONS:

Key areas to investigate:
1. What's the win rate? Are there patterns in winning vs losing trades?
2. Is 65 the optimal entry score threshold for this stock?
3. Do RSI bounds (25-55) filter out good opportunities or bad ones?
4. Which exit condition triggers most often? Should targets/stops be adjusted?
5. How does momentum correlate with trade outcomes?
6. Any seasonal patterns or drawdown periods?

Provide 3-5 concrete parameter adjustments with reasoning.

--- DATA BELOW ---\n\n${JSON.stringify(exportData, null, 2)}`;
              navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-xs px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1.5"
          >
            {copied ? (
              <span className="text-green-600">✓ Copied!</span>
            ) : (
              <span>📋 Copy with Prompt</span>
            )}
          </button>
        </div>
        <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded overflow-x-auto max-h-48">
{`{
  "simulation_config": {
    "ticker": "${result.ticker}",
    "portfolio_size": "₹10,00,000",
    "risk_per_trade": "1%",
    "period": "2 years"
  },
  "mdc_strategy_thresholds": {
    "min_score": 65,
    "rsi_range": "25-55",
    "min_momentum": "5%",
    "min_52w_ratio": 0.65,
    "max_pct_b": 0.55
  },
  "results_summary": {
    "total_trades": ${result.stats.total_trades},
    "win_rate": "${result.stats.win_rate?.toFixed(1) ?? "N/A"}%",
    "total_return": "${result.stats.total_return_pct >= 0 ? "+" : ""}${result.stats.total_return_pct.toFixed(2)}%",
    "avg_return_per_trade": "${result.stats.avg_return != null ? `${result.stats.avg_return >= 0 ? "+" : ""}${result.stats.avg_return.toFixed(2)}%` : "N/A"}",
    "best_trade": "${result.stats.best_trade != null ? `+${result.stats.best_trade.toFixed(2)}%` : "N/A"}",
    "worst_trade": "${result.stats.worst_trade != null ? `${result.stats.worst_trade.toFixed(2)}%` : "N/A"}"
  },
  "sample_trades": [${result.trades.slice(0, 3).map((t) => `
    {"entry": "${t.entry_date}", "exit": "${t.exit_date}", "return": "${t.pnl_pct >= 0 ? "+" : ""}${t.pnl_pct.toFixed(1)}%", "reason": "${t.exit_reason.replace("exit_", "")}"}`).join(",")}${result.trades.length > 3 ? `,\n    ... (${result.trades.length - 3} more trades)` : ""}
  ]
}`}
        </pre>
        <p className="text-xs text-slate-400 mt-2">
          Includes a pre-written prompt + JSON data. Just paste into your LLM.
        </p>
      </div>

      {/* Trades Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Simulated Trades</h3>
        {result.trades.length === 0 ? (
          <p className="text-sm text-slate-400">No trades were triggered in the 2-year period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Entry Date</th>
                  <th className="pb-2 pr-4">Exit Date</th>
                  <th className="pb-2 pr-4 text-right">Entry ₹</th>
                  <th className="pb-2 pr-4 text-right">Exit ₹</th>
                  <th className="pb-2 pr-4 text-right">Return</th>
                  <th className="pb-2">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.trades.map((trade, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 pr-4 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-4">{trade.entry_date}</td>
                    <td className="py-2 pr-4">{trade.exit_date}</td>
                    <td className="py-2 pr-4 text-right font-mono">₹{trade.entry_price.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right font-mono">₹{trade.exit_price.toFixed(2)}</td>
                    <td className={`py-2 pr-4 text-right font-mono font-semibold ${trade.pnl_pct >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {trade.pnl_pct >= 0 ? "+" : ""}{trade.pnl_pct.toFixed(1)}%
                    </td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                        {trade.exit_reason.replace("exit_", "")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function AllStocksResults({
  result,
  onSelectStock,
  selectedStock,
  strategy,
}: {
  result: AllStocksReplay;
  onSelectStock: (ticker: string) => void;
  selectedStock: string | null;
  strategy: ReplayStrategyParams;
}) {
  const { summary } = result;
  const [copied, setCopied] = useState(false);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Stocks Simulated"
          value={`${summary.stocks_simulated}/100`}
          sub={summary.stocks_failed > 0 ? `${summary.stocks_failed} failed` : "All successful"}
        />
        <StatCard
          label="Total Trades"
          value={String(summary.total_trades)}
          sub={`${summary.closed_trades} closed`}
        />
        <StatCard
          label="Overall Return"
          value={`${summary.overall_return_pct >= 0 ? "+" : ""}${summary.overall_return_pct.toFixed(1)}%`}
          sub={`₹${(summary.total_final_value / 100000).toFixed(1)}L / ₹${(summary.total_initial_capital / 100000).toFixed(1)}L`}
          color={summary.overall_return_pct >= 0 ? "text-green-600" : "text-red-500"}
        />
        <StatCard
          label="Avg Return/Stock"
          value={summary.avg_return_per_stock != null ? `${summary.avg_return_per_stock >= 0 ? "+" : ""}${summary.avg_return_per_stock.toFixed(1)}%` : "—"}
        />
      </div>

      {/* Top/Bottom Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="font-semibold mb-3 text-green-600">Top 10 Performers</h3>
          <div className="space-y-2">
            {result.top_performers.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => onSelectStock(stock.ticker)}
                className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                  selectedStock === stock.ticker
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-300"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-sm">{stock.ticker}</span>
                <div className="text-right">
                  <span className="text-green-600 font-mono font-semibold">+{stock.total_return_pct.toFixed(1)}%</span>
                  <span className="text-xs text-slate-400 ml-2">({stock.total_trades} trades)</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="font-semibold mb-3 text-red-500">Bottom 10 Performers</h3>
          <div className="space-y-2">
            {result.bottom_performers.map((stock) => (
              <button
                key={stock.ticker}
                onClick={() => onSelectStock(stock.ticker)}
                className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors ${
                  selectedStock === stock.ticker
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-300"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <span className="font-mono text-sm">{stock.ticker}</span>
                <div className="text-right">
                  <span className="text-red-500 font-mono font-semibold">{stock.total_return_pct.toFixed(1)}%</span>
                  <span className="text-xs text-slate-400 ml-2">({stock.total_trades} trades)</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Export for LLM */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Export for LLM Analysis</h3>
          <button
            onClick={() => {
              const exportData = {
                simulation_config: {
                  mode: "all_stocks",
                  stocks_simulated: summary.stocks_simulated,
                  portfolio_per_stock: `₹${summary.portfolio_per_stock.toLocaleString()}`,
                  total_capital: `₹${(summary.total_initial_capital / 100000).toFixed(1)}L`,
                  risk_per_trade: "1%",
                  period: "2 years",
                },
                mdc_strategy_thresholds: {
                  min_score: strategy.entry_score,
                  rsi_range: `${strategy.entry_rsi_min}-${strategy.entry_rsi_max}`,
                  min_momentum: `${strategy.entry_momentum_min}%`,
                  min_52w_ratio: strategy.entry_high_ratio_min,
                  max_pct_b: strategy.entry_pct_b_max,
                  require_bull_regime: strategy.require_bull_regime,
                  exit_score_threshold: strategy.exit_score_threshold,
                  exit_max_days: strategy.exit_max_days,
                  stop_atr_mult: strategy.stop_atr_mult,
                  reentry_cooldown_days: strategy.reentry_cooldown_days,
                  exit_conditions: [`stop_loss (${strategy.stop_atr_mult}x ATR)`, "target (upper BB)", `regime_change (score<${strategy.exit_score_threshold} + below 200-DMA)`, `time_stop (${strategy.exit_max_days} days)`, `reentry_cooldown (${strategy.reentry_cooldown_days} days after stop)`],
                  advanced_filters: {
                    win_rate_filter: strategy.win_rate_filter_enabled ? {
                      min_trades_for_history: strategy.win_rate_min_trades,
                      min_win_rate_pct: strategy.win_rate_threshold,
                      penalty_entry_score: strategy.win_rate_penalty_score,
                    } : "disabled",
                    circuit_breaker: strategy.circuit_breaker_enabled ? {
                      consecutive_stops_trigger: strategy.circuit_breaker_consecutive_stops,
                      pause_duration_days: strategy.circuit_breaker_pause_days,
                    } : "disabled",
                  },
                },
                results_summary: {
                  total_trades: summary.total_trades,
                  overall_return: `${summary.overall_return_pct >= 0 ? "+" : ""}${summary.overall_return_pct.toFixed(2)}%`,
                  final_value: `₹${(summary.total_final_value / 100000).toFixed(1)}L`,
                  avg_return_per_stock: summary.avg_return_per_stock != null ? `${summary.avg_return_per_stock >= 0 ? "+" : ""}${summary.avg_return_per_stock.toFixed(2)}%` : "N/A",
                  stocks_with_trades: result.per_stock.filter((s) => s.total_trades > 0).length,
                  stocks_without_trades: result.per_stock.filter((s) => s.total_trades === 0).length,
                },
                top_performers: result.top_performers.slice(0, 5).map((s) => ({
                  ticker: s.ticker,
                  return: `+${s.total_return_pct.toFixed(1)}%`,
                  trades: s.total_trades,
                })),
                bottom_performers: result.bottom_performers.slice(0, 5).map((s) => ({
                  ticker: s.ticker,
                  return: `${s.total_return_pct.toFixed(1)}%`,
                  trades: s.total_trades,
                })),
                all_trades_by_stock: result.per_stock
                  .filter((s) => s.total_trades > 0)
                  .map((s) => ({
                    ticker: s.ticker,
                    total_return: `${s.total_return_pct >= 0 ? "+" : ""}${s.total_return_pct.toFixed(1)}%`,
                    final_value: `₹${Math.round(s.final_value).toLocaleString()}`,
                    trades: result.all_trades
                      .filter((t) => t.ticker === s.ticker)
                      .map((t) => ({
                        entry_date: t.entry_date,
                        exit_date: t.exit_date,
                        entry_price: `₹${t.entry_price.toFixed(2)}`,
                        exit_price: `₹${t.exit_price.toFixed(2)}`,
                        pnl: `${t.pnl_pct >= 0 ? "+" : ""}${t.pnl_pct.toFixed(1)}%`,
                        exit_reason: t.exit_reason.replace("exit_", ""),
                      })),
                  })),
              };
              const prompt = `Below is the complete MDC strategy backtest results across ${summary.stocks_simulated} NSE stocks over 2 years.

ANALYZE THESE RESULTS AND SUGGEST PARAMETER OPTIMIZATIONS:

Key areas to investigate:
1. Why did certain stocks have zero trades? Are entry thresholds too strict?
2. What's the win rate distribution? Is 65 the optimal entry score threshold?
3. Do RSI bounds (25-55) filter out too many opportunities?
4. Which exit condition triggers most often? Should targets/stops be adjusted?
5. What's the correlation between momentum threshold and returns?
6. Any patterns in top vs bottom performers?

Provide 3-5 concrete parameter adjustments with reasoning.

--- DATA BELOW ---\n\n${JSON.stringify(exportData, null, 2)}`;
              navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-xs px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1.5"
          >
            {copied ? (
              <span className="text-green-600">✓ Copied!</span>
            ) : (
              <span>📋 Copy with Prompt</span>
            )}
          </button>
        </div>
        <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded overflow-x-auto max-h-48">
{`{
  "simulation_config": {
    "mode": "all_stocks",
    "stocks_simulated": ${summary.stocks_simulated},
    "portfolio_per_stock": "₹${summary.portfolio_per_stock.toLocaleString()}",
    "total_capital": "₹${(summary.total_initial_capital / 100000).toFixed(1)}L"
  },
  "mdc_strategy_thresholds": {
    "min_score": 65,
    "rsi_range": "25-55",
    "min_momentum": "5%",
    "min_52w_ratio": 0.65,
    "max_pct_b": 0.55
  },
  "results_summary": {
    "total_trades": ${summary.total_trades},
    "overall_return": "${summary.overall_return_pct >= 0 ? "+" : ""}${summary.overall_return_pct.toFixed(2)}%",
    "final_value": "₹${(summary.total_final_value / 100000).toFixed(1)}L",
    "stocks_with_trades": ${result.per_stock.filter((s) => s.total_trades > 0).length}
  },
  "sample_trades_by_stock": [
    {
      "ticker": "RELIANCE.NS",
      "trades": [
        {"entry": "2023-01-15", "exit": "2023-04-20", "entry_price": "₹2,450.00", "exit_price": "₹2,680.50", "pnl": "+9.4%", "exit_reason": "target"}
      ]
    }
  ]
}`}
        </pre>
        <p className="text-xs text-slate-400 mt-2">
          Includes a pre-written prompt + JSON data. Just paste into your LLM.
        </p>
      </div>

      {/* All Trades Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="font-semibold mb-3">All Trades Across All Stocks ({result.all_trades.length})</h3>
        {result.all_trades.length === 0 ? (
          <p className="text-sm text-slate-400">No trades were triggered across any stock.</p>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-4">Stock</th>
                  <th className="pb-2 pr-4">Entry</th>
                  <th className="pb-2 pr-4">Exit</th>
                  <th className="pb-2 pr-4 text-right">Entry ₹</th>
                  <th className="pb-2 pr-4 text-right">Exit ₹</th>
                  <th className="pb-2 pr-4 text-right">Return</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.all_trades.slice(0, 100).map((trade, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 pr-4 font-mono text-xs">{trade.ticker.replace(".NS", "")}</td>
                    <td className="py-2 pr-4 text-xs">{trade.entry_date}</td>
                    <td className="py-2 pr-4 text-xs">{trade.exit_date}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">₹{trade.entry_price.toFixed(0)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">₹{trade.exit_price.toFixed(0)}</td>
                    <td className={`py-2 pr-4 text-right font-mono font-semibold ${trade.pnl_pct >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {trade.pnl_pct >= 0 ? "+" : ""}{trade.pnl_pct.toFixed(1)}%
                    </td>
                    <td className="py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                        {trade.exit_reason.replace("exit_", "")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.all_trades.length > 100 && (
              <p className="text-xs text-slate-400 text-center mt-3">
                Showing first 100 of {result.all_trades.length} trades
              </p>
            )}
          </div>
        )}
      </div>

      {/* Per-Stock Detail Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="font-semibold mb-3">Per-Stock Performance</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="pb-2 pr-4">Stock</th>
                <th className="pb-2 pr-4 text-right">Trades</th>
                <th className="pb-2 pr-4 text-right">Win Rate</th>
                <th className="pb-2 pr-4 text-right">Return</th>
                <th className="pb-2 pr-4 text-right">Final Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.per_stock.map((stock) => (
                <tr key={stock.ticker} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 pr-4 font-mono">{stock.ticker.replace(".NS", "")}</td>
                  <td className="py-2 pr-4 text-right">{stock.total_trades}</td>
                  <td className="py-2 pr-4 text-right">{stock.win_rate != null ? `${stock.win_rate.toFixed(0)}%` : "—"}</td>
                  <td className={`py-2 pr-4 text-right font-semibold ${stock.total_return_pct >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {stock.total_return_pct >= 0 ? "+" : ""}{stock.total_return_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">₹{(stock.final_value / 100000).toFixed(1)}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
