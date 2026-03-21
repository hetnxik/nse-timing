// RSI Explanations
export const getRSIExplanation = (rsi: number): { label: string; text: string } => {
  if (rsi < 30) {
    return {
      label: "Oversold",
      text: `RSI is at ${rsi.toFixed(1)}, which is in oversold territory (below 30). This means the stock has fallen faster than its historical average, and a bounce is statistically more likely. For a 6-month hold, entering when RSI is oversold historically improves your entry price.`,
    };
  } else if (rsi > 70) {
    return {
      label: "Overbought",
      text: `RSI is at ${rsi.toFixed(1)}, which is in overbought territory (above 70). The stock has risen faster than average, creating pullback risk. Most 6-month strategies wait for RSI to fall below 60 before entering, to avoid catching a falling knife.`,
    };
  } else if (rsi >= 30 && rsi <= 45) {
    return {
      label: "Supportive",
      text: `RSI is at ${rsi.toFixed(1)}, in the bullish zone (30–45). The stock shows strength without excess, meaning upside momentum can still run. This is an ideal entry zone for a 6-month hold.`,
    };
  } else if (rsi >= 60 && rsi <= 70) {
    return {
      label: "Weakening",
      text: `RSI is at ${rsi.toFixed(1)}, approaching overbought (above 60). Upside momentum is slowing, but not yet dangerous. Consider waiting for pullbacks if entering now, as mean reversion is building.`,
    };
  } else {
    return {
      label: "Neutral",
      text: `RSI is at ${rsi.toFixed(1)}, in neutral territory. Neither oversold nor overbought—the stock's recent moves are average. Continue assessing other indicators.`,
    };
  }
};

// 200-DMA Explanations
export const getMA200Explanation = (price: number, ma200: number, pctAbove: number, bullRegime: boolean): { label: string; text: string } => {
  if (bullRegime) {
    return {
      label: "Bull Regime",
      text: `Price at ₹${price.toFixed(2)} is ${pctAbove.toFixed(1)}% above its 200-day moving average (₹${ma200.toFixed(2)}), confirming a long-term uptrend. Most 6-month momentum strategies require this condition before entering—it filters out value traps stuck in structural downtrends.`,
    };
  } else {
    return {
      label: "Bear Regime",
      text: `Price at ₹${price.toFixed(2)} is ${Math.abs(pctAbove).toFixed(1)}% below its 200-day moving average (₹${ma200.toFixed(2)}), signaling a downtrend. Entering against the 200-DMA is high-risk for 6-month holds; wait for the price to recross above it first.`,
    };
  }
};

// Bollinger Bands Explanations
export const getBBExplanation = (pctB: number, price: number, _upper: number, mid: number, _lower: number): { label: string; text: string } => {
  if (pctB < 0.1) {
    const upside = ((mid - price) / price) * 100;
    return {
      label: "Near Lower Band",
      text: `Price is near the lower Bollinger Band (%B = ${pctB.toFixed(2)}). Bollinger Bands are set at 2 standard deviations from the 20-day average, so touching the lower band is statistically rare and often precedes a bounce back toward the middle band (₹${mid.toFixed(2)}), which would represent a ~${upside.toFixed(1)}% gain from here.`,
    };
  } else if (pctB > 0.9) {
    const downside = ((price - mid) / price) * 100;
    return {
      label: "Near Upper Band",
      text: `Price is near the upper Bollinger Band (%B = ${pctB.toFixed(2)}), far above the 20-day average. This extreme is typically followed by mean reversion toward the midline (₹${mid.toFixed(2)}), which would represent a ~${downside.toFixed(1)}% pullback. Caution for new entries.`,
    };
  } else if (pctB < 0.3) {
    return {
      label: "Lower Zone",
      text: `Price is in the lower half of the Bollinger Bands (%B = ${pctB.toFixed(2)}), below the 20-day average. This is a supportive zone for entries, as upside room to the upper band is plentiful.`,
    };
  } else if (pctB > 0.7) {
    return {
      label: "Upper Zone",
      text: `Price is in the upper half of the Bollinger Bands (%B = ${pctB.toFixed(2)}), above the 20-day average. The stock is running hot; pullbacks often occur in this zone.`,
    };
  } else {
    return {
      label: "Middle Zone",
      text: `Price is in the middle of the Bollinger Bands (%B = ${pctB.toFixed(2)}). This is neutral territory with balanced upside and downside risk.`,
    };
  }
};

