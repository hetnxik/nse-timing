import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { apiClient } from "../api";
import { ScoreGauge } from "../components/ScoreGauge";
import { SignalCard } from "../components/SignalCard";
import { IndicatorCard } from "../components/IndicatorCard";
import { MiniChart } from "../components/MiniChart";
import {
  getRSIExplanation,
  getMA200Explanation,
  getBBExplanation,
  getMACDExplanation,
  getMomentumExplanation,
  priceChartExplanation,
  rsiChartExplanation,
  macdChartExplanation,
  bbChartExplanation,
} from "../explanations";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine,
} from "recharts";

const STOCKS_LIST = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN",
  "BAJFINANCE", "KOTAKBANK", "LT", "WIPRO", "TITAN", "AXISBANK", "ASIANPAINT",
  "MARUTI", "NESTLEIND", "ULTRACEMCO", "POWERGRID", "NTPC", "SUNPHARMA",
  "DRREDDY", "DIVISLAB", "CIPLA", "TECHM", "HCLTECH", "INDUSINDBK", "M&M",
  "TATAMOTORS", "ONGC", "BPCL",
];

export const Analyser = () => {
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"score" | "charts" | "indicators" | "fundamentals">("score");

  const { currentStock, setCurrentStock, loading, setLoading, error, setError } = useStore();

  useEffect(() => {
    if (searchParams.get("ticker")) {
      handleLoadStock(searchParams.get("ticker")!);
    }
  }, []);

  const handleLoadStock = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const fullTicker = t.endsWith(".NS") ? t : `${t}.NS`;
      const data = await apiClient.getStock(fullTicker);
      setCurrentStock(data);
      setInput("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      handleLoadStock(input.trim().toUpperCase());
    }
  };

  const chartData = currentStock
    ? currentStock.chart_data.map((d) => ({
        date: d.date,
        close: d.close,
      }))
    : [];

  const ma200Data = currentStock
    ? currentStock.chart_data.map((d) => ({
        date: d.date,
        price: d.close,
        ma200: d.ma200 ?? undefined,
      }))
    : [];

  const rsiExpl = currentStock ? getRSIExplanation(currentStock.indicators.rsi) : null;
  const ma200Expl = currentStock
    ? getMA200Explanation(
        currentStock.meta.current_price,
        currentStock.indicators.ma200.value,
        currentStock.indicators.ma200.pct_above,
        currentStock.indicators.ma200.bull_regime
      )
    : null;
  const bbExpl = currentStock
    ? getBBExplanation(
        currentStock.indicators.bollinger_bands.pct_b,
        currentStock.meta.current_price,
        currentStock.indicators.bollinger_bands.upper,
        currentStock.indicators.bollinger_bands.mid,
        currentStock.indicators.bollinger_bands.lower
      )
    : null;
  const macdExpl = currentStock
    ? getMACDExplanation(
        currentStock.indicators.macd.histogram,
        currentStock.indicators.macd.line,
        currentStock.indicators.macd.signal
      )
    : null;
  const momentumExpl = currentStock ? getMomentumExplanation(currentStock.indicators.momentum_6m) : null;

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter ticker (e.g., RELIANCE or RELIANCE.NS)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleSearch}
            className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono text-sm"
          />
          <button
            onClick={() => handleLoadStock(input)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-mono text-sm"
          >
            Search
          </button>
        </div>

        {/* Quick-pick buttons */}
        <div className="flex flex-wrap gap-2">
          {STOCKS_LIST.map((stock) => (
            <button
              key={stock}
              onClick={() => handleLoadStock(stock)}
              className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {stock}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-100 text-sm">
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          Loading data...
        </div>
      )}

      {currentStock && (
        <>
          {/* Header Section */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{currentStock.meta.ticker}</h2>
              <div className={`px-3 py-1 rounded text-xs font-semibold ${
                currentStock.meta.data_source === 'live'
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              }`}>
                {currentStock.meta.data_source === 'live' ? '🔴 LIVE DATA' : '📊 MOCK DATA'}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Symbol
                </div>
                <div className="text-lg font-bold font-mono">
                  {currentStock.meta.ticker}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Name
                </div>
                <div className="text-sm">{currentStock.meta.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Price
                </div>
                <div className="text-lg font-bold font-mono">
                  ₹{currentStock.meta.current_price.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Day Change
                </div>
                <div
                  className={`text-lg font-bold font-mono ${
                    currentStock.meta.day_change_pct >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {currentStock.meta.day_change_pct > 0 ? "+" : ""}
                  {currentStock.meta.day_change_pct.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Sparkline */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <MiniChart data={chartData} />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-6">
              {(["score", "charts", "indicators", "fundamentals"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Score Tab */}
          {activeTab === "score" && (
            <div className="space-y-6">
              {/* Gauge */}
              <div className="card flex justify-center">
                <ScoreGauge score={currentStock.score.value} verdict={currentStock.score.verdict} />
              </div>

              {/* Signals */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg">Signals</h3>
                {currentStock.signals.map((signal, i) => (
                  <SignalCard key={i} signal={signal} />
                ))}
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    52W High
                  </div>
                  <div className="text-2xl font-mono font-bold">
                    ₹{currentStock.meta.high_52w.toFixed(2)}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    52W Low
                  </div>
                  <div className="text-2xl font-mono font-bold">
                    ₹{currentStock.meta.low_52w.toFixed(2)}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    From 52W High
                  </div>
                  <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
                    -
                    {(
                      ((currentStock.meta.high_52w - currentStock.meta.current_price) /
                        currentStock.meta.high_52w) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                </div>

                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    ATR %
                  </div>
                  <div className="text-2xl font-mono font-bold">
                    {currentStock.indicators.atr.pct.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Support / Resistance */}
              {(currentStock.support_resistance.support.length > 0 || currentStock.support_resistance.resistance.length > 0) && (
                <div className="card space-y-3">
                  <h3 className="font-bold text-lg">Support & Resistance Levels</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Support</div>
                      {currentStock.support_resistance.support.length > 0 ? currentStock.support_resistance.support.map((v) => (
                        <div key={v} className="font-mono text-green-600 dark:text-green-400 font-semibold">₹{v.toFixed(2)}</div>
                      )) : <div className="text-slate-400 text-sm">—</div>}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Resistance</div>
                      {currentStock.support_resistance.resistance.length > 0 ? currentStock.support_resistance.resistance.map((v) => (
                        <div key={v} className="font-mono text-red-600 dark:text-red-400 font-semibold">₹{v.toFixed(2)}</div>
                      )) : <div className="text-slate-400 text-sm">—</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charts Tab */}
          {activeTab === "charts" && (
            <div className="space-y-8">
              {/* Price + MA200 Chart */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">Price & 200-Day Moving Average</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ma200Data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(val) => `₹${(val as number).toFixed(2)}`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#2563eb"
                        name="Price"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="ma200"
                        stroke="#f59e0b"
                        name="200-DMA"
                        dot={false}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                      {currentStock.support_resistance.support.map((v) => (
                        <ReferenceLine key={`s${v}`} y={v} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1} />
                      ))}
                      {currentStock.support_resistance.resistance.map((v) => (
                        <ReferenceLine key={`r${v}`} y={v} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {priceChartExplanation}
                </p>
              </div>

              {/* RSI Chart */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">RSI (14)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentStock.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "70", fontSize: 10, fill: "#ef4444" }} />
                      <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "30", fontSize: 10, fill: "#f59e0b" }} />
                      <Line
                        type="monotone"
                        dataKey="rsi"
                        stroke="#8b5cf6"
                        name="RSI"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {rsiChartExplanation}
                </p>
              </div>

              {/* MACD Chart */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">MACD</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={currentStock.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="macd_histogram"
                        fill="#e0e7ff"
                        name="Histogram"
                        barSize={4}
                      />
                      <Line
                        type="monotone"
                        dataKey="macd_signal"
                        stroke="#f43f5e"
                        name="Signal"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="macd_line"
                        stroke="#10b981"
                        name="MACD"
                        dot={false}
                        strokeWidth={2}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {macdChartExplanation}
                </p>
              </div>

              {/* Bollinger Bands Chart */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">Bollinger Bands (20, 2σ)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentStock.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(val) => `₹${(val as number).toFixed(2)}`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#2563eb"
                        name="Price"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="bb_upper"
                        stroke="#94a3b8"
                        name="Upper Band"
                        dot={false}
                        strokeWidth={1}
                        strokeDasharray="5 5"
                      />
                      <Line
                        type="monotone"
                        dataKey="bb_mid"
                        stroke="#94a3b8"
                        name="Middle Band"
                        dot={false}
                        strokeWidth={1}
                        strokeDasharray="5 5"
                      />
                      <Line
                        type="monotone"
                        dataKey="bb_lower"
                        stroke="#94a3b8"
                        name="Lower Band"
                        dot={false}
                        strokeWidth={1}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {bbChartExplanation}
                </p>
              </div>
            </div>
          )}

          {/* Indicators Tab */}
          {activeTab === "indicators" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IndicatorCard
                name="RSI (14)"
                value={currentStock.indicators.rsi}
                interpretation={rsiExpl?.label || ""}
                indicator="rsi"
              />

              <IndicatorCard
                name="6-Month Momentum"
                value={currentStock.indicators.momentum_6m}
                interpretation={momentumExpl?.label || ""}
                indicator="momentum_6m"
              />

              <IndicatorCard
                name="200-Day MA"
                value={`₹${currentStock.indicators.ma200.value.toFixed(2)}`}
                interpretation={ma200Expl?.label || ""}
                indicator="ma200"
                meta={{
                  bull_regime: currentStock.indicators.ma200.bull_regime ? 1 : 0,
                  pct_above: currentStock.indicators.ma200.pct_above,
                }}
              />

              <IndicatorCard
                name="ATR (14)"
                value={currentStock.indicators.atr.value}
                interpretation={`${currentStock.indicators.atr.pct.toFixed(1)}% of price`}
                indicator="atr"
                meta={{ pct: currentStock.indicators.atr.pct }}
              />

              <IndicatorCard
                name="MACD Histogram"
                value={currentStock.indicators.macd.histogram}
                interpretation={macdExpl?.label || ""}
                indicator="macd"
                meta={{
                  histogram: currentStock.indicators.macd.histogram,
                }}
              />

              <IndicatorCard
                name="Bollinger Bands %B"
                value={currentStock.indicators.bollinger_bands.pct_b}
                interpretation={bbExpl?.label || ""}
                indicator="bollinger_bands"
                meta={{
                  pct_b: currentStock.indicators.bollinger_bands.pct_b,
                  mid: currentStock.indicators.bollinger_bands.mid,
                }}
              />

              <IndicatorCard
                name="Volume Ratio"
                value={currentStock.indicators.volume_ratio}
                interpretation={`${currentStock.indicators.volume_ratio.toFixed(1)}x avg`}
                indicator="volume_ratio"
              />

              <IndicatorCard
                name="Day Change"
                value={currentStock.meta.day_change_pct}
                interpretation={`${currentStock.meta.day_change_pct > 0 ? "+" : ""}${currentStock.meta.day_change_pct.toFixed(2)}%`}
                indicator="volume_ratio"
              />
            </div>
          )}

          {/* Fundamentals Tab */}
          {activeTab === "fundamentals" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    label: "P/E Ratio (TTM)",
                    value: currentStock.fundamentals.pe_ratio != null
                      ? currentStock.fundamentals.pe_ratio.toFixed(1)
                      : "—",
                    sub: "Price / Earnings",
                  },
                  {
                    label: "P/B Ratio",
                    value: currentStock.fundamentals.pb_ratio != null
                      ? currentStock.fundamentals.pb_ratio.toFixed(2)
                      : "—",
                    sub: "Price / Book Value",
                  },
                  {
                    label: "Market Cap",
                    value: currentStock.fundamentals.market_cap != null
                      ? `₹${(currentStock.fundamentals.market_cap / 1e7).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} Cr`
                      : "—",
                    sub: "Total market capitalisation",
                  },
                  {
                    label: "EPS (TTM)",
                    value: currentStock.fundamentals.eps != null
                      ? `₹${currentStock.fundamentals.eps.toFixed(2)}`
                      : "—",
                    sub: "Earnings per share",
                  },
                  {
                    label: "Dividend Yield",
                    value: currentStock.fundamentals.dividend_yield != null
                      ? `${(currentStock.fundamentals.dividend_yield * 100).toFixed(2)}%`
                      : "—",
                    sub: "Annual dividend / price",
                  },
                  {
                    label: "Avg. Volume",
                    value: currentStock.fundamentals.avg_volume != null
                      ? `${(currentStock.fundamentals.avg_volume / 1e6).toFixed(1)}M`
                      : "—",
                    sub: "Average daily volume",
                  },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="stat-card">
                    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{label}</div>
                    <div className="text-2xl font-mono font-bold">{value}</div>
                    <div className="text-xs text-slate-400 mt-1">{sub}</div>
                  </div>
                ))}
              </div>

              {(currentStock.fundamentals.sector || currentStock.fundamentals.industry) && (
                <div className="card space-y-2">
                  {currentStock.fundamentals.sector && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Sector</span>
                      <span className="font-semibold">{currentStock.fundamentals.sector}</span>
                    </div>
                  )}
                  {currentStock.fundamentals.industry && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Industry</span>
                      <span className="font-semibold">{currentStock.fundamentals.industry}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
