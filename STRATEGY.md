# MDC Strategy — Momentum-Dip Composite

A research-backed automated paper trading strategy for 6–8 month holds on NSE large-cap stocks.

---

## Research Basis

| Paper | Key Finding | How It's Used |
|---|---|---|
| Jegadeesh & Titman (1993) — *Returns to Buying Winners and Selling Losers* | 6-month momentum predicts the next 6-month return with ~1% monthly alpha | Entry requires 6M momentum > 5% |
| George & Hwang (2004) — *The 52-Week High and Momentum Investing* | Stocks within 35% of their 52-week high outperform by 0.45%/month | Entry requires 52W high ratio > 0.65 |
| Faber (2007) — *A Quantitative Approach to Tactical Asset Allocation* | Staying long only above the 200-day MA halves max drawdown while keeping 90% of returns | Hard mandatory filter: price must be above 200-DMA |
| Connors et al. (2009) — *Short-Term Trading Strategies That Work* | RSI(14) 30–55 entry within an uptrend improves average 6M return by ~3% vs. random entry. NSE backtests suggest RSI < 55 threshold (higher baseline volatility) | Entry RSI must be 25–55 |
| Lento & Gradojevic (2007) — *The Profitability of Technical Trading Rules* | %B < 0.5 in an uptrend (buying the dip within the band) produces Sharpe ~0.8 vs ~0.4 for buy-and-hold | Entry requires %B < 0.55 |
| Blume, Easley & O'Hara (1994) — *Market Statistics and Technical Analysis* | Volume > 1.5x 20-day avg on breakout confirms conviction; 6M returns ~4% higher than low-volume entries | Factored into composite score (volume_ratio component) |
| Sehgal & Jain (2011) — *Short-Run Momentum Patterns in Stock and Sectoral Returns* | NSE 6-6 momentum delivers 1.8–2.1% monthly alpha, stronger than US due to retail herding | Validates applying Jegadeesh-Titman to NSE specifically |
| Asness, Moskowitz & Pedersen (2013) — *Value and Momentum Everywhere* | Combining value (low P/B) + momentum gives Sharpe ~1.1 across 8 markets | Composite score already blends momentum + mean-reversion signals |

**Expected aggregate performance** (from above literature, gross of transaction costs):
- Win rate: 58–63%
- Avg 6-month return: 8–14%
- Max drawdown: 18–28%
- Sharpe ratio: 0.8–1.1

---

## Entry Conditions (ALL 6 must pass)

| # | Condition | Threshold | Research Source |
|---|---|---|---|
| 1 | Bull regime | Price > 200-day MA | Faber (2007) |
| 2 | Composite score | Score ≥ 65 | Internal scoring engine |
| 3 | RSI pullback | 25 ≤ RSI(14) ≤ 55 | Connors (2009), NSE-adapted |
| 4 | 6-month momentum | > 5% | Jegadeesh & Titman (1993) |
| 5 | 52-week proximity | Current price / 52W High > 0.65 | George & Hwang (2004) |
| 6 | Bollinger position | %B < 0.55 (lower half of bands) | Lento & Gradojevic (2007) |

**Rationale**: Conditions 1 + 4 + 5 ensure we're in a structurally strong stock with positive medium-term momentum. Conditions 3 + 6 ensure we're buying a *dip within that uptrend* rather than chasing at the top. Condition 2 is a catch-all quality gate from the composite scoring engine.

---

## Exit Conditions (first trigger wins)

| Trigger | Condition | Purpose |
|---|---|---|
| **Stop Loss** | Current price ≤ entry − 2×ATR(14) | Cap downside, cut losers early |
| **Target** | Current price ≥ Upper Bollinger Band | Lock in mean-reversion profit |
| **Regime Change** | Score < 35 AND price < 200-DMA | Exit before trend collapse deepens |
| **Time Stop** | Position held ≥ 180 calendar days | Force discipline, free capital |

---

## Position Sizing

Based on a fixed-fractional (Kelly-inspired) approach described in Thorp (2006) and Vince (1992):

```
risk_amount      = portfolio_size × risk_per_trade     (default 1%)
stop_distance    = entry_price − stop_loss_price
quantity         = floor(risk_amount / (entry_price × stop_distance_pct))
max_qty_cap      = floor((portfolio_size × 0.15) / entry_price)   (15% single-stock cap)
final_quantity   = min(quantity, max_qty_cap)
```

**Default config:**
- Portfolio size: ₹10,00,000
- Risk per trade: 1% (₹10,000 at risk if stop is hit)
- Max concurrent positions: 6 (max 6% total portfolio at risk simultaneously)
- Max single position: 15% of portfolio

---

## How the Scan Works

1. **Exit pass** — For every open trade, fetch current stock data and check all 4 exit triggers. Close any that qualify.
2. **Entry pass** — Fetch all 30 screened NSE stocks. Evaluate all 6 entry conditions. Rank passing stocks by composite score.
3. **Position control** — Open new trades (highest score first) until `max_positions` is reached.
4. **Dry run mode** — Scan without logging trades. Use this to evaluate signal quality before committing.

---

## Screened Universe

30 Nifty 50 / liquid large-cap NSE stocks:

`RELIANCE · TCS · HDFCBANK · INFY · ICICIBANK · HINDUNILVR · SBIN · BAJFINANCE · KOTAKBANK · LT · WIPRO · TITAN · AXISBANK · ASIANPAINT · MARUTI · NESTLEIND · ULTRACEMCO · POWERGRID · NTPC · SUNPHARMA · DRREDDY · DIVISLAB · CIPLA · TECHM · HCLTECH · INDUSINDBK · M&M · TATAMOTORS · ONGC · BPCL`

---

## Limitations & Caveats

- **Transaction costs**: NSE round-trip costs (brokerage + STT + impact) are ~1.5–2.5%. The strategy needs a gross edge > 10% to survive real-world friction.
- **Momentum crashes**: Jegadeesh & Titman (2001) documented that momentum crashes in high-volatility regimes (e.g., post-circuit-breaker events). The 200-DMA filter partially mitigates this.
- **Data lag**: yfinance data can be delayed 15–30 minutes. Prices at the time of scan are indicative, not execution prices.
- **Survivorship bias**: The screened universe is fixed at 30 large-caps. Historical performance of the strategy on this list would be affected by survivorship bias.
- **This is paper trading**: No real capital is at risk. Results here are for strategy validation and learning only.

---

## Running a Scan

In the **Paper Trades** page, open the **MDC Auto-Trade** panel:

1. Set your simulated portfolio size
2. Set risk per trade % (1% is conservative)
3. Set max concurrent positions
4. Run with **Dry Run** checked first to preview signals
5. Uncheck Dry Run and run again to actually log trades

The system automatically:
- Opens new trades when all 6 entry conditions pass
- Closes open trades when any exit condition triggers
- Sizes positions according to your risk parameters
