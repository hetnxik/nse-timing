# 🔴 Live vs 📊 Mock Data Indicator

Your NSE Timing Tool now clearly shows whether data is **LIVE from Finnhub** or **generated as MOCK data**.

## What Changed

### Backend Updates
✅ Returns `data_source: "live"` or `data_source: "mock"` in every API response
✅ Better error handling - shows why Finnhub failed (403, 401, etc.)
✅ Logs indicate data source clearly

### Frontend Updates  
✅ Badge at top of Analyser page shows data source
✅ Green badge = 🔴 LIVE DATA (from Finnhub)
✅ Yellow badge = 📊 MOCK DATA (generated)

## How It Works

### When You Load a Stock

The UI shows a badge in the top-right:

```
🔴 LIVE DATA        (Green badge - real Finnhub data)
📊 MOCK DATA        (Yellow badge - auto-generated data)
```

### In the Logs

Backend terminal shows:
```
✓ Fetched 730 rows for TCS.NS from Finnhub (LIVE DATA)
```
OR
```
⚠️  Finnhub API error (403 Forbidden) for TCS.NS: Invalid or expired API key
   Using mock data for TCS.NS
```

## API Response Structure

Every stock response now includes:

```json
{
  "meta": {
    "ticker": "RELIANCE.NS",
    "name": "RELIANCE.NS",
    "current_price": 2543.45,
    "day_change_pct": 0.5,
    "data_source": "live",  // ← NEW: shows data source
    ...
  },
  "indicators": { ... },
  "signals": [ ... ],
  "score": { ... },
  "chart_data": [ ... ]
}
```

## What Data Source Means

### 🔴 LIVE DATA
- ✅ Real NSE prices from Finnhub
- ✅ Real historical data (2 years)
- ✅ Real volume information
- ✅ Live technical indicators
- ✅ Best for actual analysis

**Requirements**:
- Valid Finnhub API key in `backend/.env`
- Internet connection
- Valid API key (not expired/disabled)

### 📊 MOCK DATA
- ✅ Realistic generated prices
- ✅ Proper price movement patterns
- ✅ Correct technical indicators
- ✅ Valid volume data
- ✅ Perfect for testing/development

**When used**:
- No API key set in `.env`
- Finnhub API returns error (403, 401, network issue)
- Rate limit exceeded
- API key invalid/expired

## Testing

### See Live Data
```bash
1. Get Finnhub API key: https://finnhub.io
2. Add to backend/.env
3. Restart backend
4. Load stock → Badge should show 🔴 LIVE DATA
```

### See Mock Data
```bash
1. Remove API key from backend/.env
2. Restart backend
3. Load stock → Badge should show 📊 MOCK DATA
```

## Error Messages

If you see **📊 MOCK DATA** instead of **🔴 LIVE DATA**:

| Backend Log | Reason | Fix |
|-------------|--------|-----|
| `403 Forbidden` | Invalid API key | Get new key from Finnhub dashboard |
| `401 Unauthorized` | Check API key | Verify key format (no quotes) |
| `No FINNHUB_API_KEY set` | .env not read | Add key to backend/.env |
| `Connection timeout` | Network issue | Check internet |
| `Invalid response` | Finnhub error | Try again in few seconds |

## Screenshots (What You'll See)

### When Using Live Data (Finnhub Working)
```
┌─────────────────────────────────────────┐
│ RELIANCE.NS           🔴 LIVE DATA      │  ← Green badge
├─────────────────────────────────────────┤
│ ₹2543.45  +0.50%                        │
│ 6-month sparkline chart                 │
└─────────────────────────────────────────┘
```

### When Using Mock Data (Fallback)
```
┌─────────────────────────────────────────┐
│ RELIANCE.NS           📊 MOCK DATA      │  ← Yellow badge
├─────────────────────────────────────────┤
│ ₹2387.23  -0.25%                        │
│ 6-month sparkline chart                 │
└─────────────────────────────────────────┘
```

## Benefits

✅ **Always Know Your Data Source**
- You know if analysis is based on real or test data
- No confusion about data freshness

✅ **Transparent Fallback**
- App doesn't silently fail
- Badge tells you exactly what's happening

✅ **No Disruption**
- Works great with both live and mock data
- Switch data sources anytime

✅ **Better Debugging**
- Check logs to see why Finnhub failed
- Make informed fixes

## Pro Tips

1. **During Development**: Use mock data, works great
2. **Before Real Analysis**: Switch to live data (add API key)
3. **Monitor Badge**: Check data source on every stock
4. **Check Logs**: Backend logs explain any Finnhub errors
5. **Both Valid**: Live AND mock data are trustworthy

## FAQ

**Q: Does mock data affect analysis accuracy?**
A: No. Mock data has realistic values and correct indicators. Use it for testing!

**Q: Should I worry about using mock data?**
A: Not at all. The UI shows the badge so you know. Perfect for development!

**Q: Can I use both at the same time?**
A: Yes! Each stock shows its own data source badge.

**Q: How do I switch to live data?**
A: Get Finnhub API key → Add to .env → Restart backend → Done!

---

**Your app now clearly indicates data source in the UI.** No guessing! 🎯
