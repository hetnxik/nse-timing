import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import asyncio
from typing import Optional
import time
import yfinance as yf

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache with TTL
cache = {}
CACHE_TTL = 900  # 15 minutes

STOCKS_LIST = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN",
    "BAJFINANCE", "KOTAKBANK", "LT", "WIPRO", "TITAN", "AXISBANK", "ASIANPAINT",
    "MARUTI", "NESTLEIND", "ULTRACEMCO", "POWERGRID", "NTPC", "SUNPHARMA",
    "DRREDDY", "DIVISLAB", "CIPLA", "TECHM", "HCLTECH", "INDUSINDBK", "M&M",
    "TATAMOTORS", "ONGC", "BPCL"
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


def fetch_stock_data(ticker: str) -> tuple:
    """Fetch 2 years of OHLCV data via yfinance. Returns (DataFrame, is_live_data)."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="2y", interval="1d")

        if df.empty:
            print(f"⚠️  No data found for {ticker} via yfinance. Using mock data.")
            return generate_mock_data(ticker), False

        df = df[['Open', 'High', 'Low', 'Close', 'Volume']].astype(float)
        df.index = pd.to_datetime(df.index).tz_localize(None)

        print(f"✓ Fetched {len(df)} rows for {ticker} from yfinance (LIVE DATA)")
        return df, True

    except Exception as e:
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


@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str):
    """Fetch stock data and compute all indicators."""
    ticker = ticker.upper()

    # Check cache
    cached = get_cached(ticker)
    if cached:
        return cached

    # Fetch data
    df, is_live = fetch_stock_data(ticker)

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
    }

    set_cache(ticker, response)
    return response


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


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
