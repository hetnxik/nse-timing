# Quick Start Guide

## Prerequisites
- Python 3.8+
- Node.js 16+ & npm

## Step 1: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Step 2: Install Frontend Dependencies

```bash
cd frontend
npm install
```

## Step 3: Start Backend (Terminal 1)

```bash
cd backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
Uvicorn running on http://0.0.0.0:8000
```

Test it:
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"ok"}
```

## Step 4: Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.0.8  ready in XXX ms

➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser.

## Testing the App

### Analyser Page
1. Click "RELIANCE" button
2. Wait 3–5s for data to load
3. You should see:
   - Price header with current price and sparkline
   - Three tabs: Score, Charts, Indicators
   - Score tab shows gauge, signals, and stat cards
   - Charts tab shows 4 technical charts
   - Indicators tab shows 8 detailed cards

### Screener Page
1. Go to Screener
2. Keep default filters (min score 60)
3. Click "Run Screen"
4. You should see 15–25 stocks in a table
5. Click a row to drill into Analyser

### Compare Page
1. Go to Compare
2. Click 4 stock buttons (e.g., RELIANCE, TCS, INFY, HDFCBANK)
3. Click "Compare"
4. You should see:
   - 4 score gauges
   - Indicator comparison table
   - Signal breakdown cards

## Troubleshooting

**Backend won't start**
- Ensure port 8000 is free: `lsof -i :8000`
- Kill process if needed: `kill -9 <PID>`
- Try: `python3 -m uvicorn main:app --port 8001`

**Frontend won't start**
- Ensure port 5173 is free: `lsof -i :5173`
- Try: `npm run dev -- --port 3000`

**API calls fail**
- Ensure backend is running on port 8000
- Check browser console (F12) for errors
- Try: `curl http://localhost:8000/api/health`

**yfinance fails**
- Check internet connection
- NSE data lags on weekends/holidays
- Try a different ticker: INFY, TCS, HDFCBANK

## Next Steps

- Explore different stocks in the Analyser
- Adjust screener filters and re-screen
- Read the full README.md for indicator explanations

Good luck with your analysis!
