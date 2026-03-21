import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface StockData {
  meta: {
    ticker: string;
    name: string;
    current_price: number;
    day_change_pct: number;
    high_52w: number;
    low_52w: number;
    exchange: string;
    data_source: "live" | "mock";
  };
  indicators: {
    rsi: number;
    macd: {
      line: number;
      signal: number;
      histogram: number;
    };
    bollinger_bands: {
      upper: number;
      mid: number;
      lower: number;
      pct_b: number;
    };
    momentum_6m: number;
    ma200: {
      value: number;
      pct_above: number;
      bull_regime: boolean;
    };
    atr: {
      value: number;
      pct: number;
    };
    volume_ratio: number;
  };
  signals: Array<{
    type: "bullish" | "bearish" | "neutral";
    title: string;
    description: string;
  }>;
  score: {
    value: number;
    verdict: string;
  };
  chart_data: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    rsi?: number | null;
    macd_line?: number | null;
    macd_signal?: number | null;
    macd_histogram?: number | null;
    bb_upper?: number | null;
    bb_mid?: number | null;
    bb_lower?: number | null;
    ma200?: number | null;
  }>;
  fundamentals: {
    pe_ratio: number | null;
    pb_ratio: number | null;
    market_cap: number | null;
    eps: number | null;
    dividend_yield: number | null;
    sector: string | null;
    industry: string | null;
    avg_volume: number | null;
  };
  support_resistance: {
    support: number[];
    resistance: number[];
  };
  entry_zone: {
    ideal_entry_low: number;
    ideal_entry_high: number;
    entry_note: string;
    stop_atr: number;
    stop_atr_pct: number;
    stop_atr_label: string;
    stop_bb: number;
    stop_bb_pct: number;
    stop_bb_label: string;
    target_bb_upper: number;
    target_bb_upper_pct: number;
    target_52w_high: number;
    target_52w_high_pct: number;
    target_momentum: number;
    target_momentum_pct: number;
    rr_matrix: Record<string, { rr: number; quality: "poor" | "acceptable" | "good" }>;
    position_size_atr: number;
    position_size_bb: number;
  };
  score_history: Array<{ date: string; close: number; score: number }>;
}

export interface BacktestSignal {
  signal_date: string;
  signal_price: number;
  signal_score: number;
  signal_type: "strong" | "moderate";
  outcome_price_63d: number | null;
  outcome_price_126d: number | null;
  return_3m: number | null;
  return_6m: number | null;
  hit_stop_atr: boolean;
  max_drawdown_pct: number;
}

export interface BacktestResult {
  ticker: string;
  signals: BacktestSignal[];
  stats: {
    total_signals: number;
    signals_with_6m_outcome: number;
    win_rate_6m: number | null;
    avg_return_6m: number | null;
    median_return_6m: number | null;
    avg_max_drawdown: number | null;
    best_signal: BacktestSignal | null;
    worst_signal: BacktestSignal | null;
  };
  score_history: Array<{ date: string; close: number; score: number }>;
}

export interface CompareStock {
  symbol: string;
  name: string;
  score: number;
  verdict: string;
  price: number;
  rsi: number;
  momentum_6m: number;
  above_200dma: boolean;
  indicators: StockData["indicators"];
  signals: StockData["signals"];
}

export interface ScreenResult {
  symbol: string;
  name: string;
  score: number;
  verdict: string;
  price: number;
  day_change_pct: number;
  rsi: number;
  momentum_6m: number;
  regime: string;
  indicators: StockData["indicators"];
}

export interface HeatmapResult {
  ticker: string;
  name: string;
  sector: string;
  score: number;
  verdict: string;
  day_change_pct: number;
  current_price: number;
}

export const apiClient = {
  async getStock(ticker: string): Promise<StockData> {
    const { data } = await axios.get(`${API_BASE}/api/stock/${ticker}`);
    return data;
  },

  async compareStocks(tickers: string[]): Promise<CompareStock[]> {
    const tickerString = tickers.join(",");
    const { data } = await axios.get(`${API_BASE}/api/compare?tickers=${tickerString}`);
    return data;
  },

  async screenStocks(
    minScore: number = 60,
    minRsi: number = 0,
    maxRsi: number = 100,
    regime: string = "any"
  ): Promise<ScreenResult[]> {
    const { data } = await axios.get(`${API_BASE}/api/screen`, {
      params: {
        min_score: minScore,
        min_rsi: minRsi,
        max_rsi: maxRsi,
        regime,
      },
    });
    return data;
  },

  async getHeatmap(): Promise<HeatmapResult[]> {
    const { data } = await axios.get(`${API_BASE}/api/heatmap`);
    return data;
  },

  async getBacktest(ticker: string): Promise<BacktestResult> {
    const { data } = await axios.get(`${API_BASE}/api/backtest/${ticker}`);
    return data;
  },
};
