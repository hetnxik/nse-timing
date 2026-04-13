import math
import uuid
import json
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import asyncio
from typing import Optional
import time
import yfinance as yf

app = FastAPI()

# CORS middleware
import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache with TTL
cache = {}
CACHE_TTL = 900  # 15 minutes

# Nifty 50 + Nifty Next 50 stocks (top 100 liquid NSE stocks)
STOCKS_LIST = [
    # Nifty 50
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO",
    "BAJAJFINSV", "BAJFINANCE", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA",
    "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH",
    "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK",
    "ICICIGI", "ICICIPRULI", "INDUSINDBK", "INFY", "IOC", "ITC", "JSWSTEEL",
    "KOTAKBANK", "LT", "MARUTI", "M&M", "NESTLEIND", "NTPC", "ONGC", "POWERGRID",
    "RELIANCE", "SBIN", "SBILIFE", "SHREECEM", "SUNPHARMA", "TATACONSUM",
    "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO", "WIPRO",
    # Nifty Next 50
    "ABB", "ACC", "ALKEM", "AMBUJACEM", "ASHOKLEY", "AUBANK", "AUROPHARMA",
    "BANDHANBNK", "BANKBARODA", "BATAINDIA", "BEL", "BERGEPAINT", "BHEL",
    "BOSCHLTD", "CANBK", "CHOLAFIN", "COLPAL", "CONCOR", "CUMMINSIND",
    "DABUR", "DMART", "DLF", "GAIL", "GODREJCP", "GODREJPROP", "GRANULES",
    "HAL", "HAVELLS", "HINDPETRO", "HINDZINC", "IDFCFIRSTB", "IRCTC",
    "JINDALSTEL", "JUBLFOOD", "LICI", "LUPIN", "MARICO", "MAXHEALTH",
    "MCDOWELL-N", "MOTHERSON", "MPHASIS", "NAUKRI", "NMDC", "OBEROIRLTY",
    "PFC", "PIDILITIND", "PNB", "POLYCAB", "RECLTD", "SAIL", "SIEMENS",
    "SRF", "SRTRANSFIN", "TATAPOWER", "TORNTPHARM", "TVSMOTOR", "UBL",
    "UNITDSPR", "VBL", "VEDL", "VOLTAS", "ZOMATO", "ZYDUSLIFE"
]

SECTOR_MAP = {
    "RELIANCE": "Energy", "ONGC": "Energy", "BPCL": "Energy",
    "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "TECHM": "IT", "HCLTECH": "IT",
    "HDFCBANK": "Financials", "ICICIBANK": "Financials", "SBIN": "Financials",
    "KOTAKBANK": "Financials", "AXISBANK": "Financials", "BAJFINANCE": "Financials",
    "INDUSINDBK": "Financials",
    "HINDUNILVR": "FMCG", "NESTLEIND": "FMCG",
    "LT": "Infra", "ULTRACEMCO": "Infra", "POWERGRID": "Infra", "NTPC": "Infra",
    "TITAN": "Consumer", "ASIANPAINT": "Consumer",
    "MARUTI": "Auto", "TATAMOTORS": "Auto", "M&M": "Auto",
    "SUNPHARMA": "Pharma", "DRREDDY": "Pharma", "DIVISLAB": "Pharma", "CIPLA": "Pharma",
}



def is_cache_valid(ticker: str) -> bool:
    """Check if cached data is still valid."""
    if ticker not in cache:
        return False
    return time.time() - cache[ticker]["timestamp"] < CACHE_TTL


def get_cached(ticker: str):
    """Get cached data if valid."""
    if is_cache_valid(ticker):
        return cache[ticker]["data"]
    return None


def set_cache(ticker: str, data):
    """Set cache with timestamp."""
    cache[ticker] = {"data": data, "timestamp": time.time()}


def sanitize_floats(obj):
    """Recursively replace nan/inf float values with None for JSON compliance."""
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_floats(v) for v in obj]
    return obj


def generate_mock_data(ticker: str) -> pd.DataFrame:
    """Generate mock OHLCV data for testing (fallback)."""
    np.random.seed(hash(ticker) % 2**32)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=730)

    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    base_price = np.random.uniform(100, 5000)

    returns = np.random.normal(0.0005, 0.02, len(dates))
    prices = base_price * np.exp(np.cumsum(returns))

    data = pd.DataFrame({
        'Open': prices * (1 + np.random.uniform(-0.01, 0.01, len(dates))),
        'High': prices * (1 + np.abs(np.random.uniform(0, 0.03, len(dates)))),
        'Low': prices * (1 - np.abs(np.random.uniform(0, 0.03, len(dates)))),
        'Close': prices,
        'Volume': np.random.uniform(1e6, 50e6, len(dates)),
        'Adj Close': prices,
    }, index=dates)

    return data


