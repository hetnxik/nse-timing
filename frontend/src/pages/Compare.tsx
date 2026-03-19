import { useState } from "react";
import { useStore } from "../store";
import { apiClient, CompareStock } from "../api";
import { ScoreGauge } from "../components/ScoreGauge";

const STOCKS_LIST = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN",
  "BAJFINANCE", "KOTAKBANK", "LT", "WIPRO", "TITAN", "AXISBANK", "ASIANPAINT",
  "MARUTI", "NESTLEIND", "ULTRACEMCO", "POWERGRID", "NTPC", "SUNPHARMA",
  "DRREDDY", "DIVISLAB", "CIPLA", "TECHM", "HCLTECH", "INDUSINDBK", "M&M",
  "TATAMOTORS", "ONGC", "BPCL",
];

export const Compare = () => {
  const { compareList, addToCompare, removeFromCompare, clearCompare } = useStore();
  const [results, setResults] = useState<CompareStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const handleAddStock = () => {
    if (input.trim() && compareList.length < 4) {
      const ticker = input.trim().toUpperCase();
      addToCompare(ticker.endsWith(".NS") ? ticker : `${ticker}.NS`);
      setInput("");
    }
  };

  const handleCompare = async () => {
    if (compareList.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.compareStocks(compareList);
      setResults(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compare Stocks</h1>

      {/* Input Section */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Add Stocks ({compareList.length}/4)</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter ticker..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
            className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono text-sm"
            disabled={compareList.length >= 4}
          />
          <button
            onClick={handleAddStock}
            disabled={compareList.length >= 4 || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Quick picks */}
        <div className="flex flex-wrap gap-2">
          {STOCKS_LIST.map((stock) => (
            <button
              key={stock}
              onClick={() => {
                const ticker = `${stock}.NS`;
                if (compareList.includes(ticker)) {
                  removeFromCompare(ticker);
                } else if (compareList.length < 4) {
                  addToCompare(ticker);
                }
              }}
              className={`px-2 py-1 text-xs border rounded transition-colors ${
                compareList.includes(`${stock}.NS`)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              disabled={
                compareList.length >= 4 && !compareList.includes(`${stock}.NS`)
              }
            >
              {stock}
            </button>
          ))}
        </div>

        {/* Selected Stocks */}
        {compareList.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="font-semibold text-sm mb-3">Selected:</h3>
            <div className="flex flex-wrap gap-2">
              {compareList.map((ticker) => (
                <div
                  key={ticker}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded"
                >
                  <span className="font-mono text-sm">{ticker}</span>
                  <button
                    onClick={() => removeFromCompare(ticker)}
                    className="text-slate-500 hover:text-red-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCompare}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Comparing..." : "Compare"}
              </button>
              <button
                onClick={clearCompare}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-100 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Score Cards */}
          <div>
            <h2 className="font-semibold text-lg mb-4">Scores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {results.map((stock) => (
                <div key={stock.symbol} className="card flex flex-col items-center gap-2">
                  <h3 className="font-bold text-sm font-mono">{stock.symbol}</h3>
                  <ScoreGauge score={stock.score} verdict={stock.verdict} />
                  <div className="text-xs text-center mt-2 text-slate-600 dark:text-slate-400">
                    {stock.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Indicators Comparison Table */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Indicators Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold">Indicator</th>
                    {results.map((stock) => (
                      <th
                        key={stock.symbol}
                        className="text-right py-2 px-3 font-mono font-semibold"
                      >
                        {stock.symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">RSI</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        {stock.rsi.toFixed(1)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">6M Momentum %</td>
                    {results.map((stock) => (
                      <td
                        key={stock.symbol}
                        className={`text-right py-2 px-3 font-mono ${
                          stock.momentum_6m >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {stock.momentum_6m > 0 ? "+" : ""}
                        {stock.momentum_6m.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">MA200 %B</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        {stock.indicators.ma200.pct_above.toFixed(1)}%
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">200-DMA Value</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        ₹{stock.indicators.ma200.value.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">MACD Hist</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        {stock.indicators.macd.histogram.toFixed(3)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">BB %B</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        {stock.indicators.bollinger_bands.pct_b.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-semibold">ATR %</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        {stock.indicators.atr.pct.toFixed(2)}%
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-2 px-3 font-semibold">Volume Ratio</td>
                    {results.map((stock) => (
                      <td key={stock.symbol} className="text-right py-2 px-3 font-mono">
                        {stock.indicators.volume_ratio.toFixed(2)}x
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signal Breakdown */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Signal Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {results.map((stock: CompareStock) => {
                const bullish = stock.signals.filter((s: { type: string }) => s.type === "bullish").length;
                const bearish = stock.signals.filter((s: { type: string }) => s.type === "bearish").length;
                const neutral = stock.signals.filter((s: { type: string }) => s.type === "neutral").length;

                return (
                  <div key={stock.symbol} className="stat-card">
                    <div className="text-sm font-bold font-mono mb-3">{stock.symbol}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-600 dark:text-green-400">Bullish</span>
                        <span className="font-mono font-semibold">{bullish}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Neutral</span>
                        <span className="font-mono font-semibold">{neutral}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-600 dark:text-red-400">Bearish</span>
                        <span className="font-mono font-semibold">{bearish}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