// MACD Explanations
export const getMACDExplanation = (histogram: number, _macdLine: number, _signal: number): { label: string; text: string } => {
  if (histogram > 0) {
    return {
      label: "Bullish Divergence",
      text: `MACD histogram is positive (${histogram.toFixed(2)}), meaning the fast moving average (12-day) is above the slow one (26-day). This confirms momentum favors bulls and suggests uptrend persistence. A positive and rising histogram is most bullish for 6-month holds.`,
    };
  } else {
    return {
      label: "Bearish Divergence",
      text: `MACD histogram is negative (${histogram.toFixed(2)}), meaning the fast moving average has fallen below the slow one. This signals momentum is fading or shifting bearish. Watch for a crossover back above the signal line to confirm a reversal.`,
    };
  }
};

// 6-Month Momentum Explanations
export const getMomentumExplanation = (momentum: number): { label: string; text: string } => {
  if (momentum > 15) {
    return {
      label: "Strong Uptrend",
      text: `The stock is up ${momentum.toFixed(1)}% over 6 months, well above the 15% threshold for strong momentum. This confirms a durable uptrend and suggests the trend can persist for another 6-month hold.`,
    };
  } else if (momentum > 5) {
    return {
      label: "Positive Momentum",
      text: `The stock is up ${momentum.toFixed(1)}% over 6 months, above the 5% threshold. Moderate uptrend support; the trend is established but not as strong as >15%.`,
    };
  } else if (momentum < -15) {
    return {
      label: "Strong Downtrend",
      text: `The stock is down ${Math.abs(momentum).toFixed(1)}% over 6 months, a significant loss. This warns of severe downside risk for new entries. Wait for trend reversal before considering a 6-month position.`,
    };
  } else if (momentum < -5) {
    return {
      label: "Negative Momentum",
      text: `The stock is down ${Math.abs(momentum).toFixed(1)}% over 6 months. Downside headwinds are present; entries are riskier and should be reserved for stocks showing other bullish signals.`,
    };
  } else {
    return {
      label: "Neutral Trend",
      text: `The stock is roughly flat (${momentum.toFixed(1)}%) over 6 months. No clear momentum direction; other indicators matter more for entry timing.`,
    };
  }
};

// ATR Explanations
export const getATRExplanation = (atr: number, atrPct: number): string => {
  return `ATR is ₹${atr.toFixed(2)} (${atrPct.toFixed(1)}% of price). This is the average daily range over 14 days. High ATR means the stock swings wildly (risky for tight stops), while low ATR means tighter consolidation. For 6-month holds, knowing ATR helps size position risk—you can tolerate larger swings when holding long.`;
};

// Volume Ratio Explanations
export const getVolumeExplanation = (ratio: number, volume: number): string => {
  if (ratio > 1.5) {
    return `Volume today is ${ratio.toFixed(1)}x the 20-day average (${(volume / 1e6).toFixed(1)}M shares). High volume confirms conviction behind price moves, reducing risk of false breakouts.`;
  } else {
    return `Volume today is ${ratio.toFixed(1)}x the 20-day average. Moderate volume; moves are less confirmed but still actionable if other indicators align.`;
  }
};

// Score Gauge Labels
export const getVerdictColor = (verdict: string): string => {
  switch (verdict) {
    case "Strong Buy":
      return "#1a7a4a";
    case "Moderate Buy":
      return "#2d9e68";
    case "Neutral":
      return "#b07a20";
    case "Caution":
      return "#c05a30";
    case "Avoid":
      return "#9b2020";
    default:
      return "#666666";
  }
};

