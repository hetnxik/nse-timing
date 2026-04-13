import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Analyser } from "./pages/Analyser";
import { Screener } from "./pages/Screener";
import { Compare } from "./pages/Compare";
import { Heatmap } from "./pages/Heatmap";
import { Education } from "./pages/Education";
import { PaperTrades } from "./pages/PaperTrades";
import { Replay } from "./pages/Replay";

export function App() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <nav className="border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="font-bold text-lg hover:text-blue-600">
                NSE Timing
              </Link>
              <div className="flex gap-6">
                <Link
                  to="/"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Analyser
                </Link>
                <Link
                  to="/screener"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Screener
                </Link>
                <Link
                  to="/compare"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Compare
                </Link>
                <Link
                  to="/heatmap"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Heatmap
                </Link>
                <Link
                  to="/education"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Education
                </Link>
                <Link
                  to="/paper-trades"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Paper Trades
                </Link>
                <Link
                  to="/replay"
                  className="text-sm hover:text-blue-600 transition-colors"
                >
                  Replay
                </Link>
              </div>
            </div>
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Analyser />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/education" element={<Education />} />
            <Route path="/paper-trades" element={<PaperTrades />} />
            <Route path="/replay" element={<Replay />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
