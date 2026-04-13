import { useState, useEffect, useCallback } from "react";
import { apiClient, PaperTrade, AutoScanReport, EquityCurveResult, PostMortemResult } from "../api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

type LivePrices = Record<string, { price: number | null; day_change_pct: number | null }>;

function pnl(trade: PaperTrade, currentPrice: number | null): number | null {
  const exitP = trade.status === "closed" ? trade.exit_price : currentPrice;
  if (exitP == null) return null;
  return (exitP - trade.entry_price) * trade.quantity;
}

function pnlPct(trade: PaperTrade, currentPrice: number | null): number | null {
  const exitP = trade.status === "closed" ? trade.exit_price : currentPrice;
  if (exitP == null) return null;
  return ((exitP - trade.entry_price) / trade.entry_price) * 100;
}

function fmt(n: number | null, decimals = 2, prefix = ""): string {
  if (n == null) return "—";
  return `${prefix}${n.toFixed(decimals)}`;
}

function PnlCell({ value, pct }: { value: number | null; pct: number | null }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const pos = value >= 0;
  const cls = pos ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";
  return (
    <span className={cls}>
      {pos ? "+" : ""}₹{value.toFixed(0)}{" "}
      <span className="text-xs">({pos ? "+" : ""}{pct?.toFixed(1)}%)</span>
    </span>
  );
}

function CloseModal({
  trade,
  onClose,
  onConfirm,
}: {
  trade: PaperTrade;
  onClose: () => void;
  onConfirm: (exitPrice: number, exitDate: string) => void;
}) {
  const [exitPrice, setExitPrice] = useState(String(trade.exit_price ?? trade.entry_price));
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-80 shadow-xl border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-lg mb-4">Close Trade — {trade.ticker}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Exit Price (₹)</label>
            <input
              type="number"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Exit Date</label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
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
            onClick={() => onConfirm(parseFloat(exitPrice), exitDate)}
            className="flex-1 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function PaperTrades() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [livePrice, setLivePrice] = useState<LivePrices>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [closingTrade, setClosingTrade] = useState<PaperTrade | null>(null);
  const [detailTrade, setDetailTrade] = useState<PaperTrade | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");

  const fetchTrades = useCallback(async () => {
    const data = await apiClient.getTrades();
    setTrades(data);
    return data;
  }, []);

  const fetchPrices = useCallback(async (tradeList: PaperTrade[]) => {
    const openTickers = [...new Set(tradeList.filter((t) => t.status === "open").map((t) => t.ticker))];
    if (openTickers.length === 0) return;
    setLoadingPrices(true);
    try {
      const prices = await apiClient.getPrices(openTickers);
      setLivePrice(prices);
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades().then(fetchPrices);
  }, [fetchTrades, fetchPrices]);

  async function handleClose(trade: PaperTrade, exitPrice: number, exitDate: string) {
    await apiClient.updateTrade(trade.id, { exit_price: exitPrice, exit_date: exitDate, status: "closed" });
    const updated = await fetchTrades();
    fetchPrices(updated);
    setClosingTrade(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this trade?")) return;
    await apiClient.deleteTrade(id);
    const updated = await fetchTrades();
    fetchPrices(updated);
  }

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");

  // Summary stats
  const totalInvested = open.reduce((s, t) => s + t.entry_price * t.quantity, 0);
  const totalCurrentValue = open.reduce((s, t) => {
    const p = livePrice[t.ticker]?.price;
    return s + (p != null ? p * t.quantity : t.entry_price * t.quantity);
  }, 0);
  const unrealisedPnl = totalCurrentValue - totalInvested;

  const realisedPnls = closed.map((t) => pnl(t, null)).filter((v) => v != null) as number[];
  const realisedTotal = realisedPnls.reduce((s, v) => s + v, 0);
  const wins = closed.filter((t) => {
    const p = pnl(t, null);
    return p != null && p > 0;
  });
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : null;

  const pnlColor = (v: number) =>
    v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paper Trades</h1>

      {/* Auto Trade */}
      <AutoTradePanel onScanComplete={async () => {
        const updated = await fetchTrades();
        fetchPrices(updated);
      }} />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Open Positions" value={String(open.length)} />
        <SummaryCard
          label="Unrealised P&L"
          value={`${unrealisedPnl >= 0 ? "+" : ""}₹${unrealisedPnl.toFixed(0)}`}
          sub={totalInvested > 0 ? `${((unrealisedPnl / totalInvested) * 100).toFixed(1)}% on invested` : undefined}
          color={pnlColor(unrealisedPnl)}
        />
        <SummaryCard
          label="Realised P&L"
          value={`${realisedTotal >= 0 ? "+" : ""}₹${realisedTotal.toFixed(0)}`}
          sub={`${closed.length} closed trade${closed.length !== 1 ? "s" : ""}`}
          color={pnlColor(realisedTotal)}
        />
        <SummaryCard
          label="Win Rate"
          value={winRate != null ? `${winRate.toFixed(0)}%` : "—"}
          sub={closed.length > 0 ? `${wins.length}W / ${closed.length - wins.length}L` : "No closed trades"}
          color={winRate != null ? (winRate >= 50 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400") : ""}
        />
      </div>

      {/* Equity Curve */}
      {trades.length > 0 && <EquityCurvePanel tradesExist={trades.length > 0} />}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {t} ({t === "open" ? open.length : closed.length})
          </button>
        ))}
        {loadingPrices && (
          <span className="ml-auto text-xs text-slate-400 self-center">Fetching live prices…</span>
        )}
      </div>

      {/* Table */}
      {tab === "open" && (
        <TradeTable
          trades={open}
          livePrice={livePrice}
          onClose={(t) => setClosingTrade(t)}
          onDelete={handleDelete}
          showClose
          onView={setDetailTrade}
        />
      )}
      {tab === "closed" && (
        <TradeTable
          trades={closed}
          livePrice={livePrice}
          onClose={() => {}}
          onDelete={handleDelete}
          showClose={false}
          onView={setDetailTrade}
        />
      )}

      {/* Add Trade Button */}
      <div className="flex justify-end">
        <AddTradeButton onAdded={fetchTrades} />
      </div>

      {closingTrade && (
        <CloseModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={(price, date) => handleClose(closingTrade, price, date)}
        />
      )}

      {detailTrade && (
        <TradeDetailModal trade={detailTrade} onClose={() => setDetailTrade(null)} />
      )}
    </div>
  );
}

