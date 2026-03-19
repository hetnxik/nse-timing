# ⚡ Start Using Real Data NOW (5 Minutes)

## Step 1: Get Finnhub API Key (2 minutes)

**Go here**: https://finnhub.io

Click "Get Free API Key" → Sign up with email → Done!

Copy the API key (looks like: `co1234567890abcdef`)

## Step 2: Add API Key to Backend (30 seconds)

Open `backend/.env` and replace:
```
FINNHUB_API_KEY=your_api_key_here
```

With your actual key:
```
FINNHUB_API_KEY=co1234567890abcdef
```

Save file.

## Step 3: Install Dependencies (2 minutes)

```bash
cd backend
pip3 install -r requirements.txt
```

It will install: requests, python-dotenv, pandas, numpy, fastapi, uvicorn

## Step 4: Start Backend

Terminal 1:
```bash
cd backend
python3 -m uvicorn main:app --reload
```

You'll see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Check logs - you should see:
```
✓ Fetched 730 rows for RELIANCE.NS from Finnhub
✓ Fetched 730 rows for TCS.NS from Finnhub
...
```

If it says "No FINNHUB_API_KEY set", your .env file isn't being read. Check:
- File is named `.env` (not `.env.txt`)
- File is in `backend/` folder
- No extra spaces around `=`

## Step 5: Start Frontend

Terminal 2:
```bash
cd frontend
npm run dev
```

You'll see:
```
VITE v5.4.21  ready in XXX ms

➜  Local:   http://localhost:5173/
```

## Step 6: Open Browser

Visit: **http://localhost:5173**

Click any stock button → **See real NSE data!** 📊

---

## That's It! 🎉

You now have:
- ✅ Real NSE stock data
- ✅ 2 years of historical data per stock
- ✅ Live technical indicators
- ✅ Working screener & comparison tool
- ✅ Auto fallback to mock data if anything fails

## What If...?

**"I don't see 'Fetched 730 rows' in logs"**
- API key missing or wrong in `.env`
- Check backend terminal - any error messages?
- Restart backend after updating `.env`

**"Still showing mock data"**
- That's fine! Still works perfectly
- Check you copied API key correctly
- Make sure `.env` is in `backend/` folder

**"Getting API errors"**
- Check internet connection
- Make sure Finnhub API key is valid (test at https://finnhub.io/dashboard)
- Wait 60 seconds (rate limit is 60 calls/minute)

**"Want to use without API key"**
- It works! Just leave `.env` empty
- Will use realistic mock data instead
- Switch to real data anytime by adding key

---

## Next Steps

1. Explore **Analyser** - dive deep into 1 stock
2. Run **Screener** - find best entry points
3. Use **Compare** - evaluate multiple stocks side-by-side

---

**Questions?** Check:
- `FINNHUB_SETUP.md` - detailed setup guide
- `FINNHUB_INTEGRATION.md` - technical details
- `README.md` - full documentation

**Enjoy!** 🚀