def fetch_stock_data(ticker: str, allow_mock: bool = True) -> tuple:
    """Fetch 2 years of OHLCV data via yfinance. Returns (DataFrame, is_live_data)."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="2y", interval="1d")

        if df.empty:
            if not allow_mock:
                raise HTTPException(status_code=503, detail=f"No live data available for {ticker}")
            print(f"⚠️  No data found for {ticker} via yfinance. Using mock data.")
            return generate_mock_data(ticker), False

        df = df[['Open', 'High', 'Low', 'Close', 'Volume']].astype(float)
        df = df.dropna(subset=['Close'])
        df.index = pd.to_datetime(df.index).tz_localize(None)

        if df.empty:
            if not allow_mock:
                raise HTTPException(status_code=503, detail=f"No live data available for {ticker}")
            print(f"⚠️  All rows NaN for {ticker}. Using mock data.")
            return generate_mock_data(ticker), False

        print(f"✓ Fetched {len(df)} rows for {ticker} from yfinance (LIVE DATA)")
        return df, True

    except HTTPException:
        raise
    except Exception as e:
        if not allow_mock:
            raise HTTPException(status_code=503, detail=f"Data fetch failed for {ticker}: {e}")
        print(f"⚠️  yfinance error for {ticker}: {e}")
        print(f"   Using mock data for {ticker}")
        return generate_mock_data(ticker), False


def calculate_rsi(data: pd.Series, period: int = 14) -> pd.Series:
    """Calculate RSI (Relative Strength Index)."""
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(data: pd.Series):
    """Calculate MACD (12/26/9)."""
    ema12 = data.ewm(span=12, adjust=False).mean()
    ema26 = data.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calculate_bollinger_bands(data: pd.Series, period: int = 20, std_dev: float = 2):
    """Calculate Bollinger Bands."""
    sma = data.rolling(window=period).mean()
    std = data.rolling(window=period).std()
    upper = sma + (std_dev * std)
    lower = sma - (std_dev * std)

    # Calculate %B
    pct_b = (data - lower) / (upper - lower)

    return upper, sma, lower, pct_b


def calculate_atr(df: pd.DataFrame, period: int = 14) -> tuple:
    """Calculate Average True Range."""
    high = df['High']
    low = df['Low']
    close = df['Close']

    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())

    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()

    return atr


def calculate_indicators(df: pd.DataFrame) -> dict:
    """Calculate all technical indicators."""
    close = df['Close']

    # RSI
    rsi = calculate_rsi(close, 14)
    rsi_val = rsi.iloc[-1]

    # MACD
    macd_line, signal_line, histogram = calculate_macd(close)
    macd_val = macd_line.iloc[-1]
    signal_val = signal_line.iloc[-1]
    histogram_val = histogram.iloc[-1]

    # Bollinger Bands
    upper, mid, lower, pct_b = calculate_bollinger_bands(close, 20, 2)
    upper_val = upper.iloc[-1]
    mid_val = mid.iloc[-1]
    lower_val = lower.iloc[-1]
    pct_b_val = pct_b.iloc[-1]

    # 6-month momentum (126 trading days)
    momentum_6m = ((close.iloc[-1] - close.iloc[-126]) / close.iloc[-126]) * 100 if len(close) >= 126 else 0

    # 200-day MA
    ma200 = close.rolling(window=200).mean().iloc[-1]
    pct_above_ma200 = ((close.iloc[-1] - ma200) / ma200) * 100 if ma200 > 0 else 0
    bull_regime = close.iloc[-1] > ma200

    # ATR
    atr = calculate_atr(df, 14)
    atr_val = atr.iloc[-1]
    atr_pct = (atr_val / close.iloc[-1]) * 100 if close.iloc[-1] > 0 else 0

    # Volume ratio
    volume_ratio = df['Volume'].iloc[-1] / df['Volume'].rolling(window=20).mean().iloc[-1]

    return {
        "rsi": float(rsi_val),
        "macd": {
            "line": float(macd_val),
            "signal": float(signal_val),
            "histogram": float(histogram_val),
        },
        "bollinger_bands": {
            "upper": float(upper_val),
            "mid": float(mid_val),
            "lower": float(lower_val),
            "pct_b": float(pct_b_val),
        },
        "momentum_6m": float(momentum_6m),
        "ma200": {
            "value": float(ma200),
            "pct_above": float(pct_above_ma200),
            "bull_regime": bool(bull_regime),
        },
        "atr": {
            "value": float(atr_val),
            "pct": float(atr_pct),
        },
        "volume_ratio": float(volume_ratio),
    }


def calculate_signals(indicators: dict, current_price: float) -> list:
    """Generate signal cards based on indicators."""
    signals = []

    rsi = indicators["rsi"]
    macd_hist = indicators["macd"]["histogram"]
    pct_b = indicators["bollinger_bands"]["pct_b"]
    momentum = indicators["momentum_6m"]
    bull_regime = indicators["ma200"]["bull_regime"]
    volume_ratio = indicators["volume_ratio"]

    # RSI signals
    if rsi < 30:
        signals.append({"type": "bullish", "title": "RSI Oversold", "description": f"RSI at {rsi:.1f} signals oversold conditions"})
    elif rsi > 70:
        signals.append({"type": "bearish", "title": "RSI Overbought", "description": f"RSI at {rsi:.1f} signals overbought conditions"})
    elif 30 <= rsi <= 45:
        signals.append({"type": "bullish", "title": "RSI Supportive", "description": f"RSI at {rsi:.1f} shows strength without excess"})
    elif 60 <= rsi <= 70:
        signals.append({"type": "bearish", "title": "RSI Weakening", "description": f"RSI at {rsi:.1f} shows minor weakness"})

    # MACD signals
    if macd_hist > 0:
        signals.append({"type": "bullish", "title": "MACD Positive", "description": "MACD histogram is positive, momentum favors bulls"})
    else:
        signals.append({"type": "bearish", "title": "MACD Negative", "description": "MACD histogram is negative, momentum favors bears"})

    # Bollinger Bands signals
    if pct_b < 0.1:
        signals.append({"type": "bullish", "title": "Near Lower Band", "description": "Price at lower Bollinger Band suggests bounce likely"})
    elif pct_b > 0.9:
        signals.append({"type": "bearish", "title": "Near Upper Band", "description": "Price at upper Bollinger Band suggests pullback likely"})

    # 6-month momentum signals
    if momentum > 15:
        signals.append({"type": "bullish", "title": "Strong 6M Momentum", "description": "6-month gains exceed 15%, confirming uptrend"})
    elif momentum > 5:
        signals.append({"type": "bullish", "title": "Positive 6M Momentum", "description": "6-month gains exceed 5%, supporting entry"})
    elif momentum < -15:
        signals.append({"type": "bearish", "title": "Weak 6M Momentum", "description": "6-month losses exceed -15%, caution advised"})
    elif momentum < -5:
        signals.append({"type": "bearish", "title": "Negative 6M Momentum", "description": "6-month losses exceed -5%, headwinds present"})

    # 200-DMA signals
    if bull_regime:
        signals.append({"type": "bullish", "title": "Above 200-DMA", "description": "Price above 200-day MA confirms long-term uptrend"})
    else:
        signals.append({"type": "bearish", "title": "Below 200-DMA", "description": "Price below 200-day MA warns of downtrend"})

    # Volume signals
    if volume_ratio > 1.5:
        signals.append({"type": "bullish", "title": "High Volume", "description": "Volume 50%+ above average, move has conviction"})

    return signals


def calculate_composite_score(indicators: dict) -> tuple:
    """Calculate composite score (0-100) based on all indicators."""
    score = 50

    rsi = indicators["rsi"]
    macd_hist = indicators["macd"]["histogram"]
    pct_b = indicators["bollinger_bands"]["pct_b"]
    momentum = indicators["momentum_6m"]
    bull_regime = indicators["ma200"]["bull_regime"]
    volume_ratio = indicators["volume_ratio"]

    # RSI adjustments
    if rsi < 30:
        score += 25
    elif 30 <= rsi <= 45:
        score += 12
    elif 60 <= rsi <= 70:
        score -= 5
    elif rsi > 70:
        score -= 20

    # MACD adjustments
    if macd_hist > 0:
        score += 15
    else:
        score -= 10

    # Bollinger Bands adjustments
    if pct_b < 0.1:
        score += 20
    elif pct_b < 0.3:
        score += 10
    elif pct_b > 0.9:
        score -= 15

    # 6-month momentum adjustments
    if momentum > 15:
        score += 15
    elif momentum > 5:
        score += 8
    elif momentum < -15:
        score -= 15
    elif momentum < -5:
        score -= 8

    # 200-DMA adjustments
    if bull_regime:
        score += 20
    else:
        score -= 20

    # Volume adjustments
    if volume_ratio > 1.5:
        score += 5

    # Clamp to 0-100
    score = max(0, min(100, score))

    # Determine verdict
    if score >= 75:
        verdict = "Strong Buy"
    elif score >= 60:
        verdict = "Moderate Buy"
    elif score >= 40:
        verdict = "Neutral"
    elif score >= 25:
        verdict = "Caution"
    else:
        verdict = "Avoid"

    return score, verdict


def compute_score_history(df: pd.DataFrame) -> list:
    """Compute composite score for every trading day with enough history (skip first 200 rows)."""
    close = df['Close']
    rsi_series = calculate_rsi(close, 14)
    _macd_line, _signal_line, histogram = calculate_macd(close)
    _upper, _mid, _lower, pct_b = calculate_bollinger_bands(close, 20, 2)
    ma200_series = close.rolling(window=200).mean()
    vol_ma20 = df['Volume'].rolling(window=20).mean()

    result = []
    for i in range(200, len(df)):
        date_str = df.index[i].strftime("%Y-%m-%d")
        cp = float(close.iloc[i])

        rsi_val = rsi_series.iloc[i]
        macd_hist = histogram.iloc[i]
        pct_b_val = pct_b.iloc[i]
        ma200_val = ma200_series.iloc[i]
        vol_val = df['Volume'].iloc[i]
        vol_avg = vol_ma20.iloc[i]

        if any(pd.isna(v) for v in [rsi_val, macd_hist, pct_b_val, ma200_val, vol_avg]):
            continue

        # 6M momentum — use 126 bars back if available
        mom_6m = ((cp - float(close.iloc[i - 126])) / float(close.iloc[i - 126])) * 100 if i >= 126 else 0

        bull_regime = cp > float(ma200_val)
        volume_ratio = float(vol_val) / float(vol_avg) if vol_avg > 0 else 1.0

        indicators_snap = {
            "rsi": float(rsi_val),
            "macd": {"histogram": float(macd_hist)},
            "bollinger_bands": {"pct_b": float(pct_b_val)},
            "momentum_6m": float(mom_6m),
            "ma200": {"bull_regime": bull_regime},
            "volume_ratio": float(volume_ratio),
        }
        score, _ = calculate_composite_score(indicators_snap)
        result.append({"date": date_str, "close": round(cp, 2), "score": float(score)})

    return result


def calculate_support_resistance(df: pd.DataFrame, window: int = 10, n_levels: int = 3) -> dict:
    """Detect support and resistance levels using pivot point clustering."""
    highs = df['High']
    lows = df['Low']
    current_price = float(df['Close'].iloc[-1])

    resistance_candidates = []
    support_candidates = []

    for i in range(window, len(df) - window):
        if highs.iloc[i] == highs.iloc[i - window:i + window + 1].max():
            resistance_candidates.append(float(highs.iloc[i]))
        if lows.iloc[i] == lows.iloc[i - window:i + window + 1].min():
            support_candidates.append(float(lows.iloc[i]))

    def cluster_levels(levels, threshold=0.015):
        if not levels:
            return []
        levels = sorted(set(levels))
        clusters, current = [], [levels[0]]
        for level in levels[1:]:
            if (level - current[0]) / current[0] <= threshold:
                current.append(level)
            else:
                clusters.append(float(np.mean(current)))
                current = [level]
        clusters.append(float(np.mean(current)))
        return clusters

    resistance = sorted([r for r in cluster_levels(resistance_candidates) if r > current_price])[:n_levels]
    support = sorted([s for s in cluster_levels(support_candidates) if s < current_price], reverse=True)[:n_levels]

    return {
        "support": [round(s, 2) for s in support],
        "resistance": [round(r, 2) for r in resistance],
    }


def fetch_fundamentals(ticker: str) -> dict:
    """Fetch fundamental data from yfinance .info."""
    empty = {"pe_ratio": None, "pb_ratio": None, "market_cap": None, "eps": None,
             "dividend_yield": None, "sector": None, "industry": None, "avg_volume": None}
    try:
        info = yf.Ticker(ticker).info
        return {
            "pe_ratio": info.get("trailingPE"),
            "pb_ratio": info.get("priceToBook"),
            "market_cap": info.get("marketCap"),
            "eps": info.get("trailingEps"),
            "dividend_yield": info.get("dividendYield"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "avg_volume": info.get("averageVolume"),
        }
    except Exception:
        return empty


async def get_stock_internal(ticker: str, require_live: bool = False) -> dict:
    """Internal function to fetch stock data with optional live data enforcement."""
    ticker = ticker.upper()

    # Check cache - only use if it meets our live data requirement
    cached = get_cached(ticker)
    if cached:
        is_live_cached = cached.get("meta", {}).get("data_source") == "live"
        if require_live and not is_live_cached:
            # Cached data is mock but we need live - skip cache and fetch fresh
            pass
        else:
            return cached

    # Fetch data (require live if specified)
    df, is_live = fetch_stock_data(ticker, allow_mock=not require_live)

    # Get metadata
    current_price = df['Close'].iloc[-1]
    prev_close = df['Close'].iloc[-2] if len(df) > 1 else current_price
    day_change_pct = ((current_price - prev_close) / prev_close) * 100 if prev_close > 0 else 0

    high_52w = df['High'].iloc[-252:].max() if len(df) >= 252 else df['High'].max()
    low_52w = df['Low'].iloc[-252:].min() if len(df) >= 252 else df['Low'].min()

    # Use ticker as name (Finnhub doesn't provide company names in free tier)
    name = ticker

    # Calculate indicators
    indicators = calculate_indicators(df)

    # Generate signals
    signals = calculate_signals(indicators, current_price)

    # Calculate composite score
    score, verdict = calculate_composite_score(indicators)

    # Calculate indicators for chart data
    close = df['Close']
    rsi_series = calculate_rsi(close, 14)
    macd_line, signal_line, histogram = calculate_macd(close)
    upper, mid, lower, pct_b = calculate_bollinger_bands(close, 20, 2)
    ma200_series = close.rolling(window=200).mean()

    # Prepare 6-month chart data
    chart_data = []
    df_6m = df.iloc[-126:] if len(df) >= 126 else df
    start_idx = len(df) - len(df_6m)

    for i, (idx, row) in enumerate(df_6m.iterrows()):
        actual_idx = start_idx + i
        chart_data.append({
            "date": idx.strftime("%Y-%m-%d"),
            "open": float(row['Open']),
            "high": float(row['High']),
            "low": float(row['Low']),
            "close": float(row['Close']),
            "volume": float(row['Volume']),
            "rsi": float(rsi_series.iloc[actual_idx]) if not pd.isna(rsi_series.iloc[actual_idx]) else None,
            "macd_line": float(macd_line.iloc[actual_idx]) if not pd.isna(macd_line.iloc[actual_idx]) else None,
            "macd_signal": float(signal_line.iloc[actual_idx]) if not pd.isna(signal_line.iloc[actual_idx]) else None,
            "macd_histogram": float(histogram.iloc[actual_idx]) if not pd.isna(histogram.iloc[actual_idx]) else None,
            "bb_upper": float(upper.iloc[actual_idx]) if not pd.isna(upper.iloc[actual_idx]) else None,
            "bb_mid": float(mid.iloc[actual_idx]) if not pd.isna(mid.iloc[actual_idx]) else None,
            "bb_lower": float(lower.iloc[actual_idx]) if not pd.isna(lower.iloc[actual_idx]) else None,
            "ma200": float(ma200_series.iloc[actual_idx]) if not pd.isna(ma200_series.iloc[actual_idx]) else None,
        })

    fundamentals = fetch_fundamentals(ticker)
    support_resistance = calculate_support_resistance(df)

    # --- Entry Zone ---
    atr_val = indicators["atr"]["value"]
    bb_upper_val = indicators["bollinger_bands"]["upper"]
    bb_lower_val = indicators["bollinger_bands"]["lower"]
    high_52w_entry = float(df['High'].iloc[-252:].max() if len(df) >= 252 else df['High'].max())

    ideal_entry_low = round(bb_lower_val, 2)
    ideal_entry_high = round(float(current_price), 2)

    stop_atr = round(float(current_price) - 2 * atr_val, 2)
    stop_bb = round(bb_lower_val - 0.5 * atr_val, 2)

    stop_atr_pct = round(((float(current_price) - stop_atr) / float(current_price)) * 100, 2)
    stop_bb_pct = round(((float(current_price) - stop_bb) / float(current_price)) * 100, 2)

    target_bb_upper = round(bb_upper_val, 2)
    target_52w_high = round(high_52w_entry, 2)

    # Momentum target: avg 6M momentum of last 3 signals from score_history
    score_hist = compute_score_history(df)
    last_signals = [h for h in score_hist if h["score"] >= 65][-3:]
    if last_signals:
        moms = []
        for s in last_signals:
            try:
                sig_date = pd.to_datetime(s["date"])
                pos = df.index.get_loc(sig_date) if sig_date in df.index else None
                if pos is None:
                    # find nearest
                    pos_arr = df.index.searchsorted(sig_date)
                    pos = min(int(pos_arr), len(df) - 1)
                fwd = min(pos + 126, len(df) - 1)
                m = ((float(df['Close'].iloc[fwd]) - s["close"]) / s["close"]) * 100
                moms.append(m)
            except Exception:
                pass
        avg_mom = float(np.mean(moms)) if moms else 15.0
    else:
        avg_mom = 15.0
    target_momentum = round(float(current_price) * (1 + avg_mom / 100), 2)

    def pct_move(target: float, entry: float) -> float:
        return round(((target - entry) / entry) * 100, 2) if entry > 0 else 0.0

    def rr_ratio(target: float, entry: float, stop: float) -> float:
        denom = entry - stop
        if denom <= 0:
            return 0.0
        return round((target - entry) / denom, 2)

    def rr_quality(rr: float) -> str:
        if rr < 1.5:
            return "poor"
        elif rr <= 2.5:
            return "acceptable"
        return "good"

    def position_size(stop_pct: float) -> float:
        if stop_pct <= 0:
            return 0.0
        return round(min(1.0 / stop_pct * 100, 20.0), 2)

    entry_zone = {
        "ideal_entry_low": ideal_entry_low,
        "ideal_entry_high": ideal_entry_high,
        "entry_note": f"Ideal entry between the lower Bollinger Band (₹{ideal_entry_low}) and current price (₹{ideal_entry_high}). The lower band represents a statistically oversold level.",
        "stop_atr": stop_atr,
        "stop_atr_pct": stop_atr_pct,
        "stop_atr_label": "ATR-based stop",
        "stop_bb": stop_bb,
        "stop_bb_pct": stop_bb_pct,
        "stop_bb_label": "BB-based stop",
        "target_bb_upper": target_bb_upper,
        "target_bb_upper_pct": pct_move(target_bb_upper, float(current_price)),
        "target_52w_high": target_52w_high,
        "target_52w_high_pct": pct_move(target_52w_high, float(current_price)),
        "target_momentum": target_momentum,
        "target_momentum_pct": round(avg_mom, 2),
        "rr_matrix": {
            "atr_bb_upper": {"rr": rr_ratio(target_bb_upper, float(current_price), stop_atr), "quality": rr_quality(rr_ratio(target_bb_upper, float(current_price), stop_atr))},
            "atr_52w_high": {"rr": rr_ratio(target_52w_high, float(current_price), stop_atr), "quality": rr_quality(rr_ratio(target_52w_high, float(current_price), stop_atr))},
            "atr_momentum": {"rr": rr_ratio(target_momentum, float(current_price), stop_atr), "quality": rr_quality(rr_ratio(target_momentum, float(current_price), stop_atr))},
            "bb_bb_upper": {"rr": rr_ratio(target_bb_upper, float(current_price), stop_bb), "quality": rr_quality(rr_ratio(target_bb_upper, float(current_price), stop_bb))},
            "bb_52w_high": {"rr": rr_ratio(target_52w_high, float(current_price), stop_bb), "quality": rr_quality(rr_ratio(target_52w_high, float(current_price), stop_bb))},
            "bb_momentum": {"rr": rr_ratio(target_momentum, float(current_price), stop_bb), "quality": rr_quality(rr_ratio(target_momentum, float(current_price), stop_bb))},
        },
        "position_size_atr": position_size(stop_atr_pct),
        "position_size_bb": position_size(stop_bb_pct),
    }

    response = {
        "meta": {
            "ticker": ticker,
            "name": name,
            "current_price": float(current_price),
            "day_change_pct": float(day_change_pct),
            "high_52w": float(high_52w),
            "low_52w": float(low_52w),
            "exchange": "NSE",
            "data_source": "live" if is_live else "mock",
        },
        "indicators": indicators,
        "signals": signals,
        "score": {
            "value": float(score),
            "verdict": verdict,
        },
        "chart_data": chart_data,
        "fundamentals": fundamentals,
        "support_resistance": support_resistance,
        "entry_zone": entry_zone,
        "score_history": score_hist,
    }

    response = sanitize_floats(response)
    set_cache(ticker, response)
    return response


@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str):
    """Fetch stock data and compute all indicators (allows mock fallback)."""
    return await get_stock_internal(ticker, require_live=False)


async def get_stock_live_only(ticker: str) -> dict:
    """Fetch stock data - raises error if live data unavailable."""
    return await get_stock_internal(ticker, require_live=True)


@app.get("/api/compare")
async def compare_stocks(tickers: str):
    """Compare multiple stocks in parallel."""
    ticker_list = [t.strip().upper() for t in tickers.split(",")]

    async def fetch_one(ticker):
        try:
            return await get_stock(ticker)
        except Exception as e:
            return None

    results = await asyncio.gather(*[fetch_one(t) for t in ticker_list])

    summaries = []
    for i, result in enumerate(results):
        if result:
            meta = result["meta"]
            indicators = result["indicators"]
            score = result["score"]

            summaries.append({
                "symbol": meta["ticker"],
                "name": meta["name"],
                "score": score["value"],
                "verdict": score["verdict"],
                "price": meta["current_price"],
                "rsi": indicators["rsi"],
                "momentum_6m": indicators["momentum_6m"],
                "above_200dma": indicators["ma200"]["bull_regime"],
                "indicators": indicators,
                "signals": result["signals"],
            })

    return summaries


@app.get("/api/screen")
async def screen_stocks(
    min_score: int = 60,
    min_rsi: int = 0,
    max_rsi: int = 100,
    regime: str = "any",
):
    """Screen 30 large-cap NSE stocks."""
    tickers = [f"{stock}.NS" for stock in STOCKS_LIST]

    async def fetch_one(ticker):
        try:
            return await get_stock(ticker)
        except Exception:
            return None

    results = await asyncio.gather(*[fetch_one(t) for t in tickers])

    filtered = []
    for result in results:
        if not result:
            continue

        meta = result["meta"]
        indicators = result["indicators"]
        score = result["score"]

        # Apply filters
        if score["value"] < min_score:
            continue

        if indicators["rsi"] < min_rsi or indicators["rsi"] > max_rsi:
            continue

        is_bull = indicators["ma200"]["bull_regime"]
        if regime == "bull" and not is_bull:
            continue
        elif regime == "bear" and is_bull:
            continue

        filtered.append({
            "symbol": meta["ticker"],
            "name": meta["name"],
            "score": score["value"],
            "verdict": score["verdict"],
            "price": meta["current_price"],
            "day_change_pct": meta["day_change_pct"],
            "rsi": indicators["rsi"],
            "momentum_6m": indicators["momentum_6m"],
            "regime": "Bull" if is_bull else "Bear",
            "indicators": indicators,
        })

    # Sort by score descending
    filtered.sort(key=lambda x: x["score"], reverse=True)

    return filtered


@app.get("/api/heatmap")
async def get_heatmap():
    """Return all 30 stocks with sector, score, and day change for the heatmap."""
    tickers = [f"{stock}.NS" for stock in STOCKS_LIST]

    async def fetch_one(ticker):
        try:
            return await get_stock(ticker)
        except Exception:
            return None

    results = await asyncio.gather(*[fetch_one(t) for t in tickers])

    heatmap = []
    for stock_sym, result in zip(STOCKS_LIST, results):
        if not result:
            continue
        meta = result["meta"]
        score_data = result["score"]
        heatmap.append({
            "ticker": meta["ticker"],
            "name": meta["name"],
            "sector": SECTOR_MAP.get(stock_sym, "Other"),
            "score": score_data["value"],
            "verdict": score_data["verdict"],
            "day_change_pct": meta["day_change_pct"],
            "current_price": meta["current_price"],
        })

    return heatmap


@app.get("/api/backtest/{ticker}")
async def get_backtest(ticker: str):
    """Run historical backtesting using 2 years of daily data."""
    ticker = ticker.upper()
    cache_key = f"backtest_{ticker}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    df, _ = fetch_stock_data(ticker)
    score_hist = compute_score_history(df)

    close = df['Close']
    rsi_series = calculate_rsi(close, 14)
    ma200_series = close.rolling(window=200).mean()

    # Build date -> df integer index map for fast lookup
    df_date_to_idx = {dt.strftime("%Y-%m-%d"): i for i, dt in enumerate(df.index)}

    signals = []
    last_signal_idx = -999  # track index of last signal

    for i, h in enumerate(score_hist):
        if i == 0:
            continue
        prev = score_hist[i - 1]
        date_str = h["date"]
        score_val = h["score"]
        prev_score = prev["score"]

        df_idx = df_date_to_idx.get(date_str)
        if df_idx is None:
            continue

        # Cooldown: no signal within 63 trading days of last
        if i - last_signal_idx < 63:
            continue

        rsi_val = rsi_series.iloc[df_idx] if df_idx < len(rsi_series) else float('nan')
        ma200_val = ma200_series.iloc[df_idx] if df_idx < len(ma200_series) else float('nan')
        cp = h["close"]

        is_strong = score_val >= 65 and prev_score < 65
        is_moderate = (score_val >= 55 and prev_score < 55 and
                       not pd.isna(rsi_val) and rsi_val < 40 and
                       not pd.isna(ma200_val) and cp > float(ma200_val))

        if not (is_strong or is_moderate):
            continue

        last_signal_idx = i
        signal_type = "strong" if is_strong else "moderate"

        # Look ahead 63 and 126 trading days
        future_63 = score_hist[i + 63]["close"] if i + 63 < len(score_hist) else None
        future_126 = score_hist[i + 126]["close"] if i + 126 < len(score_hist) else None

        ret_3m = round(((future_63 - cp) / cp) * 100, 2) if future_63 is not None else None
        ret_6m = round(((future_126 - cp) / cp) * 100, 2) if future_126 is not None else None

        # Max drawdown and stop hit in 126-day window
        end_idx = min(i + 126, len(score_hist) - 1)
        window_prices = [score_hist[j]["close"] for j in range(i, end_idx + 1)]
        atr_at_signal = float(calculate_atr(df, 14).iloc[df_idx]) if df_idx < len(df) else 0
        stop_atr_price = cp - 2 * atr_at_signal
        hit_stop = any(p < stop_atr_price for p in window_prices)
        max_dd = round(((min(window_prices) - cp) / cp) * 100, 2)

        signals.append({
            "signal_date": date_str,
            "signal_price": round(cp, 2),
            "signal_score": round(score_val, 1),
            "signal_type": signal_type,
            "outcome_price_63d": round(future_63, 2) if future_63 else None,
            "outcome_price_126d": round(future_126, 2) if future_126 else None,
            "return_3m": ret_3m,
            "return_6m": ret_6m,
            "hit_stop_atr": hit_stop,
            "max_drawdown_pct": max_dd,
        })

    completed = [s for s in signals if s["return_6m"] is not None]
    wins = [s for s in completed if s["return_6m"] > 0]
    returns_6m = [s["return_6m"] for s in completed]
    drawdowns = [s["max_drawdown_pct"] for s in signals]

    agg = {
        "total_signals": len(signals),
        "signals_with_6m_outcome": len(completed),
        "win_rate_6m": round(len(wins) / len(completed) * 100, 1) if completed else None,
        "avg_return_6m": round(float(np.mean(returns_6m)), 2) if returns_6m else None,
        "median_return_6m": round(float(np.median(returns_6m)), 2) if returns_6m else None,
        "avg_max_drawdown": round(float(np.mean(drawdowns)), 2) if drawdowns else None,
        "best_signal": max(completed, key=lambda s: s["return_6m"]) if completed else None,
        "worst_signal": min(completed, key=lambda s: s["return_6m"]) if completed else None,
    }

    result = {"ticker": ticker, "signals": signals, "stats": agg, "score_history": score_hist}
    set_cache(cache_key, result)
    return result


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


# ── Paper Trades ──────────────────────────────────────────────────────────────

TRADES_FILE = os.path.join(os.path.dirname(__file__), "trades.json")


def load_trades() -> list:
    if not os.path.exists(TRADES_FILE):
        return []
    try:
        with open(TRADES_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def save_trades(trades: list):
    with open(TRADES_FILE, "w") as f:
        json.dump(trades, f, indent=2)


class TradeCreate(BaseModel):
    ticker: str
    entry_price: float
    entry_date: str
    quantity: float
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    notes: Optional[str] = None
    entry_score: Optional[float] = None


class TradeUpdate(BaseModel):
    exit_price: Optional[float] = None
    exit_date: Optional[str] = None
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


@app.get("/api/trades")
async def get_trades():
    return load_trades()


@app.post("/api/trades")
async def create_trade(trade: TradeCreate):
    trades = load_trades()
    new_trade = {
        "id": str(uuid.uuid4()),
        "ticker": trade.ticker.upper(),
        "entry_price": trade.entry_price,
        "entry_date": trade.entry_date,
        "quantity": trade.quantity,
        "stop_loss": trade.stop_loss,
        "target": trade.target,
        "notes": trade.notes,
        "entry_score": trade.entry_score,
        "status": "open",
        "exit_price": None,
        "exit_date": None,
    }
    trades.append(new_trade)
    save_trades(trades)
    return new_trade


@app.put("/api/trades/{trade_id}")
async def update_trade(trade_id: str, update: TradeUpdate):
    trades = load_trades()
    for trade in trades:
        if trade["id"] == trade_id:
            if update.exit_price is not None:
                trade["exit_price"] = update.exit_price
            if update.exit_date is not None:
                trade["exit_date"] = update.exit_date
            if update.stop_loss is not None:
                trade["stop_loss"] = update.stop_loss
            if update.target is not None:
                trade["target"] = update.target
            if update.notes is not None:
                trade["notes"] = update.notes
            if update.status is not None:
                trade["status"] = update.status
            save_trades(trades)
            return trade
    raise HTTPException(status_code=404, detail="Trade not found")


@app.delete("/api/trades/{trade_id}")
async def delete_trade(trade_id: str):
    trades = load_trades()
    updated = [t for t in trades if t["id"] != trade_id]
    if len(updated) == len(trades):
        raise HTTPException(status_code=404, detail="Trade not found")
    save_trades(updated)
    return {"ok": True}


@app.get("/api/prices")
async def get_prices(tickers: str):
    """Return current prices for a comma-separated list of tickers."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]

    async def fetch_price(ticker):
        try:
            data = await get_stock(ticker)
            return {"ticker": ticker, "price": data["meta"]["current_price"], "day_change_pct": data["meta"]["day_change_pct"]}
        except Exception:
            return {"ticker": ticker, "price": None, "day_change_pct": None}

    results = await asyncio.gather(*[fetch_price(t) for t in ticker_list])
    return {r["ticker"]: {"price": r["price"], "day_change_pct": r["day_change_pct"]} for r in results}