// Signal interpretation
export const getSignalBgColor = (type: string): string => {
  if (type === "bullish") return "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700";
  if (type === "bearish") return "bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700";
  return "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700";
};

export const getSignalDotColor = (type: string): string => {
  if (type === "bullish") return "bg-green-500";
  if (type === "bearish") return "bg-red-500";
  return "bg-gray-500";
};

// Chart explanations
export const priceChartExplanation = `This chart shows the stock price over the past 6 months (green line) alongside the 200-day moving average (orange line). When price is above the MA, you're in an uptrend (bullish for entries). When below, downtrend dominates (caution zone). Crossovers are key decision points.`;

export const rsiChartExplanation = `RSI measures momentum from 0–100. Below 30 = oversold (bounce likely). Above 70 = overbought (pullback likely). 30–70 = normal trading. For 6-month holds, RSI below 40 at entry is ideal—gives room to run without the stock already overheated.`;

export const macdChartExplanation = `MACD (blue) crossing above the signal line (red) is a bullish crossover; below is bearish. The histogram (gray bars) visualizes the divergence—positive = bullish momentum, negative = bearish. Widening histogram = momentum building; narrowing = fading.`;

export const bbChartExplanation = `Bollinger Bands show the price range (upper/lower gray bands) and 20-day average (middle line). Price bounces between bands; extremes (near upper/lower) often reverse. When price holds above the middle band, the trend is up. Wide bands = volatility; narrow = consolidation.`;

// Score history chart explanation
export const scoreHistoryChartExplanation = `The purple area shows how the composite statistical score has evolved over 2 years. Periods where the score rose above 65 (green dashed line) represent historically attractive entry windows — compare these to the price line to see how much upside followed.`;

// Entry zone interpretation template
export const getEntryZoneExplanation = (
  stopBasis: "atr" | "bb",
  stop: number,
  stopPct: number,
  _targetBasis: "bb_upper" | "52w_high" | "momentum",
  target: number,
  targetLabel: string,
  rr: number,
  posPct: number
): string => {
  const stopLabel = stopBasis === "atr" ? "ATR-based stop" : "BB-based stop";
  return `Based on the ${stopLabel} at ₹${stop.toFixed(2)} (${stopPct.toFixed(1)}% below entry) and the ${targetLabel} target at ₹${target.toFixed(2)}, this setup offers a ${rr.toFixed(2)}:1 risk/reward ratio. At 1% portfolio risk, you should size this position at ${posPct.toFixed(1)}% of your portfolio.`;
};

// Backtest interpretation template
export const getBacktestExplanation = (
  symbol: string,
  n: number,
  completed: number,
  winRate: number | null,
  avgReturn: number | null,
  avgDd: number | null
): string => {
  const wr = winRate !== null ? `${winRate.toFixed(1)}%` : "N/A";
  const ar = avgReturn !== null ? `${avgReturn.toFixed(1)}%` : "N/A";
  const dd = avgDd !== null ? `${Math.abs(avgDd).toFixed(1)}%` : "N/A";
  return `Over the past 2 years, this score model generated ${n} signal${n !== 1 ? "s" : ""} on ${symbol}. Of the ${completed} with a full 6-month outcome, ${wr} were profitable with an average return of ${ar}. The average drawdown during the holding period was ${dd}, which gives you a sense of the patience required.`;
};

