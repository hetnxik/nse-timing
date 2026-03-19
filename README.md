# NSE Stock Timing Tool

A full-stack technical analysis tool for identifying statistically optimal entry points for ~6-month holds in NSE-listed stocks. Built with React + Vite, FastAPI, and yfinance.

## Features

- **Stock Analyzer**: Deep dive into individual stocks with technical indicators, charts, and scores
- **Stock Screener**: Scan 30 large-cap NSE stocks and filter by composite score, RSI, and trend regime
- **Stock Compare**: Side-by-side analysis of up to 4 stocks

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Python FastAPI
- **Data**: yfinance (Yahoo Finance API)
- **Charts**: Recharts
- **Styling**: Tailwind CSS
- **State**: Zustand

## Installation & Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Running

### Backend (Terminal 1)

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit `http://localhost:8000/api/health` to verify it's running.

### Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser.

## Testing the Setup

1. **Verify Backend**:
   ```bash
   curl http://localhost:8000/api/stock/RELIANCE.NS
   ```
   Should return JSON with all indicators, score, and chart data.

2. **Load Frontend**: Open http://localhost:5173
   - Go to Analyser tab
   - Click a stock button or search for "RELIANCE"
   - Charts and indicators should load instantly

3. **Run Screener**: Go to Screener tab, click "Run Screen"
   - Should show ~15–25 stocks matching filters
   - Click a row to drill into Analyser

4. **Compare Stocks**: Go to Compare tab
   - Add 4 stocks, click "Compare"
   - See side-by-side gauges and indicator tables

## Composite Score Logic

The score is anchored at 50 and adjusted based on these signals:

### RSI (14-day)
- RSI < 30: +25 (oversold bounce likely)
- RSI 30–45: +12 (bullish without excess)
- RSI 60–70: -5 (weakness building)
- RSI > 70: -20 (overbought, pullback risk)

### MACD (12/26/9)
- Histogram > 0: +15 (bullish momentum)
- Histogram < 0: -10 (bearish momentum)

### Bollinger Bands (20-day, 2σ)
- %B < 0.1: +20 (near lower band, bounce likely)
- %B < 0.3: +10 (lower zone, supportive)
- %B > 0.9: -15 (near upper band, pullback likely)

### 6-Month Momentum (126 trading days)
- Momentum > 15%: +15 (strong uptrend)
- Momentum > 5%: +8 (positive trend)
- Momentum < -15%: -15 (severe downtrend)
- Momentum < -5%: -8 (headwinds present)

### 200-Day Moving Average
- Price above MA200: +20 (bull regime, key for 6-month holds)
- Price below MA200: -20 (bear regime, high risk)

### Volume
- Volume ratio > 1.5x: +5 (high conviction)

**Final score is clamped to 0–100.**

### Verdict Labels
- **75+**: Strong Buy (green)
- **60–74**: Moderate Buy (light green)
- **40–59**: Neutral (amber)
- **25–39**: Caution (orange)
- **<25**: Avoid (red)

## Indicators Explained

All indicators are computed using 2 years of historical daily OHLCV data from yfinance.

### RSI (Relative Strength Index, 14-day)
Measures momentum on a 0–100 scale. Below 30 = oversold (statistically due for a bounce). Above 70 = overbought (pullback risk). For 6-month holds, RSI < 40 at entry improves win rate and reduces risk.

### MACD (Moving Average Convergence Divergence, 12/26/9)
The fast 12-day EMA minus the slow 26-day EMA. When MACD line crosses above the signal line (9-day EMA of MACD), momentum turns bullish. The histogram visualizes this divergence; positive = bulls in control, negative = bears in control.

### Bollinger Bands (20-day SMA, 2 standard deviations)
Price oscillates within upper and lower bands set at 2σ from the 20-day average. Touching extremes is statistically rare and often reverses. %B (0–1) shows where price sits within the bands; <0.2 is near the lower band (bullish), >0.8 is near the upper band (bearish).

### 6-Month Momentum
Price change over 126 trading days (~6 months). Positive momentum confirms an uptrend; negative warns of downtrend risk. Strong momentum (>15%) suggests the trend can persist for another 6 months.

### 200-Day Moving Average
The long-term trend anchor. Price above = bull regime (enter). Price below = bear regime (caution or avoid). Crossing this line is a major inflection point for 6-month strategies.

### ATR (Average True Range, 14-day)
Daily volatility measured in rupees and as % of price. Helps size position risk. High ATR = wide swings (tighter risk management needed). Used for stop-loss and position sizing.

### Volume Ratio
Today's volume divided by the 20-day average. >1.5x = high conviction (bullish confirmation). Low volume = weak moves, not trusted for new entries.

## 30 Screened Stocks

The screener covers these large-cap NSE stocks (Nifty 50 + liquid midcaps):

RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, HINDUNILVR, SBIN, BAJFINANCE, KOTAKBANK, LT, WIPRO, TITAN, AXISBANK, ASIANPAINT, MARUTI, NESTLEIND, ULTRACEMCO, POWERGRID, NTPC, SUNPHARMA, DRREDDY, DIVISLAB, CIPLA, TECHM, HCLTECH, INDUSINDBK, M&M, TATAMOTORS, ONGC, BPCL

## Key Design Principles

- **Data-dense, clean UI**: Monospace numbers, flat cards, minimal gradients
- **6-month bias**: All signals and thresholds are tuned for medium-term holds, not day trades
- **Fundamental + technical**: This tool handles technical/statistical layer; you provide fundamental due diligence
- **Transparent scoring**: See every signal contributing to the score, understand the math
- **Fast, cached**: Backend caches results for 15 minutes; frontend loads instantly on revisit

## Performance Notes

- First fetch of a stock takes 3–5s (yfinance download). Subsequent fetches within 15 min are instant (in-memory cache).
- Screener scans 30 stocks in parallel via asyncio.gather(); completes in ~10–15s.
- All charts render on 6-month daily OHLCV (≈126 bars); smooth performance on modern browsers.

## Troubleshooting

### Backend not responding
- Ensure `uvicorn main:app --reload` is running on port 8000
- Check firewall; allow localhost:8000

### Frontend can't reach API
- Ensure CORS middleware is enabled (it is by default on localhost:5173)
- Check that backend is listening on 0.0.0.0:8000, not just 127.0.0.1

### yfinance fails for a ticker
- Verify the ticker is listed on NSE (should have .NS suffix)
- Check internet connection
- NSE data may be delayed on weekends/holidays

### Charts not rendering
- Ensure Recharts is installed: `npm install recharts`
- Check browser console for errors

## Development

### Add a new indicator
1. Compute it in `backend/main.py` → `calculate_indicators()`
2. Add to JSON schema in `StockData` → `api.ts`
3. Create explanation template in `src/explanations.ts`
4. Add signal generation in `backend/main.py` → `calculate_signals()`
5. Optionally adjust score in `calculate_composite_score()`
6. Display on Analyser → Indicators tab via `IndicatorCard`

### Change scoring weights
- Edit the constants in `backend/main.py` → `calculate_composite_score()`
- Re-run backend and screener to see new scores

## License

MIT