# ── Auto-Trading Strategy Engine (MDC — Momentum-Dip Composite) ──────────────
#
# Research basis:
#   - Jegadeesh & Titman (1993): 6-month momentum predicts 6-month forward returns
#   - George & Hwang (2004): 52-week high proximity is a strong momentum signal
#   - Faber (2007): 200-day MA as hard regime filter halves drawdown
#   - Connors et al. (2009): RSI(14) 30-55 entry within uptrend boosts win rate
#   - Lento & Gradojevic (2007): %B < 0.5 in uptrend = mean-reversion entry
#   - Blume et al. (1994): Volume > 1.5x confirms breakout conviction


def check_entry_signal(
    stock_data: dict,
    min_score: int = 65,
    min_rsi: int = 25,
    max_rsi: int = 55,
    min_momentum: float = 5.0,
    min_high_ratio: float = 0.65,
    max_pct_b: float = 0.55,
) -> tuple[bool, list[str]]:
    """
    MDC entry: all 6 conditions must pass.

    1. Bull regime  — price above 200-DMA (Faber 2007 regime filter)
    2. Score ≥ min_score   — composite signal strength gate
    3. RSI min-max    — pulled back but not collapsing (Connors, NSE-adapted)
    4. 6M momentum > min_momentum — underlying trend must be positive (Jegadeesh-Titman)
    5. 52W high ratio > min_high_ratio — not too beaten down (George & Hwang)
    6. %B < max_pct_b    — buying in lower half of Bollinger Bands (mean-reversion)
    """
    meta = stock_data["meta"]
    ind = stock_data["indicators"]
    score = stock_data["score"]["value"]

    rsi = ind["rsi"]
    momentum_6m = ind["momentum_6m"]
    bull_regime = ind["ma200"]["bull_regime"]
    pct_b = ind["bollinger_bands"]["pct_b"]
    current_price = meta["current_price"]
    high_52w = meta["high_52w"]
    high_ratio = current_price / high_52w if high_52w > 0 else 0

    reasons = []
    passed = []

    if bull_regime:
        passed.append("Above 200-DMA")
    else:
        reasons.append("Below 200-DMA (bear regime)")

    if score >= min_score:
        passed.append(f"Score {score:.0f} ≥ {min_score}")
    else:
        reasons.append(f"Score {score:.0f} < {min_score}")

    if min_rsi <= rsi <= max_rsi:
        passed.append(f"RSI {rsi:.1f} in {min_rsi}-{max_rsi} range")
    else:
        reasons.append(f"RSI {rsi:.1f} outside {min_rsi}-{max_rsi}")

    if momentum_6m > min_momentum:
        passed.append(f"6M momentum +{momentum_6m:.1f}%")
    else:
        reasons.append(f"6M momentum {momentum_6m:.1f}% ≤ {min_momentum}%")

    if high_ratio > min_high_ratio:
        passed.append(f"52W high ratio {high_ratio:.2f} > {min_high_ratio}")
    else:
        reasons.append(f"52W high ratio {high_ratio:.2f} ≤ {min_high_ratio} (too beaten down)")

    if pct_b < max_pct_b:
        passed.append(f"%B {pct_b:.2f} < {max_pct_b} (lower band dip)")
    else:
        reasons.append(f"%B {pct_b:.2f} ≥ {max_pct_b} (not a dip)")

    all_passed = len(reasons) == 0
    return all_passed, passed if all_passed else reasons