// Indicator card templates
export const getIndicatorExplanation = (
  indicator: string,
  value: number | string,
  meta?: Record<string, number | string>
): string => {
  switch (indicator) {
    case "rsi":
      const rsiVal = value as number;
      if (rsiVal < 30) {
        return `RSI measures momentum and mean reversion. At ${rsiVal.toFixed(1)}, the stock is oversold—it has fallen faster than average. Statistically, oversold stocks bounce. For 6-month holds, this is a favorable entry signal because it offers downside protection.`;
      } else if (rsiVal > 70) {
        return `RSI at ${rsiVal.toFixed(1)} is overbought, meaning the stock has run up very fast. While momentum can persist, mean reversion risk is high. Most 6-month strategies avoid entering overbought; wait for an RSI pullback below 60.`;
      } else {
        return `RSI at ${rsiVal.toFixed(1)} is in neutral territory. The stock's recent gains/losses are balanced. Not an extreme signal either way; use other indicators to decide.`;
      }

    case "macd":
      const macdHist = meta?.histogram as number;
      if (macdHist > 0) {
        return `MACD measures momentum using moving average convergence. Positive histogram (${macdHist.toFixed(2)}) means the fast MA (12-day) is above the slow one (26-day), confirming uptrend persistence. Ideal signal for 6-month entries—momentum is on your side.`;
      } else {
        return `MACD histogram is negative (${macdHist.toFixed(2)}), signaling momentum fading or reversing. Bearish for new entries. Wait for histogram to turn positive (signal line crossover) before entering.`;
      }

    case "bollinger_bands":
      const pctB = meta?.pct_b as number;
      const mid = meta?.mid as number;
      if (pctB < 0.2) {
        return `Bollinger Bands measure volatility and price extremes. %B at ${pctB.toFixed(2)} means price is near the lower band—statistically rare and often bounces. The midline (₹${mid?.toFixed(2)}) is the reversion target, offering upside.`;
      } else if (pctB > 0.8) {
        return `%B at ${pctB.toFixed(2)} places price near the upper band—an extreme that often rolls over. Pullback risk is high. Hold off or wait for pullbacks before new entries.`;
      } else {
        return `%B at ${pctB.toFixed(2)} is neutral within the bands. Price has room to move either direction without hitting extremes.`;
      }

    case "ma200":
      const bullRegime = Boolean(meta?.bull_regime);
      const pctAbove = meta?.pct_above as number;
      if (bullRegime) {
        return `The 200-day moving average (MA200) is the gold standard for long-term trend. You are ${pctAbove.toFixed(1)}% above it, confirming uptrend. Most professional 6-month strategies require price above MA200 as a gate—it filters out traps in falling stocks.`;
      } else {
        return `Price is ${Math.abs(pctAbove).toFixed(1)}% below MA200, indicating downtrend. Entering below MA200 is high-risk for 6-month holds. Wait for price to recross above MA200 first to confirm trend reversal.`;
      }

    case "atr":
      const atrVal = value as number;
      const atrPctVal = meta?.pct as number;
      return `ATR (Average True Range) measures daily volatility. At ₹${atrVal.toFixed(2)} (${atrPctVal.toFixed(1)}% of price), this is the typical daily move. For 6-month holds, ATR helps you understand position sizing—higher ATR means wider swings, so tighter risk management is key.`;

    case "volume_ratio":
      const volRatio = value as number;
      if (volRatio > 1.5) {
        return `Volume ratio of ${volRatio.toFixed(1)}x means today's volume is 50% above the 20-day average. High volume confirms conviction—price moves are less likely to be noise. Bullish entries backed by high volume have higher success rates.`;
      } else {
        return `Volume ratio of ${volRatio.toFixed(1)}x is moderate. Moves have less conviction but are still actionable if RSI and trend align.`;
      }

    case "momentum_6m":
      const mom = value as number;
      if (mom > 15) {
        return `6-month momentum at ${mom.toFixed(1)}% confirms a strong uptrend. The stock has compounded gains, attracting institutional buyers. For 6-month entries, this suggests the momentum can persist—you're riding an established wave.`;
      } else if (mom > 5) {
        return `Moderate 6-month gains (${mom.toFixed(1)}%) show the uptrend exists but isn't runaway. There's room for further upside without the stock being overextended.`;
      } else {
        return `Weak 6-month performance (${mom.toFixed(1)}%) suggests headwinds or consolidation. Be selective with entries; prioritize stocks with stronger setup signals.`;
      }

    default:
      return "Technical indicator measuring stock behavior.";
  }
};
