import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { apiClient, BacktestResult, StockData, TradeCreate } from "../api";
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
  scoreHistoryChartExplanation,
  getEntryZoneExplanation,
  getBacktestExplanation,
} from "../explanations";
import { exportCsv } from "../utils/exportCsv";
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
  Cell,
  ReferenceLine,
  Area,
} from "recharts";

const STOCKS_LIST = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN",
  "BAJFINANCE", "KOTAKBANK", "LT", "WIPRO", "TITAN", "AXISBANK", "ASIANPAINT",
  "MARUTI", "NESTLEIND", "ULTRACEMCO", "POWERGRID", "NTPC", "SUNPHARMA",
  "DRREDDY", "DIVISLAB", "CIPLA", "TECHM", "HCLTECH", "INDUSINDBK", "M&M",
  "TATAMOTORS", "ONGC", "BPCL",
];

type TabType = "score" | "charts" | "indicators" | "fundamentals" | "entry_zone" | "backtest";

// ── Entry Zone Tab ────────────────────────────────────────────────────────────

function PriceRuler({
  stopAtr, stopBb, entryLow, entryHigh, targetBb, target52w, targetMom,
}: {
  stopAtr: number; stopBb: number; entryLow: number; entryHigh: number;
  targetBb: number; target52w: number; targetMom: number;
}) {
  const allPrices = [stopAtr, stopBb, entryLow, entryHigh, targetBb, target52w, targetMom];
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  const pct = (v: number) => ((v - minP) / range) * 100;

  const points = [
    { label: "Stop(ATR)", val: stopAtr, color: "#ef4444" },
    { label: "Stop(BB)", val: stopBb, color: "#f97316" },
    { label: "Entry Low", val: entryLow, color: "#3b82f6" },
    { label: "Current", val: entryHigh, color: "#3b82f6" },
    { label: "Target BB", val: targetBb, color: "#22c55e" },
    { label: "52W High", val: target52w, color: "#16a34a" },
    { label: "Momentum", val: targetMom, color: "#15803d" },
  ];

  return (
    <div className="w-full py-6 px-2">
      <svg width="100%" height="72" viewBox="0 0 1000 72" preserveAspectRatio="none">
        {/* Red zone: stop to entry */}
        <rect
          x={`${pct(Math.min(stopAtr, stopBb))}%`}
          y={28}
          width={`${pct(entryLow) - pct(Math.min(stopAtr, stopBb))}%`}
          height={16}
          fill="#fee2e2"
          rx={4}
        />
        {/* Green zone: entry to targets */}
        <rect
          x={`${pct(entryHigh)}%`}
          y={28}
          width={`${pct(Math.max(targetBb, target52w, targetMom)) - pct(entryHigh)}%`}
          height={16}
          fill="#dcfce7"
          rx={4}
        />
        {/* Baseline */}
        <line x1="0" y1="36" x2="1000" y2="36" stroke="#94a3b8" strokeWidth={1} />
        {/* Points */}
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={`${pct(p.val)}%`} cy="36" r="6" fill={p.color} />
            <text
              x={`${pct(p.val)}%`}
              y="20"
              textAnchor="middle"
              fontSize="11"
              fill={p.color}
              fontWeight="600"
            >
              {p.label}
            </text>
            <text
              x={`${pct(p.val)}%`}
              y="66"
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              ₹{p.val.toFixed(0)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RrBadge({ quality }: { quality: "poor" | "acceptable" | "good" }) {
  const cls =
    quality === "good"
      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
      : quality === "acceptable"
      ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
      : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{quality}</span>;
}

function PaperTradeModal({
  stock,
  onClose,
}: {
  stock: StockData;
  onClose: () => void;
}) {
  const ez = stock.entry_zone;
  const today = new Date().toISOString().slice(0, 10);
  const [entryPrice, setEntryPrice] = useState(String(stock.meta.current_price.toFixed(2)));
  const [quantity, setQuantity] = useState("1");
  const [stopLoss, setStopLoss] = useState(String(ez.stop_atr.toFixed(2)));
  const [target, setTarget] = useState(String(ez.target_bb_upper.toFixed(2)));
  const [entryDate, setEntryDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    const trade: TradeCreate = {
      ticker: stock.meta.ticker,
      entry_price: parseFloat(entryPrice),
      entry_date: entryDate,
      quantity: parseFloat(quantity),
      stop_loss: parseFloat(stopLoss) || null,
      target: parseFloat(target) || null,
      notes: notes || null,
      entry_score: stock.score.value,
    };
    await apiClient.createTrade(trade);
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-96 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg mb-1">Paper Trade</h3>
        <p className="text-xs text-slate-500 mb-4">{stock.meta.ticker} — Score {stock.score.value.toFixed(0)} ({stock.score.verdict})</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Entry Price (₹)</label>
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Quantity (shares)</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Stop Loss (₹)</label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target (₹)</label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Entry Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Thesis, catalyst, etc."
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || saved}
            className={`flex-1 py-2 rounded text-sm font-semibold text-white transition-colors ${
              saved ? "bg-green-600" : saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saved ? "Saved!" : saving ? "Saving…" : "Log Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryZoneTab({ stock }: { stock: StockData }) {
  const ez = stock.entry_zone;
  const [stopBasis, setStopBasis] = useState<"atr" | "bb">("atr");
  const [targetBasis, setTargetBasis] = useState<"bb_upper" | "52w_high" | "momentum">("bb_upper");
  const [showTradeModal, setShowTradeModal] = useState(false);

  const stop = stopBasis === "atr" ? ez.stop_atr : ez.stop_bb;
  const stopPct = stopBasis === "atr" ? ez.stop_atr_pct : ez.stop_bb_pct;
  const posSize = stopBasis === "atr" ? ez.position_size_atr : ez.position_size_bb;

  const targetVal =
    targetBasis === "bb_upper" ? ez.target_bb_upper :
    targetBasis === "52w_high" ? ez.target_52w_high :
    ez.target_momentum;
  const targetPct =
    targetBasis === "bb_upper" ? ez.target_bb_upper_pct :
    targetBasis === "52w_high" ? ez.target_52w_high_pct :
    ez.target_momentum_pct;
  const targetLabel =
    targetBasis === "bb_upper" ? "Upper BB" :
    targetBasis === "52w_high" ? "52W High" :
    "Momentum";

  const rrKey = `${stopBasis === "atr" ? "atr" : "bb"}_${targetBasis === "bb_upper" ? "bb_upper" : targetBasis === "52w_high" ? "52w_high" : "momentum"}`;
  const rrData = ez.rr_matrix[rrKey] ?? { rr: 0, quality: "poor" as const };

  return (
    <div className="space-y-6">
      {/* Price Ruler */}
      <div className="card overflow-x-auto">
        <h3 className="font-bold text-lg mb-2">Price Map</h3>
        <PriceRuler
          stopAtr={ez.stop_atr}
          stopBb={ez.stop_bb}
          entryLow={ez.ideal_entry_low}
          entryHigh={ez.ideal_entry_high}
          targetBb={ez.target_bb_upper}
          target52w={ez.target_52w_high}
          targetMom={ez.target_momentum}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ez.entry_note}</p>
      </div>

      {/* Toggles */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="card flex-1 space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Stop Loss Basis</div>
          <div className="flex gap-2">
            {(["atr", "bb"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setStopBasis(b)}
                className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                  stopBasis === b
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {b === "atr" ? "ATR-based" : "BB-based"}
              </button>
            ))}
          </div>
        </div>

        <div className="card flex-1 space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Price Target</div>
          <div className="flex gap-2 flex-wrap">
            {(["bb_upper", "52w_high", "momentum"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTargetBasis(t)}
                className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                  targetBasis === t
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {t === "bb_upper" ? "Upper BB" : t === "52w_high" ? "52W High" : "Momentum"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Entry Range</div>
          <div className="font-mono font-bold text-lg">₹{ez.ideal_entry_low.toFixed(2)}</div>
          <div className="text-xs text-slate-400">to ₹{ez.ideal_entry_high.toFixed(2)}</div>
        </div>

        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Stop Loss</div>
          <div className="font-mono font-bold text-lg text-red-600 dark:text-red-400">₹{stop.toFixed(2)}</div>
          <div className="text-xs text-slate-400">{stopPct.toFixed(2)}% below entry</div>
        </div>

        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Target ({targetLabel})</div>
          <div className="font-mono font-bold text-lg text-green-600 dark:text-green-400">₹{targetVal.toFixed(2)}</div>
          <div className="text-xs text-slate-400">+{targetPct.toFixed(2)}% above entry</div>
        </div>

        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Risk/Reward</div>
          <div className="font-mono font-bold text-lg">{rrData.rr.toFixed(2)}:1</div>
          <RrBadge quality={rrData.quality} />
        </div>

        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Suggested Position</div>
          <div className="font-mono font-bold text-lg">{posSize.toFixed(1)}%</div>
          <div className="text-xs text-slate-400">of portfolio</div>
        </div>

        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Max Portfolio Loss</div>
          <div className="font-mono font-bold text-lg text-red-600 dark:text-red-400">1.0%</div>
          <div className="text-xs text-slate-400">if stop hit (1% risk rule)</div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="card text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {getEntryZoneExplanation(stopBasis, stop, stopPct, targetBasis, targetVal, targetLabel, rrData.rr, posSize)}
      </div>

      {/* Paper Trade CTA */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowTradeModal(true)}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
        >
          Paper Trade
        </button>
      </div>

      {showTradeModal && (
        <PaperTradeModal stock={stock} onClose={() => setShowTradeModal(false)} />
      )}
    </div>
  );
}

// ── Backtest Tab ──────────────────────────────────────────────────────────────


function BacktestTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.getBacktest(ticker)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="py-8 text-center text-slate-500">Loading backtest data...</div>;
  if (error) return <div className="py-8 text-center text-red-500">{error}</div>;
  if (!data) return null;

  const { stats, signals, score_history } = data;

  // Prepare chart data: merge price + score, mark signals
  const signalDateSet = new Set(signals.map((s) => s.signal_date));
  const signalTypeMap = new Map(signals.map((s) => [s.signal_date, s.signal_type]));
  const chartData = score_history.slice(-126).map((h) => ({
    date: h.date,
    close: h.close,
    score: h.score,
    signal: signalDateSet.has(h.date) ? signalTypeMap.get(h.date) : undefined,
  }));

  const handleExport = () => {
    exportCsv(`backtest_${ticker}.csv`, signals.map((s) => ({
      Date: s.signal_date,
      "Signal Type": s.signal_type,
      "Entry Price": s.signal_price,
      Score: s.signal_score,
      "3M Return %": s.return_3m ?? "",
      "6M Return %": s.return_6m ?? "",
      "Max Drawdown %": s.max_drawdown_pct,
      "Stop Hit": s.hit_stop_atr ? "Yes" : "No",
    })));
  };

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Signals", value: stats.total_signals },
          { label: "Win Rate (6M)", value: stats.win_rate_6m !== null ? `${stats.win_rate_6m}%` : "—" },
          { label: "Avg 6M Return", value: stats.avg_return_6m !== null ? `${stats.avg_return_6m}%` : "—" },
          { label: "Median 6M Return", value: stats.median_return_6m !== null ? `${stats.median_return_6m}%` : "—" },
          { label: "Avg Max Drawdown", value: stats.avg_max_drawdown !== null ? `${stats.avg_max_drawdown}%` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{label}</div>
            <div className="text-xl font-mono font-bold">{value}</div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Price & Score with Signals</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-blue-600"></span> Price
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-0.5 h-3 bg-green-700"></span> Strong signal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-0.5 h-3 bg-amber-500"></span> Moderate signal
            </span>
          </div>
        </div>

        {/* Price panel */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="backtest" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" hide />
              <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} tickFormatter={(v) => `₹${v.toFixed(0)}`} width={70} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const sig = signals.find((s) => s.signal_date === d.date);
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs shadow">
                      <div className="font-semibold">{d.date}</div>
                      <div>Price: ₹{d.close?.toFixed(2)}</div>
                      {sig && (
                        <>
                          <div className="mt-1 font-semibold" style={{ color: sig.signal_type === "strong" ? "#16a34a" : "#f59e0b" }}>
                            Signal: {sig.signal_type}
                          </div>
                          <div>Entry: ₹{sig.signal_price.toFixed(2)}</div>
                          <div>3M: {sig.return_3m !== null ? `${sig.return_3m > 0 ? "+" : ""}${sig.return_3m}%` : "—"}</div>
                          <div>6M: {sig.return_6m !== null ? `${sig.return_6m > 0 ? "+" : ""}${sig.return_6m}%` : "—"}</div>
                          <div>Max DD: {sig.max_drawdown_pct}%</div>
                        </>
                      )}
                    </div>
                  );
                }}
              />
              {signals.map((s) => (
                <ReferenceLine
                  key={s.signal_date}
                  x={s.signal_date}
                  stroke={s.signal_type === "strong" ? "#16a34a" : "#f59e0b"}
                  strokeWidth={2}
                  strokeOpacity={0.8}
                  label={{ value: s.signal_type === "strong" ? "▲" : "△", position: "top", fontSize: 10, fill: s.signal_type === "strong" ? "#16a34a" : "#f59e0b" }}
                />
              ))}
              <Line type="monotone" dataKey="close" stroke="#2563eb" name="Price" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Score panel */}
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} syncId="backtest" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }}
                tickFormatter={(d) => d.slice(0, 7)}
                interval={Math.max(Math.floor(chartData.length / 8) - 1, 0)} />
              <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: "#94a3b8" }} width={70} ticks={[0, 35, 65, 100]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs shadow">
                      <div className="font-semibold">{d.date}</div>
                      <div>Score: {d.score?.toFixed(1)}</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={65} stroke="#16a34a" strokeDasharray="5 5"
                label={{ value: "Buy (65)", fontSize: 9, fill: "#16a34a", position: "insideTopRight" }} />
              <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="5 5"
                label={{ value: "Avoid (35)", fontSize: 9, fill: "#ef4444", position: "insideBottomRight" }} />
              <Area type="monotone" dataKey="score" stroke="#8b5cf6" fill="#8b5cf633" name="Score" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Signals Table */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Signals</h3>
          <button
            onClick={handleExport}
            className="px-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
        {signals.length === 0 ? (
          <div className="text-slate-500 text-sm">No signals detected in the 2-year window.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700">
                <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Type</th>
                  <th className="text-right py-2 px-3">Entry</th>
                  <th className="text-right py-2 px-3">Score</th>
                  <th className="text-right py-2 px-3">3M Ret</th>
                  <th className="text-right py-2 px-3">6M Ret</th>
                  <th className="text-right py-2 px-3">Max DD</th>
                  <th className="text-center py-2 px-3">Stop Hit</th>
                </tr>
              </thead>
              <tbody>
                {[...signals].sort((a, b) => b.signal_date.localeCompare(a.signal_date)).map((s) => {
                  const rowColor =
                    s.return_6m === null
                      ? ""
                      : s.return_6m > 0
                      ? "bg-green-50 dark:bg-green-950"
                      : "bg-red-50 dark:bg-red-950";
                  return (
                    <tr key={s.signal_date} className={`border-b border-slate-100 dark:border-slate-800 ${rowColor}`}>
                      <td className="py-2 px-3 font-mono">{s.signal_date}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          s.signal_type === "strong"
                            ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                            : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                        }`}>
                          {s.signal_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">₹{s.signal_price.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.signal_score.toFixed(1)}</td>
                      <td className={`py-2 px-3 text-right font-mono ${s.return_3m === null ? "text-slate-400" : s.return_3m >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {s.return_3m !== null ? `${s.return_3m > 0 ? "+" : ""}${s.return_3m}%` : "—"}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${s.return_6m === null ? "text-slate-400" : s.return_6m >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {s.return_6m !== null ? `${s.return_6m > 0 ? "+" : ""}${s.return_6m}%` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600 dark:text-red-400">{s.max_drawdown_pct}%</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs font-semibold ${s.hit_stop_atr ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {s.hit_stop_atr ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interpretation */}
      <div className="card text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {getBacktestExplanation(
          ticker,
          stats.total_signals,
          stats.signals_with_6m_outcome,
          stats.win_rate_6m,
          stats.avg_return_6m,
          stats.avg_max_drawdown
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const Analyser = () => {
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("score");

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
    ? currentStock.chart_data.map((d) => ({ date: d.date, close: d.close }))
    : [];

  const ma200Data = currentStock
    ? currentStock.chart_data.map((d) => ({ date: d.date, price: d.close, ma200: d.ma200 ?? undefined }))
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

  const TABS: { id: TabType; label: string }[] = [
    { id: "score", label: "Score" },
    { id: "charts", label: "Charts" },
    { id: "indicators", label: "Indicators" },
    { id: "fundamentals", label: "Fundamentals" },
    { id: "entry_zone", label: "Entry Zone" },
    { id: "backtest", label: "Backtest" },
  ];

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
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">Loading data...</div>
      )}

      {currentStock && (
        <>
          {/* Header Section */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{currentStock.meta.ticker}</h2>
              <div className={`px-3 py-1 rounded text-xs font-semibold ${
                currentStock.meta.data_source === "live"
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                  : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
              }`}>
                {currentStock.meta.data_source === "live" ? "🔴 LIVE DATA" : "📊 MOCK DATA"}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Symbol</div>
                <div className="text-lg font-bold font-mono">{currentStock.meta.ticker}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Name</div>
                <div className="text-sm">{currentStock.meta.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Price</div>
                <div className="text-lg font-bold font-mono">{currentStock.meta.current_price != null ? `₹${currentStock.meta.current_price.toFixed(2)}` : "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Day Change</div>
                <div className={`text-lg font-bold font-mono ${(currentStock.meta.day_change_pct ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {currentStock.meta.day_change_pct != null ? `${currentStock.meta.day_change_pct > 0 ? "+" : ""}${currentStock.meta.day_change_pct.toFixed(2)}%` : "—"}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <MiniChart data={chartData} />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Score Tab */}
          {activeTab === "score" && (
            <div className="space-y-6">
              <div className="card flex justify-center">
                <ScoreGauge score={currentStock.score.value} verdict={currentStock.score.verdict} />
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-lg">Signals</h3>
                {currentStock.signals.map((signal, i) => (
                  <SignalCard key={i} signal={signal} />
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">52W High</div>
                  <div className="text-2xl font-mono font-bold">{currentStock.meta.high_52w != null ? `₹${currentStock.meta.high_52w.toFixed(2)}` : "—"}</div>
                </div>
                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">52W Low</div>
                  <div className="text-2xl font-mono font-bold">{currentStock.meta.low_52w != null ? `₹${currentStock.meta.low_52w.toFixed(2)}` : "—"}</div>
                </div>
                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">From 52W High</div>
                  <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
                    {currentStock.meta.high_52w != null && currentStock.meta.current_price != null
                      ? `-${(((currentStock.meta.high_52w - currentStock.meta.current_price) / currentStock.meta.high_52w) * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">ATR %</div>
                  <div className="text-2xl font-mono font-bold">{currentStock.indicators.atr.pct != null ? `${currentStock.indicators.atr.pct.toFixed(2)}%` : "—"}</div>
                </div>
              </div>

              {(currentStock.support_resistance.support.length > 0 || currentStock.support_resistance.resistance.length > 0) && (
                <div className="card space-y-3">
                  <h3 className="font-bold text-lg">Support & Resistance Levels</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Support</div>
                      {currentStock.support_resistance.support.length > 0
                        ? currentStock.support_resistance.support.map((v) => (
                            <div key={v} className="font-mono text-green-600 dark:text-green-400 font-semibold">₹{v.toFixed(2)}</div>
                          ))
                        : <div className="text-slate-400 text-sm">—</div>}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Resistance</div>
                      {currentStock.support_resistance.resistance.length > 0
                        ? currentStock.support_resistance.resistance.map((v) => (
                            <div key={v} className="font-mono text-red-600 dark:text-red-400 font-semibold">₹{v.toFixed(2)}</div>
                          ))
                        : <div className="text-slate-400 text-sm">—</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charts Tab */}
          {activeTab === "charts" && (
            <div className="space-y-8">
              {/* Price + MA200 */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">Price & 200-Day Moving Average</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ma200Data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }}
                        tickFormatter={(d) => d.slice(0, 7)}
                        interval={Math.max(Math.floor(ma200Data.length / 8) - 1, 0)} />
                      <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} tickFormatter={(v) => `₹${v.toFixed(0)}`} width={70} />
                      <Tooltip formatter={(val) => `₹${(val as number).toFixed(2)}`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="price" stroke="#2563eb" name="Price" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="ma200" stroke="#f59e0b" name="200-DMA" dot={false} strokeWidth={2} strokeDasharray="5 5" />
                      {currentStock.support_resistance.support.map((v) => (
                        <ReferenceLine key={`s${v}`} y={v} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1}
                          label={{ value: `S ₹${v.toFixed(0)}`, fontSize: 9, fill: "#16a34a", position: "insideTopRight" }} />
                      ))}
                      {currentStock.support_resistance.resistance.map((v) => (
                        <ReferenceLine key={`r${v}`} y={v} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1}
                          label={{ value: `R ₹${v.toFixed(0)}`, fontSize: 9, fill: "#dc2626", position: "insideBottomRight" }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{priceChartExplanation}</p>
              </div>

              {/* RSI Chart */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">RSI (14)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentStock.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }}
                        tickFormatter={(d) => d.slice(0, 7)}
                        interval={Math.max(Math.floor(currentStock.chart_data.length / 8) - 1, 0)} />
                      <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} domain={[0, 100]} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Overbought (70)", fontSize: 10, fill: "#ef4444", position: "insideTopRight" }} />
                      <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Oversold (30)", fontSize: 10, fill: "#f59e0b", position: "insideBottomRight" }} />
                      <Line type="monotone" dataKey="rsi" stroke="#8b5cf6" name="RSI (14)" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{rsiChartExplanation}</p>
              </div>

              {/* MACD Chart */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">MACD</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={currentStock.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }}
                        tickFormatter={(d) => d.slice(0, 7)}
                        interval={Math.max(Math.floor(currentStock.chart_data.length / 8) - 1, 0)} />
                      <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="macd_histogram" name="Histogram" barSize={4}>
                        {currentStock.chart_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={(entry.macd_histogram ?? 0) >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.7} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="macd_signal" stroke="#f43f5e" name="Signal Line" dot={false} strokeWidth={2} strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="macd_line" stroke="#2563eb" name="MACD Line" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{macdChartExplanation}</p>
              </div>

              {/* Bollinger Bands */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg">Bollinger Bands (20, 2σ)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentStock.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }}
                        tickFormatter={(d) => d.slice(0, 7)}
                        interval={Math.max(Math.floor(currentStock.chart_data.length / 8) - 1, 0)} />
                      <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} tickFormatter={(v) => `₹${v.toFixed(0)}`} width={70} />
                      <Tooltip formatter={(val) => `₹${(val as number).toFixed(2)}`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="bb_upper" stroke="#f97316" name="Upper Band" dot={false} strokeWidth={1.5} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="bb_mid" stroke="#64748b" name="Middle Band" dot={false} strokeWidth={1} strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="bb_lower" stroke="#22c55e" name="Lower Band" dot={false} strokeWidth={1.5} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="close" stroke="#2563eb" name="Price" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{bbChartExplanation}</p>
              </div>

              {/* Score History Chart */}
              {currentStock.score_history && currentStock.score_history.length > 0 && (
                <div className="card space-y-3">
                  <h3 className="font-bold text-lg">Composite Score History (2 years)</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={currentStock.score_history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }}
                          tickFormatter={(d) => d.slice(0, 7)} interval={Math.max(Math.floor(currentStock.score_history.length / 8) - 1, 0)} />
                        <YAxis yAxisId="price" orientation="left" fontSize={11} tick={{ fill: "#94a3b8" }} tickFormatter={(v) => `₹${v.toFixed(0)}`} width={70} />
                        <YAxis yAxisId="score" orientation="right" domain={[0, 100]} fontSize={11} tick={{ fill: "#94a3b8" }} />
                        <Tooltip
                          formatter={(val, name) =>
                            name === "Score" ? (val as number).toFixed(1) : `₹${(val as number).toFixed(2)}`
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="price" type="monotone" dataKey="close" stroke="#2563eb" name="Price" dot={false} strokeWidth={2} />
                        <Area yAxisId="score" type="monotone" dataKey="score" stroke="#8b5cf6" fill="#8b5cf633" name="Score" dot={false} strokeWidth={2} />
                        <ReferenceLine yAxisId="score" y={65} stroke="#16a34a" strokeDasharray="5 5"
                          label={{ value: "Buy zone", fontSize: 10, fill: "#16a34a", position: "right" }} />
                        <ReferenceLine yAxisId="score" y={35} stroke="#ef4444" strokeDasharray="5 5"
                          label={{ value: "Avoid zone", fontSize: 10, fill: "#ef4444", position: "right" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{scoreHistoryChartExplanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Indicators Tab */}
          {activeTab === "indicators" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IndicatorCard name="RSI (14)" value={currentStock.indicators.rsi} interpretation={rsiExpl?.label || ""} indicator="rsi" />
              <IndicatorCard name="6-Month Momentum" value={currentStock.indicators.momentum_6m} interpretation={momentumExpl?.label || ""} indicator="momentum_6m" />
              <IndicatorCard name="200-Day MA" value={`₹${currentStock.indicators.ma200.value.toFixed(2)}`} interpretation={ma200Expl?.label || ""} indicator="ma200"
                meta={{ bull_regime: currentStock.indicators.ma200.bull_regime ? 1 : 0, pct_above: currentStock.indicators.ma200.pct_above }} />
              <IndicatorCard name="ATR (14)" value={currentStock.indicators.atr.value} interpretation={`${currentStock.indicators.atr.pct.toFixed(1)}% of price`} indicator="atr"
                meta={{ pct: currentStock.indicators.atr.pct }} />
              <IndicatorCard name="MACD Histogram" value={currentStock.indicators.macd.histogram} interpretation={macdExpl?.label || ""} indicator="macd"
                meta={{ histogram: currentStock.indicators.macd.histogram }} />
              <IndicatorCard name="Bollinger Bands %B" value={currentStock.indicators.bollinger_bands.pct_b} interpretation={bbExpl?.label || ""} indicator="bollinger_bands"
                meta={{ pct_b: currentStock.indicators.bollinger_bands.pct_b, mid: currentStock.indicators.bollinger_bands.mid }} />
              <IndicatorCard name="Volume Ratio" value={currentStock.indicators.volume_ratio} interpretation={`${currentStock.indicators.volume_ratio.toFixed(1)}x avg`} indicator="volume_ratio" />
              <IndicatorCard name="Day Change" value={currentStock.meta.day_change_pct}
                interpretation={`${currentStock.meta.day_change_pct > 0 ? "+" : ""}${currentStock.meta.day_change_pct.toFixed(2)}%`} indicator="volume_ratio" />
            </div>
          )}

          {/* Fundamentals Tab */}
          {activeTab === "fundamentals" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "P/E Ratio (TTM)", value: currentStock.fundamentals.pe_ratio != null ? currentStock.fundamentals.pe_ratio.toFixed(1) : "—", sub: "Price / Earnings" },
                  { label: "P/B Ratio", value: currentStock.fundamentals.pb_ratio != null ? currentStock.fundamentals.pb_ratio.toFixed(2) : "—", sub: "Price / Book Value" },
                  { label: "Market Cap", value: currentStock.fundamentals.market_cap != null ? `₹${(currentStock.fundamentals.market_cap / 1e7).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} Cr` : "—", sub: "Total market capitalisation" },
                  { label: "EPS (TTM)", value: currentStock.fundamentals.eps != null ? `₹${currentStock.fundamentals.eps.toFixed(2)}` : "—", sub: "Earnings per share" },
                  { label: "Dividend Yield", value: currentStock.fundamentals.dividend_yield != null ? `${(currentStock.fundamentals.dividend_yield * 100).toFixed(2)}%` : "—", sub: "Annual dividend / price" },
                  { label: "Avg. Volume", value: currentStock.fundamentals.avg_volume != null ? `${(currentStock.fundamentals.avg_volume / 1e6).toFixed(1)}M` : "—", sub: "Average daily volume" },
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

          {/* Entry Zone Tab */}
          {activeTab === "entry_zone" && currentStock.entry_zone && (
            <EntryZoneTab stock={currentStock} />
          )}

          {/* Backtest Tab */}
          {activeTab === "backtest" && (
            <BacktestTab ticker={currentStock.meta.ticker} />
          )}
        </>
      )}
    </div>
  );
};