def check_exit_signal(trade: dict, stock_data: dict) -> tuple[str | None, str]:
    """
    Exit triggers (first match wins):
    1. Stop loss hit  — price ≤ stop_loss
    2. Target reached — price ≥ target
    3. Regime change  — score < 35 AND price below 200-DMA
    4. Time stop      — position held ≥ 126 trading days (~6 months)

    Returns (exit_reason | None, description)
    """
    current_price = stock_data["meta"]["current_price"]
    ind = stock_data["indicators"]
    score = stock_data["score"]["value"]
    bull_regime = ind["ma200"]["bull_regime"]

    if trade.get("stop_loss") and current_price <= trade["stop_loss"]:
        return "stop_loss", f"Stop hit at ₹{current_price:.2f} (stop was ₹{trade['stop_loss']:.2f})"

    if trade.get("target") and current_price >= trade["target"]:
        return "target", f"Target reached at ₹{current_price:.2f} (target was ₹{trade['target']:.2f})"

    if score < 35 and not bull_regime:
        return "regime_change", f"Regime change — score {score:.0f} < 35 and below 200-DMA"

    try:
        entry_dt = datetime.fromisoformat(trade["entry_date"])
        days_held = (datetime.now() - entry_dt).days
        if days_held >= 180:  # ~6 calendar months
            return "time_stop", f"Time stop — held {days_held} days (6-month limit)"
    except Exception:
        pass

    return None, ""


