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

export interface PaperTrade {
  id: string;
  ticker: string;
  entry_price: number;
  entry_date: string;
  quantity: number;
  stop_loss: number | null;
  target: number | null;
  notes: string | null;
  entry_score: number | null;
  status: "open" | "closed";
  exit_price: number | null;
  exit_date: string | null;
}

export interface TradeCreate {
  ticker: string;
  entry_price: number;
  entry_date: string;
  quantity: number;
  stop_loss?: number | null;
  target?: number | null;
  notes?: string | null;
  entry_score?: number | null;
}

export interface TradeUpdate {
  exit_price?: number | null;
  exit_date?: string | null;
  stop_loss?: number | null;
  target?: number | null;
  notes?: string | null;
  status?: string;
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

  async getTrades(): Promise<PaperTrade[]> {
    const { data } = await axios.get(`${API_BASE}/api/trades`);
    return data;
  },

  async createTrade(trade: TradeCreate): Promise<PaperTrade> {
    const { data } = await axios.post(`${API_BASE}/api/trades`, trade);
    return data;
  },

  async updateTrade(id: string, update: TradeUpdate): Promise<PaperTrade> {
    const { data } = await axios.put(`${API_BASE}/api/trades/${id}`, update);
    return data;
  },

  async deleteTrade(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/api/trades/${id}`);
  },

  async getPrices(tickers: string[]): Promise<Record<string, { price: number | null; day_change_pct: number | null }>> {
    const { data } = await axios.get(`${API_BASE}/api/prices`, { params: { tickers: tickers.join(",") } });
    return data;
  },

  async runAutoScan(config: {
    portfolio_size: number;
    risk_per_trade: number;
    max_positions: number;
    max_position_pct: number;
    dry_run: boolean;
    min_score?: number;
    min_rsi?: number;
    max_rsi?: number;
    regime?: "any" | "bull" | "bear";
    mdc_min_score?: number;
    mdc_min_rsi?: number;
    mdc_max_rsi?: number;
    mdc_min_momentum?: number;
    mdc_min_high_ratio?: number;
    mdc_max_pct_b?: number;
  }): Promise<AutoScanReport> {
    const { data } = await axios.post(`${API_BASE}/api/auto-trade/scan`, config);
    return data;
  },

  async getEquityCurve(portfolioSize: number = 1000000): Promise<EquityCurveResult> {
    const { data } = await axios.get(`${API_BASE}/api/portfolio/equity-curve`, {
      params: { portfolio_size: portfolioSize },
    });
    return data;
  },

  async getPostMortem(tradeId: string): Promise<PostMortemResult> {
    const { data } = await axios.get(`${API_BASE}/api/trades/${tradeId}/post-mortem`);
    return data;
  },

  async updateTradeNotes(tradeId: string, notes: string): Promise<PaperTrade> {
    const { data } = await axios.put(`${API_BASE}/api/trades/${tradeId}/notes`, { journal_notes: notes });
    return data;
  },

  async getReplay(
    ticker: string,
    portfolioSize: number = 1000000,
    riskPct: number = 0.01,
    strategyParams?: Partial<ReplayStrategyParams>
  ): Promise<ReplayResult> {
    const params: Record<string, unknown> = {
      portfolio_size: portfolioSize,
      risk_pct: riskPct,
      ...strategyParams,
    };
    const { data } = await axios.get(`${API_BASE}/api/replay/${ticker}`, { params });
    return data;
  },

  async getReplayAll(
    portfolioSize: number = 1000000,
    riskPct: number = 0.01,
    strategyParams?: Partial<ReplayStrategyParams>
  ): Promise<{
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
    per_stock: Array<{
      ticker: string;
      total_trades: number;
      win_rate: number | null;
      total_return_pct: number;
      final_value: number;
    }>;
    top_performers: Array<{
      ticker: string;
      total_trades: number;
      win_rate: number | null;
      total_return_pct: number;
      final_value: number;
    }>;
    bottom_performers: Array<{
      ticker: string;
      total_trades: number;
      win_rate: number | null;
      total_return_pct: number;
      final_value: number;
    }>;
    failed: Array<{ ticker: string; error: string }>;
  }> {
    const params: Record<string, unknown> = {
      portfolio_size: portfolioSize,
      risk_pct: riskPct,
      ...strategyParams,
    };
    const { data } = await axios.get(`${API_BASE}/api/replay-all`, { params });
    return data;
  },
};

export interface AutoScanReport {
  scan_date: string;
  config: Record<string, unknown>;
  exits: Array<{
    ticker: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
    reason: string;
    description: string;
    dry_run: boolean;
  }>;
  entries: Array<{
    ticker: string;
    entry_price: number;
    quantity: number;
    stop_loss: number;
    target: number;
    score: number;
    signals_passed: string[];
    position_value: number;
    risk_amount: number;
    dry_run: boolean;
  }>;
  skipped: Array<{
    ticker: string;
    reason: string;
  }>;
  summary: {
    exits: number;
    new_entries: number;
    open_positions_after: number;
    stocks_scanned: number;
    universe_filtered_from?: number;
    live_data_failures?: number;
    message?: string;
  };
  live_data_errors?: Array<{ ticker: string; error: string }>;
  note?: string;
}

export interface EquityCurveResult {
  curve: Array<{ date: string; portfolio: number; benchmark: number | null }>;
  stats: {
    total_return_pct: number;
    benchmark_return_pct: number | null;
    alpha_pct: number | null;
    max_drawdown_pct: number;
    days_tracked: number;
    portfolio_value: number;
  };
}

export interface PostMortemResult {
  trade: PaperTrade;
  entry_snapshot: {
    indicators: Record<string, unknown>;
    score: number;
    verdict: string;
  } | null;
  exit_snapshot: {
    indicators: Record<string, unknown>;
    score: number;
    verdict: string;
  } | null;
  hold_stats: {
    days_held: number;
    max_gain_pct: number;
    max_drawdown_pct: number;
    pnl_pct: number;
    pnl_abs: number;
  };
  chart_data: Array<{ date: string; close: number }>;
  benchmark_return_pct: number | null;
}

export interface ReplayStrategyParams {
  entry_score: number;
  entry_rsi_min: number;
  entry_rsi_max: number;
  entry_momentum_min: number;
  entry_high_ratio_min: number;
  entry_pct_b_max: number;
  require_bull_regime: boolean;
  exit_score_threshold: number;
  exit_max_days: number;
  stop_atr_mult: number;
 reentry_cooldown_days: number;
  // Win rate filter
  win_rate_filter_enabled: boolean;
  win_rate_min_trades: number;
  win_rate_threshold: number;
  win_rate_penalty_score: number;
  // Circuit breaker
  circuit_breaker_enabled: boolean;
  circuit_breaker_consecutive_stops: number;
  circuit_breaker_pause_days: number;
}

export interface ReplayTimelineEntry {
  date: string;
  price: number;
  score: number;
  rsi: number;
  momentum_6m: number;
  pct_b: number;
  bull_regime: boolean;
  high_ratio: number;
  conditions: Record<string, boolean>;
  all_passed: boolean;
  action: "entry" | "exit_stop" | "exit_target" | "exit_regime" | "exit_time" | null;
  position: { entry_price: number; pnl_pct: number; days_held: number } | null;
  portfolio_value: number;
}

export interface ReplayResult {
  ticker: string;
  timeline: ReplayTimelineEntry[];
  trades: Array<{
    entry_date: string;
    exit_date: string;
    entry_price: number;
    exit_price: number;
    pnl_pct: number;
    exit_reason: string;
  }>;
  stats: {
    total_trades: number;
    closed_trades: number;
    win_rate: number | null;
    avg_return: number | null;
    best_trade: number | null;
    worst_trade: number | null;
    final_value: number;
    total_return_pct: number;
  };
}
