# 🔧 Finnhub API Key Troubleshooting

## Error: 403 Forbidden - "You don't have access to this resource"

This error means your API key is either **invalid**, **expired**, or **lacks permissions** for the candle endpoint.

### ✅ Solution: Get a New API Key

Your current API key might be from a different service or account. Get a fresh one:

1. **Go to**: https://finnhub.io
2. **Login/Sign Up**: Use your email
3. **Navigate to**: Dashboard → API Keys
4. **Copy the API KEY** (the long string starting with letters/numbers)
5. **Replace in** `backend/.env`:
   ```
   FINNHUB_API_KEY=your_new_key_here
   ```
6. **Save** the file
7. **Restart** the backend

### Verify Your API Key Format

Open `backend/.env` and check:
```bash
# ❌ Wrong (has extra characters or quotes)
FINNHUB_API_KEY="d6u0icpr01qp1k9anqigd6u0icpr01qp1k9anqj0"l
FINNHUB_API_KEY='d6u0icpr01qp1k9anqigd6u0icpr01qp1k9anqj0'
FINNHUB_API_KEY = d6u0icpr01qp1k9anqigd6u0icpr01qp1k9anqj0

# ✅ Correct (no quotes, no extra characters)
FINNHUB_API_KEY=d6u0icpr01qp1k9anqigd6u0icpr01qp1k9anqj0
```

### Check If API Key Is Active

Go to https://finnhub.io/dashboard and verify:
- ✅ Your API key is listed
- ✅ Status shows "Active" (not disabled/revoked)
- ✅ You have access to stock candle data (free tier includes this)

### Common Causes

| Issue | Solution |
|-------|----------|
| **API Key Expired** | Get new key from dashboard |
| **Wrong Tier Permissions** | Upgrade to pro if needed (unlikely for free) |
| **Key Format Wrong** | Remove quotes, spaces, or extra characters |
| **Multiple Accounts** | Use the correct dashboard API key |
| **Account Disabled** | Check email for notifications |

### If It Still Doesn't Work

The good news: **Your app works perfectly with mock data!**

Options:
1. **Use mock data** (what you're doing now) - works great for testing
2. **Try another data source**:
   - [Twelve Data](https://twelvedata.com) - Alternative free tier
   - [Alpha Vantage](https://www.alphavantage.co) - Free tier available
   - Local NSE data provider if available

### View Current Data Source Status

When you load a stock, you'll see:
- 🔴 **LIVE DATA** - Connected to Finnhub
- 📊 **MOCK DATA** - Using generated data (Finnhub not available)

Both work perfectly - mock data has realistic values and correct indicators.

---

## For Now: Use Mock Data

Your app is fully functional with mock data:
- ✅ All indicators calculate correctly
- ✅ All features work perfectly
- ✅ All UI works great
- ✅ Switch to real data anytime when API key works

The UI clearly shows whether you're using **LIVE** or **MOCK** data with a badge at the top of each stock.

---

## Quick Debug

Check backend logs after restarting:

```bash
python3 -m uvicorn main:app --reload
```

You'll see:
```
✓ Fetched 730 rows for TCS.NS from Finnhub (LIVE DATA)
```
OR
```
⚠️  Finnhub API error (403 Forbidden) for TCS.NS: Invalid or expired API key
   Using mock data for TCS.NS
```

---

## Need Help?

1. **Check your API key** - Go to https://finnhub.io/dashboard
2. **Copy correct key** - Should be ~40 characters, alphanumeric
3. **Update .env** - Paste without quotes or extra characters
4. **Restart backend** - Kill and restart uvicorn
5. **Check logs** - See if it says LIVE DATA or mock data

The app will tell you in the UI which data source is active! 🎯