def calculate_mdc_position_size(stock_data: dict, portfolio_size: float, risk_pct: float, max_position_pct: float) -> int:
    """
    Kelly-inspired position sizing: risk a fixed % of portfolio per trade.
    quantity = (portfolio * risk_pct) / (entry_price * stop_distance_pct)
    Capped at max_position_pct of portfolio.
    """
    entry_price = stock_data["meta"]["current_price"]
    stop = stock_data["entry_zone"]["stop_atr"]
    if entry_price <= 0 or stop >= entry_price:
        return 0
    stop_distance_pct = (entry_price - stop) / entry_price
    if stop_distance_pct <= 0:
        return 0
    risk_amount = portfolio_size * risk_pct
    qty_by_risk = int(risk_amount / (entry_price * stop_distance_pct))
    max_qty = int((portfolio_size * max_position_pct) / entry_price)
    return max(0, min(qty_by_risk, max_qty))


class AutoTradeConfig(BaseModel):
    portfolio_size: float = 1_000_000.0   # ₹10 lakh default
    risk_per_trade: float = 0.01          # 1% risk per trade
    max_positions: int = 6
    max_position_pct: float = 0.15        # max 15% of portfolio in one stock
    dry_run: bool = False                 # if True, report only — don't create trades
    # Screener filters (optional - uses screener logic before MDC strategy)
    min_score: int = 0                    # min composite score to consider
    min_rsi: int = 0                      # min RSI
    max_rsi: int = 100                    # max RSI
    regime: str = "any"                   # "bull", "bear", or "any"
    # MDC Strategy thresholds (optional - override defaults)
    mdc_min_score: int = 65               # min score for entry (default 65)
    mdc_min_rsi: int = 25                 # min RSI for entry (default 25)
    mdc_max_rsi: int = 55                 # max RSI for entry (default 55)
    mdc_min_momentum: float = 5.0         # min 6M momentum % (default 5)
    mdc_min_high_ratio: float = 0.65      # min 52W high ratio (default 0.65)
    mdc_max_pct_b: float = 0.55           # max %B for entry (default 0.55)