function TradeTable({
  trades,
  livePrice,
  onClose,
  onDelete,
  showClose,
  onView,
}: {
  trades: PaperTrade[];
  livePrice: LivePrices;
  onClose: (t: PaperTrade) => void;
  onDelete: (id: string) => void;
  showClose: boolean;
  onView?: (t: PaperTrade) => void;
}) {
  if (trades.length === 0) {
    return (
      <p className="text-slate-400 text-sm py-8 text-center">
        No {showClose ? "open" : "closed"} trades yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <th className="pb-2 pr-4">Ticker</th>
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4 text-right">Entry ₹</th>
            <th className="pb-2 pr-4 text-right">{showClose ? "Current ₹" : "Exit ₹"}</th>
            <th className="pb-2 pr-4 text-right">Qty</th>
            <th className="pb-2 pr-4 text-right">Stop ₹</th>
            <th className="pb-2 pr-4 text-right">Target ₹</th>
            <th className="pb-2 pr-4 text-right">Score</th>
            <th className="pb-2 pr-4 text-right">P&L</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {trades.map((t) => {
            const live = livePrice[t.ticker];
            const cp = showClose ? live?.price ?? null : t.exit_price;
            const pl = pnl(t, cp);
            const plp = pnlPct(t, cp);
            return (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 pr-4 font-semibold">
                  <button
                    onClick={() => onView?.(t)}
                    className="hover:text-blue-600 hover:underline cursor-pointer"
                  >
                    {t.ticker}
                  </button>
                </td>
                <td className="py-3 pr-4 text-slate-500 tabular-nums">
                  {t.entry_date}
                  {!showClose && t.exit_date && (
                    <div className="text-xs text-slate-400">{t.exit_date}</div>
                  )}
                </td>
                <td className="py-3 pr-4 text-right font-mono">₹{t.entry_price.toFixed(2)}</td>
                <td className="py-3 pr-4 text-right font-mono">
                  {cp != null ? (
                    <>
                      ₹{cp.toFixed(2)}
                      {showClose && live?.day_change_pct != null && (
                        <span className={`ml-1 text-xs ${live.day_change_pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {live.day_change_pct >= 0 ? "+" : ""}{live.day_change_pct.toFixed(1)}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right font-mono">{t.quantity}</td>
                <td className="py-3 pr-4 text-right font-mono text-red-500">
                  {fmt(t.stop_loss, 2, "₹")}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-green-600">
                  {fmt(t.target, 2, "₹")}
                </td>
                <td className="py-3 pr-4 text-right text-slate-400 tabular-nums">
                  {t.entry_score != null ? t.entry_score.toFixed(0) : "—"}
                </td>
                <td className="py-3 pr-4 text-right font-mono whitespace-nowrap">
                  <PnlCell value={pl} pct={plp} />
                </td>
                <td className="py-3 whitespace-nowrap flex gap-2 justify-end">
                  {showClose && (
                    <button
                      onClick={() => onClose(t)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(t.id)}
                    className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Del
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Auto Trade Panel ──────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  stop_loss: "Stop Hit",
  target: "Target Reached",
  regime_change: "Regime Change",
  time_stop: "Time Stop (6M)",
};

function AutoTradePanel({ onScanComplete }: { onScanComplete: () => void }) {
  const [portfolioSize, setPortfolioSize] = useState("1000000");
  const [riskPct, setRiskPct] = useState("1");
  const [maxPositions, setMaxPositions] = useState("6");
  const [dryRun, setDryRun] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<AutoScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Screener filters
  const [minScore, setMinScore] = useState("0");
  const [minRsi, setMinRsi] = useState("0");
  const [maxRsi, setMaxRsi] = useState("100");
  const [regime, setRegime] = useState<"any" | "bull" | "bear">("any");
  // MDC Strategy thresholds
  const [mdcMinScore, setMdcMinScore] = useState("65");
  const [mdcMinRsi, setMdcMinRsi] = useState("25");
  const [mdcMaxRsi, setMdcMaxRsi] = useState("55");
  const [mdcMinMomentum, setMdcMinMomentum] = useState("5");
  const [mdcMinHighRatio, setMdcMinHighRatio] = useState("0.65");
  const [mdcMaxPctB, setMdcMaxPctB] = useState("0.55");

  async function handleScan() {
    setScanning(true);
    setError(null);
    setReport(null);
    try {
      const result = await apiClient.runAutoScan({
        portfolio_size: parseFloat(portfolioSize),
        risk_per_trade: parseFloat(riskPct) / 100,
        max_positions: parseInt(maxPositions),
        max_position_pct: 0.15,
        dry_run: dryRun,
        min_score: parseInt(minScore),
        min_rsi: parseInt(minRsi),
        max_rsi: parseInt(maxRsi),
        regime,
        mdc_min_score: parseInt(mdcMinScore),
        mdc_min_rsi: parseInt(mdcMinRsi),
        mdc_max_rsi: parseInt(mdcMaxRsi),
        mdc_min_momentum: parseFloat(mdcMinMomentum),
        mdc_min_high_ratio: parseFloat(mdcMinHighRatio),
        mdc_max_pct_b: parseFloat(mdcMaxPctB),
      });
      setReport(result);
      if (!dryRun) onScanComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">MDC Auto-Trade</span>
          <span className="text-xs text-slate-400">Momentum-Dip Composite Strategy</span>
        </div>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-5 space-y-5 bg-white dark:bg-slate-900">
          {/* Strategy Config */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Strategy Config</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Portfolio Size (₹)</label>
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
                  value={riskPct}
                  step="0.1"
                  onChange={(e) => setRiskPct(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Max Positions</label>
                <input
                  type="number"
                  value={maxPositions}
                  onChange={(e) => setMaxPositions(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded"
                  />
                  <span>Dry run only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Screener Filters */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Screener Filters</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Min Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Min RSI</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minRsi}
                  onChange={(e) => setMinRsi(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Max RSI</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={maxRsi}
                  onChange={(e) => setMaxRsi(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Regime</label>
                <select
                  value={regime}
                  onChange={(e) => setRegime(e.target.value as "any" | "bull" | "bear")}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="any">Any</option>
                  <option value="bull">Bull Only</option>
                  <option value="bear">Bear Only</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    setMinScore("0");
                    setMinRsi("0");
                    setMaxRsi("100");
                    setRegime("any");
                  }}
                  className="text-xs px-3 py-2 rounded border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  Reset: Relaxed
                </button>
                <button
                  onClick={() => {
                    setMinScore("60");
                    setMinRsi("25");
                    setMaxRsi("55");
                    setRegime("bull");
                  }}
                  className="text-xs px-3 py-2 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Preset: MDC Optimal
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
              <span>Relaxed: Score ≥0, RSI 0-100, Any regime</span>
              <span>|</span>
              <span>MDC Optimal: Score ≥60, RSI 25-55, Bull only</span>
            </div>
          </div>

          {/* MDC Strategy Thresholds */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">MDC Entry Thresholds</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Min Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={mdcMinScore}
                  onChange={(e) => setMdcMinScore(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Min RSI</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={mdcMinRsi}
                  onChange={(e) => setMdcMinRsi(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Max RSI</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={mdcMaxRsi}
                  onChange={(e) => setMdcMaxRsi(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Min Momentum %</label>
                <input
                  type="number"
                  step="0.1"
                  value={mdcMinMomentum}
                  onChange={(e) => setMdcMinMomentum(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Min 52W Ratio</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={mdcMinHighRatio}
                  onChange={(e) => setMdcMinHighRatio(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Max %B</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={mdcMaxPctB}
                  onChange={(e) => setMdcMaxPctB(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
              <span>Defaults: Score ≥65, RSI 25-55, Mom &gt;5%, 52W &gt;0.65, %B &lt;0.55</span>
              <button
                onClick={() => {
                  setMdcMinScore("65");
                  setMdcMinRsi("25");
                  setMdcMaxRsi("55");
                  setMdcMinMomentum("5");
                  setMdcMinHighRatio("0.65");
                  setMdcMaxPctB("0.55");
                }}
                className="text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Reset to Optimal
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleScan}
              disabled={scanning}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-colors ${
                scanning ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {scanning ? "Scanning…" : "Run MDC Scan"}
            </button>
            {dryRun && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Dry run — no trades will be logged
              </span>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {report && <ScanReport report={report} />}
        </div>
      )}
    </div>
  );
}

function ScanReport({ report }: { report: AutoScanReport }) {
  const { entries, exits, skipped, summary } = report;

  return (
    <div className="space-y-4 text-sm">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
        <span><strong>{summary.stocks_scanned ?? 30}</strong> stocks scanned</span>
        <span className="text-green-600 dark:text-green-400"><strong>{summary.new_entries ?? entries.length}</strong> entries</span>
        <span className="text-amber-600 dark:text-amber-400"><strong>{summary.exits ?? exits.length}</strong> exits</span>
        <span className="text-slate-400"><strong>{skipped.length}</strong> skipped</span>
        {summary.message && <span className="text-slate-500">{summary.message}</span>}
        {entries.length > 0 && entries[0].dry_run && (
          <span className="ml-auto text-amber-600 font-semibold">DRY RUN — nothing logged</span>
        )}
      </div>

      {/* Entries */}
      {entries.length > 0 && (
        <div>
          <p className="font-semibold text-green-700 dark:text-green-400 mb-2">New Entries</p>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.ticker} className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{e.ticker}</span>
                  <span className="text-xs text-slate-500">Score {e.score} · {e.quantity} shares · ₹{e.position_value.toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>Entry ₹{e.entry_price}</span>
                  <span className="text-red-500">Stop ₹{e.stop_loss}</span>
                  <span className="text-green-600">Target ₹{e.target}</span>
                  <span>Risk ₹{e.risk_amount.toLocaleString()}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.signals_passed.map((s, i) => (
                    <span key={i} className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exits */}
      {exits.length > 0 && (
        <div>
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-2">Exits Triggered</p>
          <div className="space-y-2">
            {exits.map((e, i) => (
              <div key={i} className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{e.ticker}</span>
                  <span className={`font-mono font-semibold text-sm ${e.pnl_pct >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {e.pnl_pct >= 0 ? "+" : ""}{e.pnl_pct}%
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {REASON_LABELS[e.reason] ?? e.reason} · Entry ₹{e.entry_price} → Exit ₹{e.exit_price}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{e.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped accordion */}
      {skipped.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            {skipped.length} stocks skipped (expand)
          </summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {skipped.map((s, i) => (
              <div key={i} className="flex gap-2 text-slate-500">
                <span className="font-mono w-28 shrink-0">{s.ticker}</span>
                <span>{s.reason}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Equity Curve Panel ────────────────────────────────────────────────────────

function EquityCurvePanel({
  tradesExist,
}: {
  tradesExist: boolean;
}) {
  const [portfolioSize, setPortfolioSize] = useState("1000000");
  const [curve, setCurve] = useState<EquityCurveResult["curve"]>([]);
  const [stats, setStats] = useState<EquityCurveResult["stats"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurve = useCallback(async () => {
    if (!tradesExist) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getEquityCurve(parseFloat(portfolioSize));
      setCurve(result.curve);
      setStats(result.stats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load equity curve");
    } finally {
      setLoading(false);
    }
  }, [portfolioSize, tradesExist]);

  useEffect(() => {
    fetchCurve();
  }, [fetchCurve]);

  if (!tradesExist) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-slate-50 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="font-semibold">Equity Curve</h3>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Initial Portfolio (₹)</label>
            <input
              type="number"
              value={portfolioSize}
              onChange={(e) => setPortfolioSize(e.target.value)}
              className="w-32 border border-slate-300 dark:border-slate-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <button
            onClick={fetchCurve}
            disabled={loading}
            className="mt-5 px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">Total Return</p>
            <p className={`text-lg font-bold font-mono ${(stats.total_return_pct ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
              {(stats.total_return_pct ?? 0) >= 0 ? "+" : ""}
              {(stats.total_return_pct ?? 0).toFixed(1)}%
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">Benchmark (Nifty)</p>
            <p className={`text-lg font-bold font-mono ${(stats.benchmark_return_pct ?? 0) >= 0 ? "text-blue-600" : "text-red-500"}`}>
              {stats.benchmark_return_pct != null ? `${(stats.benchmark_return_pct >= 0 ? "+" : "")}${stats.benchmark_return_pct.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">Alpha</p>
            <p className={`text-lg font-bold font-mono ${(stats.alpha_pct ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
              {stats.alpha_pct != null ? `${(stats.alpha_pct >= 0 ? "+" : "")}${stats.alpha_pct.toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">Max Drawdown</p>
            <p className="text-lg font-bold font-mono text-red-500">
              {stats.max_drawdown_pct != null ? `${stats.max_drawdown_pct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      )}

      {curve.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d) => d.slice(0, 7)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `₹${value.toLocaleString()}`,
                  name === "portfolio" ? "Portfolio" : "Nifty 50",
                ]}
                labelFormatter={(label) => label}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="portfolio"
                name="Portfolio"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {curve.some((d) => d.benchmark != null) && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="Nifty 50"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-slate-400 py-8 text-center">No equity curve data available yet.</p>
      )}
    </div>
  );
}

// ── Manual Trade Creation ─────────────────────────────────────────────────────

function AddTradeButton({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ticker || !entryPrice || !quantity) {
      setError("Ticker, entry price, and quantity are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.createTrade({
        ticker: ticker.toUpperCase(),
        entry_price: parseFloat(entryPrice),
        entry_date: entryDate,
        quantity: parseFloat(quantity),
        stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
        target: target ? parseFloat(target) : undefined,
        notes: notes || undefined,
      });
      setOpen(false);
      setTicker("");
      setEntryPrice("");
      setQuantity("");
      setStopLoss("");
      setTarget("");
      setNotes("");
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create trade");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
      >
        + Add Trade
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-lg mb-4">Add Paper Trade</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Ticker</label>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="RELIANCE.NS"
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800 uppercase"
              />
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Entry Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Stop Loss (₹) <span className="text-slate-400">(optional)</span></label>
              <input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target (₹) <span className="text-slate-400">(optional)</span></label>
              <input
                type="number"
                step="0.01"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Notes <span className="text-slate-400">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-2 rounded border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Add Trade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Trade Detail Modal (Post-Mortem) ──────────────────────────────────────────

function TradeDetailModal({
  trade,
  onClose,
}: {
  trade: PaperTrade;
  onClose: () => void;
}) {
  const [postMortem, setPostMortem] = useState<PostMortemResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(trade.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient
      .getPostMortem(trade.id)
      .then(setPostMortem)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [trade.id]);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await apiClient.updateTradeNotes(trade.id, notes);
    } catch (e) {
      // ignore
    } finally {
      setSavingNotes(false);
    }
  }

  const pnlAbs =
    trade.status === "closed" && trade.exit_price
      ? (trade.exit_price - trade.entry_price) * trade.quantity
      : null;
  const pnlPct = pnlAbs != null ? ((trade.exit_price! - trade.entry_price) / trade.entry_price) * 100 : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold">{trade.ticker}</h2>
            <p className="text-sm text-slate-500">
              {trade.entry_date} → {trade.exit_date || "Open"} · {trade.status === "closed" ? "Closed" : "Open"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {pnlAbs != null && (
              <span className={`text-2xl font-bold font-mono ${pnlAbs >= 0 ? "text-green-600" : "text-red-500"}`}>
                {pnlAbs >= 0 ? "+" : ""}₹{pnlAbs.toFixed(0)} ({pnlPct != null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : "—"})
              </span>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading && <p className="text-slate-500">Loading analysis…</p>}
          {error && <p className="text-red-500">{error}</p>}

          {postMortem && (
            <>
              {/* Hold Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Days Held" value={String(postMortem.hold_stats.days_held)} />
                <StatCard
                  label="Max Gain"
                  value={`+${postMortem.hold_stats.max_gain_pct.toFixed(1)}%`}
                  color="text-green-600"
                />
                <StatCard
                  label="Max Drawdown"
                  value={`${postMortem.hold_stats.max_drawdown_pct.toFixed(1)}%`}
                  color="text-red-500"
                />
                <StatCard
                  label="Benchmark"
                  value={
                    postMortem.benchmark_return_pct != null
                      ? `${postMortem.benchmark_return_pct >= 0 ? "+" : ""}${postMortem.benchmark_return_pct.toFixed(1)}%`
                      : "—"
                  }
                  color={
                    postMortem.benchmark_return_pct != null && postMortem.benchmark_return_pct >= 0
                      ? "text-blue-600"
                      : "text-slate-400"
                  }
                />
              </div>

              {/* Entry Snapshot */}
              {postMortem.entry_snapshot && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 mb-2">Entry Snapshot</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span>Score: <strong>{Math.round(postMortem.entry_snapshot.score)}</strong></span>
                    <span>Verdict: <strong>{postMortem.entry_snapshot.verdict}</strong></span>
                    <span>
                      RSI: <strong>{(postMortem.entry_snapshot.indicators as Record<string, number>).rsi?.toFixed(1) ?? "—"}</strong>
                    </span>
                    <span>
                      Momentum: <strong>{(postMortem.entry_snapshot.indicators as Record<string, number>).momentum_6m?.toFixed(1) ?? "—"}%</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Mini Chart */}
              {postMortem.chart_data.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Trade Period Chart</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={postMortem.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" hide />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, "Close"]} labelFormatter={(l) => l} />
                        <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2} dot={false} />
                        {/* Entry price line */}
                        <ReferenceLine
                          y={trade.entry_price}
                          stroke="#22c55e"
                          strokeDasharray="3 3"
                          label={{ value: `Entry ₹${trade.entry_price}`, position: "insideTopLeft", fontSize: 10 }}
                        />
                        {/* Exit price line (if closed) */}
                        {trade.status === "closed" && trade.exit_price && (
                          <ReferenceLine
                            y={trade.exit_price}
                            stroke="#ef4444"
                            strokeDasharray="3 3"
                            label={{ value: `Exit ₹${trade.exit_price}`, position: "insideBottomLeft", fontSize: 10 }}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Journal Notes */}
              <div>
                <label className="text-xs text-slate-500 block mb-2">Journal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  placeholder="Add your observations, lessons learned, etc."
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingNotes ? "Saving…" : "Save Notes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${color ?? "text-slate-900 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}
