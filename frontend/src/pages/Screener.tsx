import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { apiClient } from "../api";
import { getVerdictColor } from "../explanations";
import { exportCsv } from "../utils/exportCsv";


export const Screener = () => {
  const navigate = useNavigate();
  const {
    screenerResults,
    setScreenerResults,
    screenerFilters,
    setScreenerFilters,
    loading,
    setLoading,
    error,
    setError,
  } = useStore();

  const [localFilters, setLocalFilters] = useState(screenerFilters);

  useEffect(() => {
    // Load results on mount if available
    if (screenerResults.length === 0) {
      handleScreening();
    }
  }, []);

  const handleScreening = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await apiClient.screenStocks(
        localFilters.minScore,
        localFilters.minRsi,
        localFilters.maxRsi,
        localFilters.regime
      );
      setScreenerResults(results);
      setScreenerFilters(localFilters);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (ticker: string) => {
    navigate(`/?ticker=${ticker}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stock Screener</h1>

      {/* Filters */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-lg">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Min Score */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Min Score: {localFilters.minScore}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={localFilters.minScore}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, minScore: parseInt(e.target.value) })
              }
              className="w-full"
            />
          </div>

          {/* Min RSI */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Min RSI: {localFilters.minRsi}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={localFilters.minRsi}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, minRsi: parseInt(e.target.value) })
              }
              className="w-full"
            />
          </div>

          {/* Max RSI */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Max RSI: {localFilters.maxRsi}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={localFilters.maxRsi}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, maxRsi: parseInt(e.target.value) })
              }
              className="w-full"
            />
          </div>

          {/* Regime */}
          <div>
            <label className="block text-sm font-semibold mb-2">Regime</label>
            <select
              value={localFilters.regime}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, regime: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
            >
              <option value="any">Any</option>
              <option value="bull">Bull</option>
              <option value="bear">Bear</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleScreening}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold"
        >
          {loading ? "Screening..." : "Run Screen"}
        </button>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-100 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          Screening stocks...
        </div>
      ) : screenerResults.length > 0 ? (
        <div className="card overflow-x-auto">
          <div className="flex justify-end mb-3">
            <button
              onClick={() => exportCsv("screener_results.csv", screenerResults.map((s) => ({
                Symbol: s.symbol,
                Score: s.score.toFixed(0),
                Verdict: s.verdict,
                Price: s.price.toFixed(2),
                RSI: s.rsi.toFixed(1),
                "6M Momentum %": s.momentum_6m.toFixed(2),
                Regime: s.regime,
                "Above 200-DMA": s.indicators.ma200.bull_regime ? "Yes" : "No",
              })))}
              className="px-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-700">
              <tr className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                <th className="text-left py-3 px-4">Symbol</th>
                <th className="text-left py-3 px-4">Score</th>
                <th className="text-left py-3 px-4">Verdict</th>
                <th className="text-right py-3 px-4">Price (₹)</th>
                <th className="text-right py-3 px-4">Day Chg %</th>
                <th className="text-right py-3 px-4">RSI</th>
                <th className="text-right py-3 px-4">6M Mom %</th>
                <th className="text-center py-3 px-4">Regime</th>
              </tr>
            </thead>
            <tbody>
              {screenerResults.map((stock) => (
                <tr
                  key={stock.symbol}
                  onClick={() => handleRowClick(stock.symbol)}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-semibold">{stock.symbol}</td>
                  <td className="py-3 px-4">
                    <div
                      className="inline-block px-3 py-1 rounded text-sm font-mono font-semibold text-white"
                      style={{ backgroundColor: getVerdictColor(stock.verdict) }}
                    >
                      {stock.score.toFixed(0)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{stock.verdict}</td>
                  <td className="py-3 px-4 text-right font-mono">{stock.price.toFixed(2)}</td>
                  <td
                    className={`py-3 px-4 text-right font-mono ${
                      stock.day_change_pct >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {stock.day_change_pct > 0 ? "+" : ""}
                    {stock.day_change_pct.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{stock.rsi.toFixed(1)}</td>
                  <td
                    className={`py-3 px-4 text-right font-mono ${
                      stock.momentum_6m >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {stock.momentum_6m > 0 ? "+" : ""}
                    {stock.momentum_6m.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: stock.regime === "Bull" ? "#16a34a33" : "#dc262633",
                        color: stock.regime === "Bull" ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {stock.regime}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          No results found. Try adjusting filters.
        </div>
      )}
    </div>
  );
};