@app.post("/api/auto-trade/scan")
async def auto_trade_scan(config: AutoTradeConfig):
    """
    Run the MDC strategy scan:
    1. Check exit conditions on all open trades → close those that qualify
    2. Scan all 30 stocks for entry conditions → open new trades up to max_positions
    Returns a full report of actions taken and reasons.
    """
    print(f"[MDC SCAN] Received config: {config.model_dump()}")
    today = datetime.now().strftime("%Y-%m-%d")
    report = {
        "scan_date": today,
        "config": config.model_dump(),
        "exits": [],
        "entries": [],
        "skipped": [],
        "summary": {},
    }

    # ── Step 1: Check exits ───────────────────────────────────────────────────
    open_trades = [t for t in load_trades() if t["status"] == "open"]

    async def check_one_exit(trade):
        ticker = trade["ticker"]
        try:
            stock_data = await get_stock_live_only(ticker)
            reason, desc = check_exit_signal(trade, stock_data)
            return trade, stock_data, reason, desc, True
        except HTTPException as e:
            # Live data unavailable - skip this trade, don't exit
            return trade, None, None, f"Live data unavailable: {e.detail}", False
        except Exception as e:
            return trade, None, None, str(e), False

    exit_results = await asyncio.gather(*[check_one_exit(t) for t in open_trades])

    closed_ids = set()
    live_failures = []
    for trade, stock_data, reason, desc, had_live_data in exit_results:
        if not had_live_data:
            live_failures.append({"ticker": trade["ticker"], "error": desc})
            continue
        if reason and stock_data:
            exit_price = stock_data["meta"]["current_price"]
            pnl_pct = ((exit_price - trade["entry_price"]) / trade["entry_price"]) * 100
            if not config.dry_run:
                trades = load_trades()
                for t in trades:
                    if t["id"] == trade["id"]:
                        t["status"] = "closed"
                        t["exit_price"] = round(exit_price, 2)
                        t["exit_date"] = today
                        t["exit_reason"] = reason
                        break
                save_trades(trades)
            closed_ids.add(trade["id"])
            report["exits"].append({
                "ticker": trade["ticker"],
                "entry_price": trade["entry_price"],
                "exit_price": round(exit_price, 2),
                "pnl_pct": round(pnl_pct, 2),
                "reason": reason,
                "description": desc,
                "dry_run": config.dry_run,
            })

    # ── Step 2: Check entries ─────────────────────────────────────────────────
    all_trades = load_trades()
    open_tickers = {t["ticker"] for t in all_trades if t["status"] == "open" and t["id"] not in closed_ids}
    current_positions = len(open_tickers)

    if current_positions >= config.max_positions:
        report["summary"] = {
            "exits": len(report["exits"]),
            "entries": 0,
            "message": f"Max positions ({config.max_positions}) already reached — no new entries scanned.",
        }
        return report

    # ── Step 2: Scan all stocks for entries (with live data only) ───────────────
    tickers = [f"{s}.NS" for s in STOCKS_LIST]

    # Phase 1: Run screener on all stocks to filter universe
    async def screen_one_stock(ticker):
        try:
            stock_data = await get_stock_live_only(ticker)
            ind = stock_data["indicators"]
            score = stock_data["score"]["value"]

            # Apply screener filters
            if score < config.min_score:
                return ticker, stock_data, False, [f"Score {score:.0f} < {config.min_score}"], True
            if ind["rsi"] < config.min_rsi or ind["rsi"] > config.max_rsi:
                return ticker, stock_data, False, [f"RSI {ind['rsi']:.1f} outside {config.min_rsi}-{config.max_rsi}"], True
            is_bull = ind["ma200"]["bull_regime"]
            if config.regime == "bull" and not is_bull:
                return ticker, stock_data, False, ["Not in bull regime"], True
            if config.regime == "bear" and is_bull:
                return ticker, stock_data, False, ["Not in bear regime"], True

            # Passed screener
            return ticker, stock_data, True, [], True
        except HTTPException as e:
            return ticker, None, False, [f"Live data unavailable: {e.detail}"], False
        except Exception as e:
            return ticker, None, False, [str(e)], True

    screen_results = await asyncio.gather(*[screen_one_stock(t) for t in tickers])

    # Collect stocks passing screener and track failures
    screened_stocks = []
    for ticker, stock_data, passed, reasons, had_live in screen_results:
        if not had_live:
            live_failures.append({"ticker": ticker, "error": reasons[0] if reasons else "Live data unavailable"})
        elif not passed:
            report["skipped"].append({"ticker": ticker, "reason": "; ".join(reasons)})
        else:
            screened_stocks.append((ticker, stock_data))

    print(f"[MDC SCAN] {len(screened_stocks)}/{len(tickers)} stocks passed screener")

    # Phase 2: Run MDC strategy only on stocks passing screener
    entry_results = []
    for ticker, stock_data in screened_stocks:
        passed, reasons = check_entry_signal(
            stock_data,
            min_score=config.mdc_min_score,
            min_rsi=config.mdc_min_rsi,
            max_rsi=config.mdc_max_rsi,
            min_momentum=config.mdc_min_momentum,
            min_high_ratio=config.mdc_min_high_ratio,
            max_pct_b=config.mdc_max_pct_b,
        )
        entry_results.append((ticker, stock_data, passed, reasons))

    # Sort by score descending so we pick the best signals first
    entry_results_sorted = sorted(
        [(t, sd, p, r) for t, sd, p, r in entry_results],
        key=lambda x: x[1]["score"]["value"],
        reverse=True,
    )

    for ticker, stock_data, passed, reasons in entry_results_sorted:
        if ticker in open_tickers:
            report["skipped"].append({"ticker": ticker, "reason": "Already have open position"})
            continue

        if not passed:
            report["skipped"].append({"ticker": ticker, "reason": "; ".join(reasons)})
            continue

        if current_positions >= config.max_positions:
            report["skipped"].append({"ticker": ticker, "reason": "Max positions reached"})
            continue

        qty = calculate_mdc_position_size(stock_data, config.portfolio_size, config.risk_per_trade, config.max_position_pct)
        if qty == 0:
            report["skipped"].append({"ticker": ticker, "reason": "Position size calculated to 0 (stop too tight or price too high)"})
            continue

        entry_price = stock_data["meta"]["current_price"]
        stop = stock_data["entry_zone"]["stop_atr"]
        target = stock_data["entry_zone"]["target_bb_upper"]
        score = stock_data["score"]["value"]

        new_trade = {
            "id": str(uuid.uuid4()),
            "ticker": ticker,
            "entry_price": round(entry_price, 2),
            "entry_date": today,
            "quantity": qty,
            "stop_loss": round(stop, 2),
            "target": round(target, 2),
            "notes": f"MDC auto-trade. Signals: {'; '.join(reasons)}",
            "entry_score": round(score, 1),
            "status": "open",
            "exit_price": None,
            "exit_date": None,
            "exit_reason": None,
            "auto": True,
        }

        if not config.dry_run:
            trades = load_trades()
            trades.append(new_trade)
            save_trades(trades)

        open_tickers.add(ticker)
        current_positions += 1

        report["entries"].append({
            "ticker": ticker,
            "entry_price": round(entry_price, 2),
            "quantity": qty,
            "stop_loss": round(stop, 2),
            "target": round(target, 2),
            "score": round(score, 1),
            "signals_passed": reasons,
            "position_value": round(entry_price * qty, 2),
            "risk_amount": round((entry_price - stop) * qty, 2),
            "dry_run": config.dry_run,
        })

    report["summary"] = {
        "exits": len(report["exits"]),
        "new_entries": len(report["entries"]),
        "open_positions_after": current_positions,
        "stocks_scanned": len(tickers),
        "live_data_failures": len(live_failures),
    }

    if live_failures:
        report["live_data_errors"] = live_failures
        report["note"] = "Some stocks were skipped due to live data unavailability. Paper trades only run on live market data."

    return report


# ── Equity Curve + Benchmark ──────────────────────────────────────────────────

@app.get("/api/portfolio/equity-curve")
async def portfolio_equity_curve(portfolio_size: float = 1000000):
    """Compute daily portfolio value from paper trades and compare against Nifty 50."""
    trades = load_trades()
    if not trades:
        return {"curve": [], "stats": {}}

    # Collect unique tickers and fetch historical prices
    tickers = list(set(t["ticker"] for t in trades))
    price_lookup: dict[str, dict[str, float]] = {}
    for ticker in tickers:
        try:
            df, _ = fetch_stock_data(ticker)
            price_lookup[ticker] = {
                dt.strftime("%Y-%m-%d"): float(row["Close"])
                for dt, row in df.iterrows()
            }
        except Exception:
            price_lookup[ticker] = {}

    # Fetch Nifty 50 benchmark
    nifty_prices: dict[str, float] = {}
    try:
        nifty_df = yf.Ticker("^NSEI").history(period="2y", interval="1d")
        nifty_df.index = pd.to_datetime(nifty_df.index).tz_localize(None)
        nifty_prices = {
            dt.strftime("%Y-%m-%d"): float(row["Close"])
            for dt, row in nifty_df.iterrows()
        }
    except Exception:
        pass

    # Date range: from earliest trade to today, using Nifty calendar
    entry_dates = [t["entry_date"] for t in trades]
    start_str = min(entry_dates)
    sorted_dates = sorted(d for d in nifty_prices if d >= start_str)
    if not sorted_dates:
        return {"curve": [], "stats": {}}

    nifty_start = nifty_prices.get(sorted_dates[0])

    curve = []
    peak = portfolio_size
    max_dd = 0.0
    last_known: dict[str, float] = {}  # ticker -> last known price (carry forward)

    for date_str in sorted_dates:
        # Cash = portfolio_size - buys + sells (up to this date)
        cash = portfolio_size
        for t in trades:
            if t["entry_date"] <= date_str:
                cash -= t["entry_price"] * t["quantity"]
            if t.get("status") == "closed" and t.get("exit_date") and t["exit_date"] <= date_str:
                cash += (t.get("exit_price") or t["entry_price"]) * t["quantity"]

        # Position value of trades open on this date
        pos_value = 0.0
        for t in trades:
            if t["entry_date"] > date_str:
                continue
            is_closed_before = (
                t.get("status") == "closed"
                and t.get("exit_date")
                and t["exit_date"] <= date_str
            )
            if is_closed_before:
                continue
            # This trade is open on date_str
            price = price_lookup.get(t["ticker"], {}).get(date_str)
            if price is not None:
                last_known[t["ticker"]] = price
            else:
                price = last_known.get(t["ticker"], t["entry_price"])
            pos_value += price * t["quantity"]

        total = cash + pos_value

        # Drawdown tracking
        peak = max(peak, total)
        dd = ((total - peak) / peak) * 100 if peak > 0 else 0
        max_dd = min(max_dd, dd)

        # Benchmark
        nifty_val = None
        if nifty_start and date_str in nifty_prices:
            nifty_val = round(portfolio_size * (nifty_prices[date_str] / nifty_start), 2)

        curve.append({
            "date": date_str,
            "portfolio": round(total, 2),
            "benchmark": nifty_val,
        })

    first_val = curve[0]["portfolio"] if curve else portfolio_size
    last_val = curve[-1]["portfolio"] if curve else portfolio_size
    total_return = ((last_val - first_val) / first_val) * 100

    bench_first = curve[0]["benchmark"] if curve and curve[0]["benchmark"] else None
    bench_last = curve[-1]["benchmark"] if curve and curve[-1]["benchmark"] else None
    bench_return = ((bench_last - bench_first) / bench_first) * 100 if bench_first and bench_last else None

    return sanitize_floats({
        "curve": curve,
        "stats": {
            "total_return_pct": round(total_return, 2),
            "benchmark_return_pct": round(bench_return, 2) if bench_return is not None else None,
            "alpha_pct": round(total_return - bench_return, 2) if bench_return is not None else None,
            "max_drawdown_pct": round(max_dd, 2),
            "days_tracked": len(curve),
            "portfolio_value": last_val,
        },
    })


# ── Trade Post-Mortem ────────────────────────────────────────────────────────

