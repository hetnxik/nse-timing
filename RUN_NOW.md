Build a full-stack NSE stock timing tool to help me identify statistically good entry points for ~6 month holds. I understand fundamental analysis — this tool handles the statistical/technical layer.

## Stack
- Frontend: React + Vite (TypeScript)
- Backend: Python FastAPI
- Data: yfinance for historical NSE data
- Charts: Recharts
- Styling: Tailwind CSS

## Backend (FastAPI)

Create `backend/main.py` with these endpoints:

**GET /api/stock/{ticker}**
Fetch 2 years of daily OHLCV data via yfinance and compute all indicators. Return JSON with:
- Meta: name, current price, day change %, 52W high/low, exchange
- Computed indicators:
  - RSI (14-day)
  - MACD (12/26/9) — line, signal, histogram
  - Bollinger Bands (20-day, 2σ) — upper, mid, lower, %B
  - 6-month momentum (126 trading days)
  - 200-day MA — value, % above/below, bull/bear regime flag
  - ATR (14-day) — absolute and as % of price
  - Volume ratio — today vs 20-day average
- Composite score (0–100) with verdict label
- Signal breakdown array — each signal has type (bullish/bearish/neutral) and description string
- Raw OHLCV for last 6 months (for charts)

**Scoring logic:**
Anchor at 50. Apply these adjustments:
- RSI < 30: +25, RSI 30–45: +12, RSI 60–70: -5, RSI > 70: -20
- MACD histogram > 0: +15, < 0: -10
- BB %B < 0.1: +20, %B < 0.3: +10, %B > 0.9: -15
- 6M momentum > 15%: +15, > 5%: +8, < -15%: -15, < -5%: -8
- Price above 200-DMA: +20, below: -20
- Volume ratio > 1.5x: +5
Clamp final score to 0–100.

**GET /api/compare?tickers=TCS.NS,INFY.NS,WIPRO.NS**
Run the same analysis on multiple tickers in parallel (asyncio.gather). Return array of summary objects: symbol, score, verdict, price, RSI, 6M momentum, above200DMA flag.

**GET /api/screen**
Query params: min_score (default 60), min_rsi (default 0), max_rsi (default 100), regime (bull/bear/any)
Screen a hardcoded list of 30 large-cap NSE stocks: RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, HINDUNILVR, SBIN, BAJFINANCE, KOTAKBANK, LT, WIPRO, TITAN, AXISBANK, ASIANPAINT, MARUTI, NESTLEIND, ULTRACEMCO, POWERGRID, NTPC, SUNPHARMA, DRREDDY, DIVISLAB, CIPLA, TECHM, HCLTECH, INDUSINDBK, M&M, TATAMOTORS, ONGC, BPCL (append .NS to each).
Run all in parallel, filter by params, return sorted by score descending.

Add CORS middleware for localhost:5173. Cache results in a simple in-memory dict with 15-minute TTL.

## Frontend (React + Vite)

**Three pages via React Router: Analyser | Screener | Compare**

---

### Analyser page

Ticker input (Enter to submit) + quick-pick buttons for all 30 stocks.

After loading a stock, show:
- Price header: symbol, full name, current price, day change % badge
- 6-month price sparkline (Recharts LineChart, no axes, just the line)

Three tabs: **Score | Charts | Indicators**

**Score tab**
- SVG semicircle gauge (coloured arc, 0–100)
- Verdict label with colour
- Signal cards list — each signal has a coloured dot, a short title, and a one-sentence plain-English explanation of what it means and why it matters for a 6-month hold. Write these explanations as static strings in the frontend based on the signal type and value, not from the API.
- Four stat cards: 52W High, 52W Low, distance from 52W High %, ATR%

**Charts tab**
Show four Recharts charts stacked vertically, each with a title, the chart itself, and 2–3 sentences below it explaining what the chart shows and how to read it for a 6-month entry decision:
1. Price + 200-day MA line (dual lines on one chart)
2. RSI line chart with horizontal reference lines at 30 and 70
3. MACD histogram + signal line
4. Bollinger Bands (upper, mid, lower as lines, price as a fourth line)

**Indicators tab**
Grid of 8 cards, one per indicator. Each card has:
- Indicator name
- Computed value (large, colour coded)
- Interpretation label (e.g. "Oversold", "Bull regime")
- A 2–3 sentence explanation of what this indicator measures, what the current value means, and what a 6-month investor should take away from it. Write these as static template strings populated with the actual numbers.

---

### Screener page

Filters: min score slider, RSI range (dual handle), regime toggle (Bull / Bear / Any), "Run Screen" button.
Results table: Symbol, Score (coloured pill), Verdict, Price, RSI, 6M Momentum %, Regime badge.
Clicking a row navigates to Analyser with that ticker pre-loaded and auto-fetched.

---

### Compare page

Search and add up to 4 tickers. Side-by-side cards showing score gauge, all indicator values, signal count breakdown (how many bullish / neutral / bearish signals). A summary table at the bottom comparing all 7 indicators across the selected stocks.

---

## Explanation strings — important

All explanations in the UI are written as TypeScript template literals in a file `src/explanations.ts`. They are plain English, concise, written for someone who knows fundamental analysis but wants to understand what each statistic is telling them right now about timing. Examples of the style to use:

- RSI explanation (when oversold): `RSI is at ${rsi}, which is in oversold territory (below 30). This means the stock has fallen faster than its historical average, and a bounce is statistically more likely. For a 6-month hold, entering when RSI is oversold historically improves your entry price.`
- 200-DMA explanation (when above): `The price is ${pct}% above its 200-day moving average (₹${ma200}), which confirms you are in a long-term uptrend. Most 6-month momentum strategies require this condition before entering — it filters out value traps in structural downtrends.`
- BB explanation (when near lower band): `Price is near the lower Bollinger Band (%B = ${pctB}). Bollinger Bands are set at 2 standard deviations from the 20-day average, so touching the lower band is statistically rare and often precedes a bounce back toward the middle band (₹${mid}), which would represent a ~${upside}% gain from here.`

Write similar strings for all signals and indicator cards.

---

## State management
Zustand store. Keep: currentStock, watchlist (localStorage), compareList, screenerResults, screenerFilters.

## Colour system
- Strong Buy: #1a7a4a, Moderate Buy: #2d9e68, Neutral: #b07a20, Caution: #c05a30, Avoid: #9b2020
- Bullish signal: green bg, bearish: red bg, neutral: grey bg
- Charts: price = #2563eb, MA200 = #f59e0b, RSI = #8b5cf6, MACD = #10b981, signal line = #f43f5e, BB lines = #94a3b8

## Design
Clean, data-dense. Monospace font for all numbers (font-mono). Flat cards, 1px borders, no gradients, no shadows. Works well in both light and dark mode via Tailwind's dark: classes.

## Project structure
project/
backend/
main.py
requirements.txt
frontend/
src/
components/
ScoreGauge.tsx
SignalCard.tsx
MiniChart.tsx
IndicatorCard.tsx
pages/
Analyser.tsx
Screener.tsx
Compare.tsx
explanations.ts      ← all explanation strings live here
store.ts
api.ts
vite.config.ts
tailwind.config.js
README.md

## README
Include:
- How to run (pip install, npm install, uvicorn, vite)
- How the composite score is calculated, step by step
- What each indicator measures and why it was chosen for 6-month holds
- The full list of 30 screened stocks

## After scaffolding
1. Start FastAPI, hit /api/stock/RELIANCE.NS, confirm valid JSON with all fields
2. Start Vite, confirm the Analyser loads and charts render
3. Run the Screener with default filters, confirm results appear
4. Fix any CORS, import, or type errors