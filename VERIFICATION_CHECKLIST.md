# ✅ Finnhub Integration - Verification Checklist

Run through this checklist to verify everything works:

## 1. Dependency Installation ✅

```bash
cd backend
pip3 install -r requirements.txt
```

Expected output:
```
Successfully installed requests python-dotenv pandas numpy fastapi uvicorn
```

Check: **[  ]** All packages installed without errors

---

## 2. Python Syntax ✅

```bash
python3 -m py_compile backend/main.py
```

Expected: No output (success)

Check: **[  ]** Compiles without syntax errors

---

## 3. Required Imports ✅

```bash
python3 -c "import requests; import pandas; from dotenv import load_dotenv; print('✓ All imports OK')"
```

Expected output:
```
✓ All imports OK
```

Check: **[  ]** All imports successful

---

## 4. Backend Startup (No API Key) ✅

```bash
cd backend
python3 -m uvicorn main:app --reload &
sleep 3
curl http://localhost:8000/api/health
kill %1
```

Expected output:
```
{"status":"ok"}
```

Check: **[  ]** Backend starts and health check passes

---

## 5. Stock Endpoint (Mock Data) ✅

```bash
cd backend
python3 -m uvicorn main:app --reload &
sleep 3

# Test without API key (uses mock data)
curl -s http://localhost:8000/api/stock/RELIANCE.NS | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('✓ Ticker:', data['meta']['ticker'])
print('✓ Price:', data['meta']['current_price'])
print('✓ Score:', data['score']['value'])
print('✓ Signals:', len(data['signals']))
print('✓ Chart data points:', len(data['chart_data']))
"

kill %1
```

Expected output:
```
✓ Ticker: RELIANCE.NS
✓ Price: [some number]
✓ Score: [0-100]
✓ Signals: [4-8]
✓ Chart data points: 126
```

Check: **[  ]** Stock endpoint returns valid JSON with all fields

---

## 6. Screener Endpoint ✅

```bash
cd backend
python3 -m uvicorn main:app --reload &
sleep 3

curl -s "http://localhost:8000/api/screen?min_score=60" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'✓ Stocks returned: {len(data)}')
print(f'✓ First stock: {data[0][\"symbol\"]}')
print(f'✓ Scores range: {min(s[\"score\"] for s in data):.0f} - {max(s[\"score\"] for s in data):.0f}')
"

kill %1
```

Expected output:
```
✓ Stocks returned: 20+
✓ First stock: [some ticker]
✓ Scores range: 60-100
```

Check: **[  ]** Screener works and returns multiple stocks

---

## 7. Compare Endpoint ✅

```bash
cd backend
python3 -m uvicorn main:app --reload &
sleep 3

curl -s "http://localhost:8000/api/compare?tickers=TCS.NS,INFY.NS,WIPRO.NS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'✓ Stocks compared: {len(data)}')
for stock in data:
    print(f'  - {stock[\"symbol\"]}: Score {stock[\"score\"]:.0f}')
"

kill %1
```

Expected output:
```
✓ Stocks compared: 3
  - TCS.NS: Score XX
  - INFY.NS: Score XX
  - WIPRO.NS: Score XX
```

Check: **[  ]** Compare endpoint works with multiple stocks

---

## 8. Environment File ✅

Check that `.env` exists in `backend/` folder:

```bash
ls -la backend/.env
cat backend/.env
```

Expected: File exists with content like:
```
FINNHUB_API_KEY=
```

Check: **[  ]** .env file exists in backend folder

---

## 9. Frontend Build ✅

```bash
cd frontend
npm run type-check
npm run build
```

Expected: TypeScript checks pass, build completes with:
```
✓ built in X.XXs
```

Check: **[  ]** Frontend builds successfully without errors

---

## 10. Frontend Runtime ✅

```bash
# Terminal 1
cd backend
python3 -m uvicorn main:app --reload

# Terminal 2
cd frontend
npm run dev
```

Expected: Both start without errors
- Backend: `Uvicorn running on http://0.0.0.0:8000`
- Frontend: `VITE ready in XXX ms`

Visit: http://localhost:5173

Check: **[  ]** Both servers start and frontend loads in browser

---

## 11. With Real API Key ✅ (Optional)

If you have Finnhub API key:

```bash
# Edit backend/.env
FINNHUB_API_KEY=your_key_here

# Restart backend
python3 -m uvicorn main:app --reload

# Check logs - should see:
# ✓ Fetched 730 rows for RELIANCE.NS from Finnhub
# ✓ Fetched 730 rows for TCS.NS from Finnhub
```

Check: **[  ]** Real data loads when API key is set

---

## Summary

Count how many checks you passed:

| Range | Status |
|-------|--------|
| **11/11** | ✅ Perfect - Everything works |
| **10/11** | ✅ Excellent - Minor issue only |
| **9/11** | ✅ Good - Works, minor issues |
| **8/11** | ⚠️ Acceptable - Core works, check logs |
| **<8** | ❌ Problem - Review error messages |

---

## Troubleshooting Quick Reference

### "Port 8000 already in use"
```bash
# Kill existing process
lsof -i :8000
kill -9 <PID>

# Or use different port
python3 -m uvicorn main:app --port 8001
```

### "No FINNHUB_API_KEY set"
This is OK - uses mock data. To use real data:
1. Get key from https://finnhub.io
2. Add to `backend/.env`
3. Restart backend

### "Import errors"
```bash
pip3 install -r requirements.txt --force-reinstall
```

### "JSON decode errors"
Check `.env` file:
- Is it named `.env` (not `.env.txt`)?
- Is it in `backend/` folder?
- Any extra spaces around `=`?

---

## Next: Get Real Data

When ready for real NSE data:

1. **Visit**: https://finnhub.io
2. **Sign up**: Get free API key
3. **Update**: Add key to `backend/.env`
4. **Restart**: Python backend
5. **Verify**: Check logs for "✓ Fetched... from Finnhub"

All tests here should still pass with real data!

---

**Last Updated**: March 2026  
**Status**: ✅ Ready for Production