def compute_indicators_at_index(df: pd.DataFrame, idx: int) -> dict | None:
    """Compute indicators using data up to (including) idx."""
    if idx < 200 or idx >= len(df):
        return None
    df_slice = df.iloc[:idx + 1]
    try:
        indicators = calculate_indicators(df_slice)
        score, verdict = calculate_composite_score(indicators)
        return {"indicators": indicators, "score": score, "verdict": verdict}
    except Exception:
        return None


@app.get("/api/trades/{trade_id}/post-mortem")
async def trade_post_mortem(trade_id: str):
    """Generate post-trade analysis for a closed or open trade."""
    trades = load_trades()
    trade = next((t for t in trades if t["id"] == trade_id), None)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    ticker = trade["ticker"]
    df, _ = fetch_stock_data(ticker)

    entry_date = pd.to_datetime(trade["entry_date"])
    exit_date = pd.to_datetime(trade.get("exit_date") or datetime.now().strftime("%Y-%m-%d"))

    entry_idx = min(int(df.index.searchsorted(entry_date)), len(df) - 1)
    exit_idx = min(int(df.index.searchsorted(exit_date)), len(df) - 1)

    # Indicator snapshots
    entry_snap = compute_indicators_at_index(df, entry_idx)
    exit_snap = compute_indicators_at_index(df, exit_idx) if trade.get("status") == "closed" else None

    # Chart: from 10 bars before entry to 10 bars after exit
    chart_start = max(0, entry_idx - 10)
    chart_end = min(len(df), exit_idx + 11)
    chart_data = [
        {"date": dt.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 2)}
        for dt, row in df.iloc[chart_start:chart_end].iterrows()
    ]

    # Hold period stats
    hold_prices = df.iloc[entry_idx:exit_idx + 1]["Close"].astype(float).values
    ep = trade["entry_price"]
    if len(hold_prices) > 0:
        max_gain_pct = ((float(max(hold_prices)) - ep) / ep) * 100
        max_drawdown_pct = ((float(min(hold_prices)) - ep) / ep) * 100
    else:
        max_gain_pct = max_drawdown_pct = 0
    days_held = (exit_date - entry_date).days

    exit_price = trade.get("exit_price") or float(df["Close"].iloc[-1])
    pnl_pct = ((exit_price - ep) / ep) * 100
    pnl_abs = (exit_price - ep) * trade["quantity"]

    # Nifty benchmark over same period
    benchmark_return = None
    try:
        nifty = yf.Ticker("^NSEI").history(
            start=(entry_date - timedelta(days=5)).strftime("%Y-%m-%d"),
            end=(exit_date + timedelta(days=5)).strftime("%Y-%m-%d"),
            interval="1d",
        )
        if not nifty.empty:
            nifty.index = pd.to_datetime(nifty.index).tz_localize(None)
            ni = min(int(nifty.index.searchsorted(entry_date)), len(nifty) - 1)
            nx = min(int(nifty.index.searchsorted(exit_date)), len(nifty) - 1)
            np_ = float(nifty["Close"].iloc[ni])
            nxp = float(nifty["Close"].iloc[nx])
            if np_ > 0:
                benchmark_return = round(((nxp - np_) / np_) * 100, 2)
    except Exception:
        pass

    return sanitize_floats({
        "trade": trade,
        "entry_snapshot": entry_snap,
        "exit_snapshot": exit_snap,
        "hold_stats": {
            "days_held": days_held,
            "max_gain_pct": round(max_gain_pct, 2),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "pnl_pct": round(pnl_pct, 2),
            "pnl_abs": round(pnl_abs, 2),
        },
        "chart_data": chart_data,
        "benchmark_return_pct": benchmark_return,
    })


# ── Signal Replay ────────────────────────────────────────────────────────────

@app.get("/api/replay/{ticker}")
async def signal_replay(
    ticker: str,
    portfolio_size: float = 1000000,
    risk_pct: float = 0.01,
    # Entry strategy parameters
    entry_score: int = 65,
    entry_rsi_min: int = 25,
    entry_rsi_max: int = 55,
    entry_momentum_min: float = 5.0,
    entry_high_ratio_min: float = 0.65,
    entry_pct_b_max: float = 0.55,
    require_bull_regime: bool = True,
    # Exit strategy parameters
    exit_score_threshold: int = 35,
    exit_max_days: int = 126,
    stop_atr_mult: float = 2.0,
    reentry_cooldown_days: int = 5,
    # Win rate filter
    win_rate_filter_enabled: bool = False,
    win_rate_min_trades: int = 5,
    win_rate_threshold: float = 40.0,
    win_rate_penalty_score: int = 75,
    # Consecutive stop circuit breaker
    circuit_breaker_enabled: bool = False,
    circuit_breaker_consecutive_stops: int = 2,
    circuit_breaker_pause_days: int = 30,
):
    """
    Walk through the last ~2 years of data day-by-day, checking configurable entry/exit
    conditions and simulating trades. Returns full timeline for the flight-simulator UI.
    """
    ticker = ticker.upper()
    df, _ = fetch_stock_data(ticker)

    close = df["Close"]
    high_series = df["High"]
    rsi_series = calculate_rsi(close, 14)
    _macd_line, _signal_line, hist_series = calculate_macd(close)
    upper_bb, _mid_bb, _lower_bb, pct_b_series = calculate_bollinger_bands(close, 20, 2)
    ma200_series = close.rolling(window=200).mean()
    atr_series = calculate_atr(df, 14)
    vol_ma20 = df["Volume"].rolling(window=20).mean()
    high_52w_series = high_series.rolling(window=252, min_periods=1).max()

    timeline = []
    sim_trades: list[dict] = []
    position: dict | None = None
    cash = portfolio_size
    last_stop_exit_idx: int | None = None

    # Win rate tracking
    closed_trades_history: list[dict] = []

    # Circuit breaker tracking
    consecutive_stops: int = 0
    circuit_breaker_until_idx: int | None = None

    for i in range(200, len(df)):
        date_str = df.index[i].strftime("%Y-%m-%d")
        cp = float(close.iloc[i])
        rsi = float(rsi_series.iloc[i])
        pct_b = float(pct_b_series.iloc[i])
        ma200 = float(ma200_series.iloc[i])
        bull = cp > ma200
        h52 = float(high_52w_series.iloc[i])
        h_ratio = cp / h52 if h52 > 0 else 0
        mom = ((cp - float(close.iloc[i - 126])) / float(close.iloc[i - 126])) * 100 if i >= 126 else 0
        vol_r = float(df["Volume"].iloc[i]) / float(vol_ma20.iloc[i]) if vol_ma20.iloc[i] > 0 else 1
        atr_val = float(atr_series.iloc[i])

        snap = {
            "rsi": rsi, "macd": {"histogram": float(hist_series.iloc[i])},
            "bollinger_bands": {"pct_b": pct_b}, "momentum_6m": mom,
            "ma200": {"bull_regime": bull}, "volume_ratio": vol_r,
        }
        score, _ = calculate_composite_score(snap)

        conds = {
            "bull_regime": bull if require_bull_regime else True,
            "score_gte": score >= entry_score,
            "rsi_in_range": entry_rsi_min <= rsi <= entry_rsi_max,
            "momentum_gt": mom > entry_momentum_min,
            "high_ratio_gt": h_ratio > entry_high_ratio_min,
            "pct_b_lt": pct_b < entry_pct_b_max,
        }
        all_pass = all(conds.values())
        action = None

        if position:
            if cp <= position["stop"]:
                action = "exit_stop"
            elif cp >= position["target"]:
                action = "exit_target"
            elif score < exit_score_threshold and (not bull if require_bull_regime else False):
                action = "exit_regime"
            elif i - position["entry_idx"] >= exit_max_days:
                action = "exit_time"

            if action:
                pnl_pct = ((cp - position["entry_price"]) / position["entry_price"]) * 100
                cash += cp * position["qty"]
                trade_record = {
                    "entry_date": position["entry_date"], "exit_date": date_str,
                    "entry_price": round(position["entry_price"], 2),
                    "exit_price": round(cp, 2), "pnl_pct": round(pnl_pct, 2),
                    "exit_reason": action,
                }
                sim_trades.append(trade_record)
                closed_trades_history.append(trade_record)

                if action == "exit_stop":
                    last_stop_exit_idx = i
                    consecutive_stops += 1
                    # Trigger circuit breaker if enabled
                    if circuit_breaker_enabled and consecutive_stops >= circuit_breaker_consecutive_stops:
                        circuit_breaker_until_idx = i + circuit_breaker_pause_days
                else:
                    consecutive_stops = 0

                position = None
        else:
            # Check cooldown: skip entry if we're within cooldown period after a stop loss
            in_cooldown = last_stop_exit_idx is not None and i - last_stop_exit_idx < reentry_cooldown_days

            # Check circuit breaker
            in_circuit_breaker = circuit_breaker_enabled and circuit_breaker_until_idx is not None and i < circuit_breaker_until_idx

            # Calculate win rate filter adjustment
            adjusted_entry_score = entry_score
            win_rate_blocked = False
            if win_rate_filter_enabled and len(closed_trades_history) >= win_rate_min_trades:
                wins = sum(1 for t in closed_trades_history if t["pnl_pct"] > 0)
                win_rate = (wins / len(closed_trades_history)) * 100
                if win_rate < win_rate_threshold:
                    # Stock has poor win rate history, require higher score or block
                    adjusted_entry_score = win_rate_penalty_score
                    if score < win_rate_penalty_score:
                        win_rate_blocked = True

            entry_allowed = all_pass and not in_cooldown and not in_circuit_breaker and not win_rate_blocked

            if entry_allowed:
                stop = cp - stop_atr_mult * atr_val
                target = float(upper_bb.iloc[i])
                stop_dist_pct = (cp - stop) / cp if cp > 0 else 0
                if stop_dist_pct > 0:
                    qty = int((portfolio_size * risk_pct) / (cp * stop_dist_pct))
                    max_qty = int((portfolio_size * 0.15) / cp)
                    qty = min(qty, max_qty)
                    if qty > 0 and cash >= cp * qty:
                        cash -= cp * qty
                        position = {
                            "entry_price": cp, "entry_date": date_str,
                            "entry_idx": i, "stop": stop, "target": target, "qty": qty,
                        }
                        action = "entry"

        pos_val = (cp * position["qty"]) if position else 0
        total = cash + pos_val

        # Calculate current win rate for timeline
        current_win_rate = None
        if win_rate_filter_enabled and len(closed_trades_history) >= win_rate_min_trades:
            wins = sum(1 for t in closed_trades_history if t["pnl_pct"] > 0)
            current_win_rate = round((wins / len(closed_trades_history)) * 100, 1)

        timeline.append({
            "date": date_str,
            "price": round(cp, 2),
            "score": round(score, 1),
            "rsi": round(rsi, 1),
            "momentum_6m": round(mom, 1),
            "pct_b": round(pct_b, 3),
            "bull_regime": bull,
            "high_ratio": round(h_ratio, 3),
            "conditions": conds,
            "all_passed": all_pass,
            "in_cooldown": in_cooldown if not position else False,
            "cooldown_days_remaining": (reentry_cooldown_days - (i - (last_stop_exit_idx or 0))) if (in_cooldown if not position else False) else 0,
            "in_circuit_breaker": in_circuit_breaker if not position else False,
            "circuit_breaker_days_remaining": (circuit_breaker_until_idx - i) if (in_circuit_breaker if not position else False) else 0,
            "consecutive_stops": consecutive_stops,
            "win_rate": current_win_rate,
            "win_rate_blocked": win_rate_blocked if not position else False,
            "adjusted_entry_score": adjusted_entry_score if not position else entry_score,
            "action": action,
            "position": {
                "entry_price": round(position["entry_price"], 2),
                "pnl_pct": round(((cp - position["entry_price"]) / position["entry_price"]) * 100, 2),
                "days_held": i - position["entry_idx"],
            } if position else None,
            "portfolio_value": round(total, 2),
        })

    # Close any remaining position at the end
    if position:
        final_price = float(close.iloc[-1])
        sim_trades.append({
            "entry_date": position["entry_date"], "exit_date": timeline[-1]["date"],
            "entry_price": round(position["entry_price"], 2),
            "exit_price": round(final_price, 2),
            "pnl_pct": round(((final_price - position["entry_price"]) / position["entry_price"]) * 100, 2),
            "exit_reason": "open",
        })

    # Stats
    closed_trades = [t for t in sim_trades if t["exit_reason"] != "open"]
    wins = [t for t in closed_trades if t["pnl_pct"] > 0]
    returns = [t["pnl_pct"] for t in closed_trades]

    return sanitize_floats({
        "ticker": ticker,
        "timeline": timeline,
        "trades": sim_trades,
        "stats": {
            "total_trades": len(sim_trades),
            "closed_trades": len(closed_trades),
            "win_rate": round(len(wins) / len(closed_trades) * 100, 1) if closed_trades else None,
            "avg_return": round(float(np.mean(returns)), 2) if returns else None,
            "best_trade": round(max(returns), 2) if returns else None,
            "worst_trade": round(min(returns), 2) if returns else None,
            "final_value": round(timeline[-1]["portfolio_value"], 2) if timeline else portfolio_size,
            "total_return_pct": round(((timeline[-1]["portfolio_value"] - portfolio_size) / portfolio_size) * 100, 2) if timeline else 0,
        },
    })


