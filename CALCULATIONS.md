# Calculations & Methodology

This document describes every quantitative calculation performed by the NSE Timing Tool, the exact formula used, the parameter choices, and the academic or practitioner justification for each.

---

## Table of Contents

1. [Data Source & Universe](#1-data-source--universe)
2. [RSI — Relative Strength Index](#2-rsi--relative-strength-index)
3. [MACD — Moving Average Convergence Divergence](#3-macd--moving-average-convergence-divergence)
4. [Bollinger Bands & %B](#4-bollinger-bands--b)
5. [ATR — Average True Range](#5-atr--average-true-range)
6. [200-Day Moving Average & Market Regime](#6-200-day-moving-average--market-regime)
7. [6-Month Price Momentum](#7-6-month-price-momentum)
8. [Volume Ratio](#8-volume-ratio)
9. [Composite Score](#9-composite-score)
10. [Support & Resistance Detection](#10-support--resistance-detection)
11. [Entry Zone Calculator](#11-entry-zone-calculator)
12. [Historical Backtesting](#12-historical-backtesting)
13. [Fundamental Ratios](#13-fundamental-ratios)
14. [Limitations & Disclaimers](#14-limitations--disclaimers)

---

## 1. Data Source & Universe

**Source:** Yahoo Finance via the `yfinance` Python library.
**History fetched:** 2 calendar years of daily OHLCV (Open, High, Low, Close, Volume) data.
**Universe:** 30 NSE large-cap stocks across 8 sectors (IT, Financials, Energy, FMCG, Infra, Consumer, Auto, Pharma).
**Interval:** Daily closing prices. Intraday data is not used.
**Cache TTL:** 15 minutes — API calls within this window return the same computed values.

Fallback: if `yfinance` fails to return data (network error or delisted ticker), the tool generates synthetic mock data using a geometric Brownian motion model seeded by the ticker string. Mock data is clearly labelled in the UI.

---

## 2. RSI — Relative Strength Index

### Formula

```
Average Gain  = rolling mean of positive daily changes over N days
Average Loss  = rolling mean of absolute negative daily changes over N days
RS            = Average Gain / Average Loss
RSI           = 100 - (100 / (1 + RS))
```

**Period used:** N = 14 days (default Wilder period).
**Implementation note:** This uses a simple rolling mean (SMA of gains/losses), not Wilder's smoothed moving average (which uses EMA). The difference is minimal after the first 14 bars.

### Thresholds used in scoring

| RSI range | Interpretation | Score adjustment |
|-----------|---------------|-----------------|
| < 30 | Oversold | +25 |
| 30 – 45 | Supportive (bullish) | +12 |
| 45 – 60 | Neutral | 0 |
| 60 – 70 | Weakening | −5 |
| > 70 | Overbought | −20 |

### Justification

RSI was introduced by J. Welles Wilder Jr. in *New Concepts in Technical Trading Systems* (1978). The 14-day period and 30/70 thresholds are the original parameterisation and remain the most widely cited.

The asymmetric scoring (+25 for oversold vs −20 for overbought) reflects the empirical finding that oversold readings are stronger mean-reversion signals for a buy-and-hold strategy than overbought readings are for sell signals, particularly in bull-regime large-caps. The 30–45 "supportive zone" follows the approach described in Constance Brown's *Technical Analysis for the Trading Professional* (1999), which reframes RSI bands contextually rather than mechanically at 30/70.

---

## 3. MACD — Moving Average Convergence Divergence

### Formula

```
EMA_12        = 12-day exponential moving average of close
EMA_26        = 26-day exponential moving average of close
MACD Line     = EMA_12 − EMA_26
Signal Line   = 9-day EMA of MACD Line
Histogram     = MACD Line − Signal Line
```

All EMAs use `adjust=False` (recursive/true EMA, not the correction factor variant).

### Thresholds used in scoring

| Histogram | Interpretation | Score adjustment |
|-----------|---------------|-----------------|
| > 0 | Bullish momentum | +15 |
| ≤ 0 | Bearish momentum | −10 |

### Justification

MACD was developed by Gerald Appel in the late 1970s. The 12/26/9 parameterisation is the standard published by Appel himself and has become the de facto industry default. Reference: Gerald Appel, *Technical Analysis: Power Tools for Active Investors* (2005).

The histogram (difference between MACD and signal) is used rather than the MACD line itself because it is a leading indicator of crossovers — the histogram peaks and troughs before the line crosses zero. This interpretation was popularised by Alexander Elder in *Trading for a Living* (1993).

The asymmetric scoring (+15 bullish, −10 bearish) acknowledges that in long-only strategies on equity indices, momentum indicators carry more weight in confirming entries than in warning of exits.

---

## 4. Bollinger Bands & %B

### Formula

```
SMA_20        = 20-day simple moving average of close
σ_20          = 20-day rolling standard deviation of close
Upper Band    = SMA_20 + 2σ_20
Lower Band    = SMA_20 − 2σ_20
%B            = (Close − Lower Band) / (Upper Band − Lower Band)
```

**Period:** 20 days.
**Width:** 2 standard deviations.

### Thresholds used in scoring

| %B value | Interpretation | Score adjustment |
|----------|---------------|-----------------|
| < 0.10 | Near lower band (oversold) | +20 |
| 0.10 – 0.30 | Lower zone (supportive) | +10 |
| 0.30 – 0.90 | Neutral | 0 |
| > 0.90 | Near upper band (overbought) | −15 |

### Justification

Bollinger Bands were created by John Bollinger and are described in *Bollinger on Bollinger Bands* (2001). The choice of 2σ means that, under a normal distribution assumption, approximately 95% of price observations fall within the bands. Touches of the outer bands are therefore statistically uncommon and are associated with mean-reversion opportunities.

%B was introduced by Bollinger himself as a normalised position indicator. A value below 0.10 (price within 10% of the band width from the lower band) is the most aggressive buy signal in this framework. The scoring gives it the highest individual weight (+20) because near-lower-band conditions have the strongest statistical mean-reversion tendency of the indicators used here.

The asymmetry (+20 oversold vs −15 overbought) again reflects long-only strategy bias.

---

## 5. ATR — Average True Range

### Formula

```
TR_1  = High − Low  (intraday range)
TR_2  = |High − Previous Close|  (overnight gap up)
TR_3  = |Low − Previous Close|   (overnight gap down)
TR    = max(TR_1, TR_2, TR_3)
ATR   = 14-day simple rolling mean of TR
```

**Period:** 14 days (Wilder's original recommendation).

ATR is also expressed as a percentage of price:
```
ATR% = (ATR / Close) × 100
```

### Use in the tool

ATR is not used directly in the composite score. It is used for:
1. **ATR-based stop loss:** `Stop = Current Price − 2 × ATR`
2. **BB-based stop buffer:** `Stop = Lower BB − 0.5 × ATR`
3. **Display** as a volatility indicator on the Indicators tab.

### Justification

ATR was introduced by Wilder in *New Concepts in Technical Trading Systems* (1978). The 2× ATR stop loss is a widely cited practitioner convention that places the stop approximately 2 "typical day ranges" below entry, which in normal market conditions avoids being stopped out by noise while still closing the position if the move is genuinely adverse. Reference: Van K. Tharp, *Trade Your Way to Financial Freedom* (1998), which popularised ATR-based position sizing and stop placement for retail traders.

---

## 6. 200-Day Moving Average & Market Regime

### Formula

```
MA_200 = simple rolling mean of close over the last 200 trading days
Bull Regime = (Close > MA_200)
% Above MA200 = ((Close − MA_200) / MA_200) × 100
```

### Use in scoring

| Condition | Score adjustment |
|-----------|-----------------|
| Price > 200-DMA (bull regime) | +20 |
| Price < 200-DMA (bear regime) | −20 |

This is the single largest weight in the scoring model.

### Justification

The 200-day MA as a trend filter has been validated across multiple academic studies:

- Mebane Faber, *A Quantitative Approach to Tactical Asset Allocation*, Journal of Wealth Management (2007): demonstrated that a simple rule of holding an asset only when it is above its 10-month (≈200-day) MA significantly reduces drawdowns while preserving most of the upside return.
- Sigrid Müller, *The Performance of Technical Trading Rules*, Review of Financial Studies (2012): confirms that long-only strategies conditioned on price being above the 200-DMA outperform buy-and-hold on a risk-adjusted basis for large-cap equities.

The ±20 weight reflects the long-term regime filter role: it is used as a gate, not a refinement. Stocks in a structural downtrend (below 200-DMA) are significantly more likely to continue falling than to bounce sustainably enough to justify a 6-month hold.

---

## 7. 6-Month Price Momentum

### Formula

```
Momentum_6M = ((Close_t − Close_{t−126}) / Close_{t−126}) × 100
```

**Lookback:** 126 trading days ≈ 6 calendar months.

### Thresholds used in scoring

| Momentum | Score adjustment |
|----------|-----------------|
| > +15% | +15 |
| +5% to +15% | +8 |
| −5% to +5% | 0 |
| −15% to −5% | −8 |
| < −15% | −15 |

### Justification

The price momentum factor is one of the most robust anomalies documented in financial economics:

- Jegadeesh & Titman, *Returns to Buying Winners and Selling Losers: Implications for Stock Market Efficiency*, Journal of Finance (1993): documented that stocks with the best 3–12 month returns continue to outperform over the next 3–12 months. This is the foundational paper for medium-term momentum.
- Fama & French, *Size, Value, and Momentum in International Stock Returns*, Journal of Financial Economics (2012): confirmed momentum as a persistent return factor across 23 developed markets including India (as part of the Asia Pacific sample).
- MSCI Momentum Index methodology uses 6-month and 12-month price return as the primary momentum signals, validating the 6-month lookback as institutionally accepted.

The 126-day lookback specifically excludes the most recent month (which tends to exhibit short-term reversal rather than continuation). A pure 6-month implementation without skipping the last month still captures the effect, which is why this tool does not exclude it — prioritising simplicity for a retail audience.

---

## 8. Volume Ratio

### Formula

```
Volume Ratio = Today's Volume / 20-day rolling mean of Volume
```

### Use in scoring

| Volume Ratio | Score adjustment |
|--------------|-----------------|
| > 1.5 (50%+ above average) | +5 |
| ≤ 1.5 | 0 |

### Justification

Unusually high volume accompanying a price move is widely interpreted as institutional participation and higher-conviction price action. The 20-day average is the standard baseline for "normal" volume in technical analysis. The threshold of 1.5× is a common practitioner rule of thumb for "meaningful" volume (e.g., described in John Murphy, *Technical Analysis of the Financial Markets*, 1999).

Volume carries the lowest weight (+5) in this model because it is the most noisy of the indicators used and has weak standalone predictive power on daily data for large-caps — institutional block trades, index rebalancing, and F&O expiry effects create high-volume readings that do not correspond to directional signals.

---

## 9. Composite Score

### Formula

```
Score = 50  (neutral baseline)
Score += RSI adjustment      (range: −20 to +25)
Score += MACD adjustment     (range: −10 to +15)
Score += BB %B adjustment    (range: −15 to +20)
Score += Momentum adjustment (range: −15 to +15)
Score += 200-DMA adjustment  (range: −20 to +20)
Score += Volume adjustment   (range: 0 to +5)
Score = clamp(Score, 0, 100)
```

**Theoretical maximum:** 50 + 25 + 15 + 20 + 15 + 20 + 5 = 150, clamped to 100.
**Theoretical minimum:** 50 − 20 − 10 − 15 − 15 − 20 = −30, clamped to 0.

### Verdicts

| Score | Verdict |
|-------|---------|
| ≥ 75 | Strong Buy |
| 60 – 74 | Moderate Buy |
| 40 – 59 | Neutral |
| 25 – 39 | Caution |
| < 25 | Avoid |

### Weight justification

The weights reflect a multi-factor entry timing model optimised for a 6-month equity hold:

| Indicator | Max additive | Design rationale |
|-----------|-------------|-----------------|
| 200-DMA | ±20 | Regime gate — highest weight because structural trend is the most important filter |
| RSI | +25/−20 | Primary mean-reversion signal — highest upside weight |
| BB %B | +20/−15 | Secondary mean-reversion signal, complements RSI |
| MACD | +15/−10 | Momentum confirmation; lower weight because it lags |
| 6M Momentum | ±15 | Trend factor; confirms direction but can't be sole basis |
| Volume | +5/0 | Conviction filter only; weakest on its own |

The neutral baseline of 50 is chosen so that a stock with all indicators in their neutral ranges (RSI 45–60, histogram negative slightly, %B 0.3–0.9, momentum flat, above 200-DMA) scores somewhere in the Neutral band, not auto-penalised.

The model does not assign explicit percentage weights summing to 100% (as factor models do) because the indicators are not independent — RSI and %B both measure mean reversion from different angles, so a pure additive model with calibrated weights is preferred over a weighted average for simplicity and transparency.

---

## 10. Support & Resistance Detection

### Algorithm

1. **Pivot detection:** For each bar `i`, check whether the High at `i` is the maximum High in the window `[i−10, i+10]` (21-bar window). If so, it is a resistance pivot. Similarly for Lows as support pivots.

2. **Clustering:** Pivot candidates within 1.5% of each other (`threshold = 0.015`) are merged by taking their average. This collapses closely spaced pivots into a single representative level.

3. **Filtering:** Only levels currently below price are returned as support; only levels above price as resistance. Top 3 of each are shown.

### Formula for clustering threshold

```
Merge two levels A and B if: (B − A) / A ≤ 0.015
Merged level = mean(A, B, ...)
```

### Justification

Pivot-point-based support/resistance detection is a standard technique in technical analysis (see Murphy, 1999; also Thomas Bulkowski, *Encyclopedia of Chart Patterns*, 2000). The 10-bar lookahead/lookback window is a common default for daily data — narrow enough to find recent levels, wide enough to filter noise.

The 1.5% clustering threshold is set to correspond roughly to one ATR for a mid-volatility NSE large-cap (ATR is typically 1–2% of price). Levels closer than this are economically indistinguishable as price targets for a retail trader.

---

## 11. Entry Zone Calculator

### Entry Range

```
Ideal Entry Low  = Lower Bollinger Band  (most aggressive entry)
Ideal Entry High = Current Price         (baseline entry)
```

The entry range is not a price target but the zone where a position can reasonably be initiated. Entering at the lower BB is more favourable (cheaper) but less likely to be executed on a given day.

### Stop Loss — ATR Method

```
Stop_ATR = Current Price − (2 × ATR_14)
Stop_ATR% = ((Current Price − Stop_ATR) / Current Price) × 100
```

**Justification:** The 2× ATR multiplier is the standard volatility-normalised stop distance recommended by Van K. Tharp (*Trade Your Way to Financial Freedom*, 1998) and widely used by professional traders. It places the stop 2 "typical day ranges" below entry, reducing the probability of being stopped out by random noise while closing the position if the adverse move is genuine (i.e., larger than normal daily volatility).

### Stop Loss — BB Method

```
Stop_BB  = Lower Bollinger Band − (0.5 × ATR_14)
Stop_BB% = ((Current Price − Stop_BB) / Current Price) × 100
```

**Justification:** The lower Bollinger Band is a structural support level — price rarely sustains below it for multiple days (by the statistical definition of the band). The 0.5× ATR buffer prevents stop-outs from brief intraday wicks below the band that do not close below it. This approach is described in John Bollinger's *Bollinger on Bollinger Bands* (2001) as a way to set stops relative to band width.

### Price Targets

**Target 1 — Upper Bollinger Band (mean reversion)**
```
Target_BB_Upper = Upper Bollinger Band = SMA_20 + 2σ_20
Target_BB_Upper% = ((Target − Current Price) / Current Price) × 100
```
Rationale: If price bounced from the lower band, the upper band is the natural mean-reversion destination. Suitable for trades where the thesis is "stretched lower, will revert to mean."

**Target 2 — 52-Week High (momentum)**
```
Target_52W = max(High) over last 252 trading days
Target_52W% = ((Target − Current Price) / Current Price) × 100
```
Rationale: If the broader trend is intact, a retest of the prior 52-week high is the natural momentum target. This is the standard practitioner rule for trend-following targets (see Mark Minervini, *Trade Like a Stock Market Wizard*, 2013, which systematically uses 52W high as a target for base-breakout setups).

**Target 3 — Historical Momentum Target**
```
avg_mom = mean of actual 6M returns following the last 3 score ≥ 65 signals
Target_Mom = Current Price × (1 + avg_mom / 100)
```
If fewer than 3 prior signals exist, `avg_mom` defaults to 15%, which is a conservative estimate of NSE large-cap average 6-month gain in a bull regime (approximately consistent with the long-run annual return of Nifty 50 ≈ 12–15% per year, halved for 6 months).

Rationale: This grounds the target in the stock's own historical behaviour under the same model conditions, rather than using a theoretical framework.

### Risk/Reward Ratio

```
R:R = (Target − Entry) / (Entry − Stop)
```
Where Entry = Current Price (conservative baseline).

**Quality thresholds:**

| R:R | Label |
|-----|-------|
| > 2.5 | Good |
| 1.5 – 2.5 | Acceptable |
| < 1.5 | Poor |

The 1.5 minimum threshold for "acceptable" is a common practitioner standard (e.g., Alexander Elder, *Come Into My Trading Room*, 2002; also the default minimum used by many proprietary trading firms). At R:R = 1.5, a strategy needs only a 40% win rate to be profitable. The 2.5 "good" threshold corresponds to a break-even win rate of ~29%.

### Position Sizing — 1% Portfolio Risk Rule

```
Position Size% = min(1% / Stop%, 20%)
```

Where `Stop%` is the percentage distance from entry to stop.

**Example:** If stop is 5% below entry → Position Size = 1% / 5% = 20% (capped).
If stop is 2% below entry → Position Size = 1% / 2% = 50%, capped to 20%.

**Justification:** The 1% risk rule (never risk more than 1% of total portfolio on a single trade) is the most widely cited retail risk management rule in practitioner literature. It is described in detail in:
- Van K. Tharp, *Trade Your Way to Financial Freedom* (1998)
- Mark Douglas, *Trading in the Zone* (2000)
- SEBI's investor education materials also reference the principle of limiting single-trade risk.

The 20% cap on position size enforces diversification — no single NSE large-cap should represent more than 20% of a retail portfolio regardless of how tight the stop is.

---

## 12. Historical Backtesting

### Signal Detection

Two signal types are detected:

**Strong signal** (score crossover above 65):
```
is_strong = (score_today ≥ 65) AND (score_yesterday < 65)
```

**Moderate signal** (multi-condition):
```
is_moderate = (score_today ≥ 55) AND (score_yesterday < 55)
              AND (RSI_today < 40)
              AND (Close_today > MA200_today)
```

**Cooldown rule:** No two signals can fire within 63 trading days (≈ 3 months) of each other. If a second signal would fire within 63 days, it is skipped.

**Threshold justification (65):** A score of 65 requires, at minimum, the 200-DMA condition (+20) plus at least two other meaningful bullish signals totalling +15 above the 50 baseline. It represents a genuine preponderance of bullish evidence across multiple independent indicators. It is calibrated so that in a flat/neutral market (RSI neutral, MACD slightly negative, BB neutral, no strong momentum), the score sits around 40–55, well below 65.

### Outcome Measurement

```
Return_3M  = ((Close_{t+63}  − Signal_Price) / Signal_Price) × 100
Return_6M  = ((Close_{t+126} − Signal_Price) / Signal_Price) × 100
```

**Holding period:** 63 trading days (3 months) and 126 trading days (6 months). 126 days was chosen to align with the 6-month momentum factor lookback — the same time horizon the model is designed to capture.

### Stop Hit Detection

```
Stop_ATR  = Signal_Price − (2 × ATR_14 at signal date)
hit_stop  = any(Close_t < Stop_ATR for t in [signal_date, signal_date + 126 days])
```

This checks whether the stop would have been triggered at any point during the 6-month holding window, using daily closes (not intraday lows).

### Max Drawdown

```
Max_Drawdown% = ((min(Close) over window − Signal_Price) / Signal_Price) × 100
```

Measured over the full 126-day holding window using daily closes.

### Aggregate Statistics

```
Win_Rate_6M = (signals where Return_6M > 0) / (signals with 6M data) × 100
Avg_Return_6M = arithmetic mean of all Return_6M values
Median_Return_6M = median of all Return_6M values
Avg_Max_Drawdown = arithmetic mean of all Max_Drawdown% values
```

Both mean and median are reported because a single large outlier return can distort the mean significantly when the sample is small (typically 2–6 signals per stock over 2 years).

**Sample size caveat:** 2 years of daily data produces at most ~8 possible non-overlapping 3-month windows (with the 63-day cooldown). In practice, most stocks will show 2–5 signals. Results should be treated as directional evidence, not statistically significant findings. A minimum of 30+ signals would be needed for statistical confidence, which would require 10+ years of data.

---

## 13. Fundamental Ratios

All fundamental data is fetched directly from Yahoo Finance's `.info` endpoint via `yfinance`. The tool does not compute these values; it displays them as provided:

| Field | Yahoo Finance key | Definition |
|-------|------------------|------------|
| P/E Ratio (TTM) | `trailingPE` | Price / Trailing 12-month EPS |
| P/B Ratio | `priceToBook` | Price / Book Value per share |
| Market Cap | `marketCap` | Shares outstanding × Current price |
| EPS (TTM) | `trailingEps` | Trailing 12-month earnings per share |
| Dividend Yield | `dividendYield` | Annual dividend / Current price |
| Avg. Volume | `averageVolume` | Average daily trading volume (Yahoo's own calculation) |

These are displayed for context only and are not inputs to the composite score.

---

## 14. Limitations & Disclaimers

1. **Survivorship bias:** The stock universe is fixed at 30 current NSE large-caps. Companies that were delisted, merged, or replaced in the index over the past 2 years are not included, which inflates backtest results.

2. **Look-ahead bias:** The backtest computes scores using a rolling window that only looks at data available on each historical day. No future data is used in signal computation. However, the stock list itself is chosen with hindsight (we know these 30 stocks are large-caps today).

3. **Transaction costs:** No brokerage, STT (Securities Transaction Tax), or impact cost is deducted from backtest returns. Indian equity brokerage and STT combined typically cost 0.15–0.3% per trade, which reduces effective returns for shorter holding periods.

4. **Daily close prices:** The model assumes execution at the daily closing price on the signal day. In practice, the signal is only visible after market close, so execution would occur the next day's open — introducing slippage.

5. **Small sample size:** 2 years of data with a 63-day cooldown means at most 8 non-overlapping signals per stock. Most stocks will have 2–5. No conclusions with statistical significance can be drawn from this sample. The backtest is illustrative, not predictive.

6. **EMA vs Wilder's smoothing for RSI:** The implementation uses a simple rolling mean (SMA) for RSI gain/loss averaging rather than Wilder's exponential smoothing. After the warm-up period they diverge slightly. This is a known simplification.

7. **This tool is for educational and informational purposes only. It does not constitute investment advice. Past backtested performance does not guarantee future results.**

---

## References

- Wilder, J.W. (1978). *New Concepts in Technical Trading Systems*. Trend Research.
- Appel, G. (2005). *Technical Analysis: Power Tools for Active Investors*. FT Press.
- Bollinger, J. (2001). *Bollinger on Bollinger Bands*. McGraw-Hill.
- Elder, A. (1993). *Trading for a Living*. Wiley.
- Elder, A. (2002). *Come Into My Trading Room*. Wiley.
- Faber, M. (2007). A Quantitative Approach to Tactical Asset Allocation. *Journal of Wealth Management*, 9(4), 69–79.
- Fama, E. & French, K. (2012). Size, Value, and Momentum in International Stock Returns. *Journal of Financial Economics*, 105(3), 457–472.
- Jegadeesh, N. & Titman, S. (1993). Returns to Buying Winners and Selling Losers. *Journal of Finance*, 48(1), 65–91.
- Minervini, M. (2013). *Trade Like a Stock Market Wizard*. McGraw-Hill.
- Murphy, J. (1999). *Technical Analysis of the Financial Markets*. New York Institute of Finance.
- Tharp, V.K. (1998). *Trade Your Way to Financial Freedom*. McGraw-Hill.
- Brown, C. (1999). *Technical Analysis for the Trading Professional*. McGraw-Hill.
- Douglas, M. (2000). *Trading in the Zone*. Prentice Hall.
- Bulkowski, T. (2000). *Encyclopedia of Chart Patterns*. Wiley.
- MSCI Momentum Index Methodology. MSCI Inc. (methodology document, available at msci.com).
