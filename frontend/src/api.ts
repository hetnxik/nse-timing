import axios from "axios";

const API_BASE = "http://localhost:8000";

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
};