# ── Multi-Stock Replay ─────────────────────────────────────────────────────────

@app.get("/api/replay-all")
async def replay_all_stocks(
    portfolio_size: float = 1000000,
    risk_pct: float = 0.01,
    # Entry strategy parameters
    entry_score: int = 65,
    entry_rsi_min: int = 25,
    entry_rsi_max: int = 55,
    entry_momentum_min: float = 5.0,
    entry_high_ratio_min: float = 0.65,
    entry_pct_b_max: float = 0.55,
    require_bull_regime: bool = True,
    # Exit strategy parameters
    exit_score_threshold: int = 35,
    exit_max_days: int = 126,
    stop_atr_mult: float = 2.0,
    reentry_cooldown_days: int = 5,
    # Win rate filter
    win_rate_filter_enabled: bool = False,
    win_rate_min_trades: int = 5,
    win_rate_threshold: float = 40.0,
    win_rate_penalty_score: int = 75,
    # Consecutive stop circuit breaker
    circuit_breaker_enabled: bool = False,
    circuit_breaker_consecutive_stops: int = 2,
    circuit_breaker_pause_days: int = 30,
):
    """
    Run replay simulation on all Nifty 50 + Next 50 stocks with configurable strategy.
    Each stock gets its own virtual portfolio, then results are aggregated.
    """
    tickers = [f"{s}.NS" for s in STOCKS_LIST]

    async def run_one(ticker):
        try:
            result = await signal_replay(
                ticker=ticker,
                portfolio_size=portfolio_size,
                risk_pct=risk_pct,
                entry_score=entry_score,
                entry_rsi_min=entry_rsi_min,
                entry_rsi_max=entry_rsi_max,
                entry_momentum_min=entry_momentum_min,
                entry_high_ratio_min=entry_high_ratio_min,
                entry_pct_b_max=entry_pct_b_max,
                require_bull_regime=require_bull_regime,
                exit_score_threshold=exit_score_threshold,
                exit_max_days=exit_max_days,
                stop_atr_mult=stop_atr_mult,
                reentry_cooldown_days=reentry_cooldown_days,
                win_rate_filter_enabled=win_rate_filter_enabled,
                win_rate_min_trades=win_rate_min_trades,
                win_rate_threshold=win_rate_threshold,
                win_rate_penalty_score=win_rate_penalty_score,
                circuit_breaker_enabled=circuit_breaker_enabled,
                circuit_breaker_consecutive_stops=circuit_breaker_consecutive_stops,
                circuit_breaker_pause_days=circuit_breaker_pause_days,
            )
            return {"ticker": ticker, "success": True, "result": result}
        except Exception as e:
            return {"ticker": ticker, "success": False, "error": str(e)}

    all_results = await asyncio.gather(*[run_one(t) for t in tickers])

    # Aggregate successful results
    successful = [r for r in all_results if r["success"]]
    failed = [{"ticker": r["ticker"], "error": r["error"]} for r in all_results if not r["success"]]

    # Sum all trades across all stocks
    all_trades = []
    for sr in successful:
        for trade in sr["result"]["trades"]:
            all_trades.append({
                **trade,
                "ticker": sr["ticker"],
            })

    # Sort by entry date
    all_trades.sort(key=lambda t: t["entry_date"])

    # Per-stock stats
    per_stock = []
    for sr in successful:
        stats = sr["result"]["stats"]
        per_stock.append({
            "ticker": sr["ticker"],
            "total_trades": stats["total_trades"],
            "win_rate": stats["win_rate"],
            "total_return_pct": stats["total_return_pct"],
            "final_value": stats["final_value"],
        })

    # Sort by return
    per_stock.sort(key=lambda x: x["total_return_pct"], reverse=True)

    # Aggregate stats
    total_trades = sum(s["result"]["stats"]["total_trades"] for s in successful)
    closed_trades = sum(s["result"]["stats"]["closed_trades"] for s in successful)
    final_values = [s["result"]["stats"]["final_value"] for s in successful]
    total_final = sum(final_values)
    total_initial = portfolio_size * len(successful)

    # Weighted average return
    all_returns = []
    for s in successful:
        stats = s["result"]["stats"]
        if stats["avg_return"] is not None:
            all_returns.append(stats["avg_return"])

    return sanitize_floats({
        "summary": {
            "stocks_simulated": len(successful),
            "stocks_failed": len(failed),
            "portfolio_per_stock": portfolio_size,
            "total_initial_capital": total_initial,
            "total_final_value": total_final,
            "overall_return_pct": round((total_final - total_initial) / total_initial * 100, 2),
            "total_trades": total_trades,
            "closed_trades": closed_trades,
            "avg_return_per_stock": round(float(np.mean(all_returns)), 2) if all_returns else None,
        },
        "all_trades": all_trades,
        "per_stock": per_stock,
        "top_performers": per_stock[:10],
        "bottom_performers": per_stock[-10:],
        "failed": failed,
    })


# ── Update trade journal notes ───────────────────────────────────────────────

@app.put("/api/trades/{trade_id}/notes")
async def update_trade_notes(trade_id: str, body: dict):
    trades = load_trades()
    for t in trades:
        if t["id"] == trade_id:
            t["journal_notes"] = body.get("journal_notes", "")
            save_trades(trades)
            return t
    raise HTTPException(status_code=404, detail="Trade not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
