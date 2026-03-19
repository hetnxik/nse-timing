import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, HeatmapResult } from "../api";

const SECTOR_ORDER = ["IT", "Financials", "Energy", "Pharma", "Auto", "FMCG", "Infra", "Consumer", "Other"];

type ColorMode = "score" | "day_change";

function getTileColor(result: HeatmapResult, mode: ColorMode): string {
  if (mode === "score") {
    const s = result.score;
    if (s >= 75) return "#15803d";
    if (s >= 60) return "#16a34a";
    if (s >= 40) return "#b45309";
    return "#b91c1c";
  } else {
    const d = result.day_change_pct;
    if (d >= 2) return "#15803d";
    if (d >= 0.5) return "#16a34a";
    if (d >= -0.5) return "#b45309";
    if (d >= -2) return "#dc2626";
    return "#b91c1c";
  }
}

export const Heatmap = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<HeatmapResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("score");

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient.getHeatmap()
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = SECTOR_ORDER.reduce<Record<string, HeatmapResult[]>>((acc, sector) => {
    const stocks = data.filter((d) => d.sector === sector);
    if (stocks.length > 0) acc[sector] = stocks;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sector Heatmap</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setColorMode("score")}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
              colorMode === "score"
                ? "bg-blue-600 text-white"
                : "border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            By Score
          </button>
          <button
            onClick={() => setColorMode("day_change")}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
              colorMode === "day_change"
                ? "bg-blue-600 text-white"
                : "border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            By Day Change
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          Loading heatmap...
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-100 text-sm">
          {error}
        </div>
      )}

      {!loading && Object.entries(grouped).map(([sector, stocks]) => (
        <div key={sector} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {sector}
          </h2>
          <div className="flex flex-wrap gap-2">
            {stocks.map((stock) => {
              const bg = getTileColor(stock, colorMode);
              const label = colorMode === "score"
                ? `${stock.score.toFixed(0)}`
                : `${stock.day_change_pct > 0 ? "+" : ""}${stock.day_change_pct.toFixed(2)}%`;
              return (
                <button
                  key={stock.ticker}
                  onClick={() => navigate(`/?ticker=${stock.ticker.replace(".NS", "")}`)}
                  className="rounded p-3 text-left transition-opacity hover:opacity-80 min-w-[90px]"
                  style={{ backgroundColor: bg }}
                  title={`${stock.name}\nScore: ${stock.score.toFixed(0)} | ${stock.verdict}\n${stock.day_change_pct > 0 ? "+" : ""}${stock.day_change_pct.toFixed(2)}%`}
                >
                  <div className="text-white font-mono font-bold text-sm leading-tight">
                    {stock.ticker.replace(".NS", "")}
                  </div>
                  <div className="text-white text-xs opacity-90 font-mono mt-1">
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!loading && data.length > 0 && (
        <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
          {colorMode === "score" ? (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#15803d" }} /> ≥75</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#16a34a" }} /> ≥60</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#b45309" }} /> ≥40</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#b91c1c" }} /> &lt;40</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#15803d" }} /> ≥+2%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#16a34a" }} /> +0.5–2%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#b45309" }} /> ±0.5%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#dc2626" }} /> -0.5–-2%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "#b91c1c" }} /> ≤-2%</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
