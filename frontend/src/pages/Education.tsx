export const Education = () => {
  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Education</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm">
        Learn how each indicator and feature in this tool works and why it matters for 6-month investment timing.
      </p>

      {/* RSI */}
      <Section title="RSI — Relative Strength Index">
        <p>
          RSI is a momentum oscillator ranging from 0–100 that measures the speed and magnitude of recent price changes. It compares average gains to average losses over a 14-day window. Below 30 means the stock has fallen sharply relative to its own history (oversold). Above 70 means it has risen sharply (overbought). These extremes statistically precede reversals.
        </p>
        <p>
          For 6-month holds, entering when RSI is below 40 gives the stock room to run upward without already being "heated up". RSI above 70 at entry creates catch-a-falling-knife risk if the trend turns.
        </p>
      </Section>

      {/* MACD */}
      <Section title="MACD — Moving Average Convergence Divergence">
        <p>
          MACD is computed as the 12-day exponential moving average (EMA) minus the 26-day EMA. A 9-day EMA of MACD is the signal line. The histogram is MACD minus signal. When the histogram is positive, short-term momentum is above long-term momentum — bullish. When negative, momentum is fading or flipping bearish.
        </p>
        <p>
          A crossover from negative to positive (MACD crossing above signal line) is one of the most widely watched trend-continuation signals. For 6-month entries, a positive and rising histogram confirms the uptrend is intact.
        </p>
      </Section>

      {/* Bollinger Bands */}
      <Section title="Bollinger Bands">
        <p>
          Bollinger Bands place an upper and lower band at 2 standard deviations above and below a 20-day simple moving average. Since ~95% of price action falls within 2 standard deviations of the mean, touches of the outer bands are statistically unusual and often precede mean reversion.
        </p>
        <p>
          The %B indicator measures where price sits within the band (0 = lower band, 1 = upper band). Values below 0.1 suggest the stock is near the lower band — historically a strong entry zone for mean-reversion plays.
        </p>
      </Section>

      {/* 200-DMA */}
      <Section title="200-Day Moving Average — Market Regime">
        <p>
          The 200-day MA is the gold standard for classifying long-term trend. Price above the 200-DMA means you're in a bull regime; below means bear regime. Professional fund managers routinely screen for price above the 200-DMA as a prerequisite before buying, because stocks below it are disproportionately likely to be in structural downtrends.
        </p>
      </Section>

      {/* ATR */}
      <Section title="ATR — Average True Range">
        <p>
          ATR measures average daily price range (including gaps) over 14 days. It reflects how much the stock moves on a typical day. A high ATR means volatile daily swings; low ATR means calm consolidation. ATR does not indicate direction — only magnitude of moves.
        </p>
        <p>
          For position sizing and stop placement, ATR is the most practical tool: a 2× ATR stop means your stop is two "typical days" below your entry, giving the trade room to breathe without being stopped out by noise.
        </p>
      </Section>

      {/* 6-Month Momentum */}
      <Section title="6-Month Momentum">
        <p>
          Momentum is the percentage price change over 126 trading days (approximately 6 months). Academic research consistently shows that stocks with positive 3–12 month momentum continue outperforming in the near term (momentum factor). Stocks up 15%+ in 6 months are in confirmed uptrends; stocks down significantly are in downtrends.
        </p>
      </Section>

      {/* Entry Zone */}
      <Section title="How the Entry Zone is Calculated">
        <h4 className="font-semibold mb-2">Entry Range</h4>
        <p>
          The entry range spans from the lower Bollinger Band to the current price. The lower band is the most aggressive (oversold) entry — statistically rare and often followed by a bounce. Current price is the upper bound: you should not pay more than the current market price as the model basis.
        </p>

        <h4 className="font-semibold mt-4 mb-2">Stop Loss Methods</h4>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>ATR-based stop:</strong> Entry price minus 2× ATR(14). This is the most common volatility-aware stop. It adjusts to how much the stock actually moves day-to-day — higher-volatility stocks get a wider stop automatically. Suits traders who want a data-driven, self-calibrating stop that ignores arbitrary fixed percentages.
          </li>
          <li>
            <strong>BB-based stop:</strong> Lower Bollinger Band minus 0.5× ATR (a buffer below the band). The lower band itself acts as a statistical support floor — if price closes convincingly below it, the setup has failed. The 0.5× ATR buffer prevents stop-outs from brief band wicks. Suits mean-reversion traders who use the band structure as their risk framework.
          </li>
        </ul>

        <h4 className="font-semibold mt-4 mb-2">Price Target Methods</h4>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Upper Bollinger Band:</strong> The 20-day mean + 2 standard deviations. Price tends to oscillate between the bands; from near the lower band, the upper band is the natural mean-reversion target. Best for <em>mean reversion plays</em> — shorter holding periods where the setup is purely statistical and you're not betting on a sustained trend.
          </li>
          <li>
            <strong>52-Week High:</strong> The highest price over the past year. If the trend is intact, a retest of the 52W high is the standard momentum target. Best for <em>momentum plays</em> — you believe the stock is resuming an uptrend and can reclaim previous highs.
          </li>
          <li>
            <strong>Momentum target:</strong> Entry price multiplied by (1 + average 6-month return of the last 3 historical signals / 100). If no prior signals exist, 15% is assumed (a conservative estimate of average NSE large-cap 6-month gain in a bull regime). Best for <em>trend continuation plays</em> where you expect history to roughly repeat.
          </li>
        </ul>

        <h4 className="font-semibold mt-4 mb-2">1% Portfolio Risk Rule & Position Sizing</h4>
        <p>
          The 1% risk rule means you never risk more than 1% of your total portfolio on a single trade. If your stop is 5% below entry, you should only allocate 20% of your portfolio (1% / 5% = 20%). If your stop is 2% below entry, you could allocate up to 50%, but this is capped at 20% to enforce diversification. This rule keeps any single loss manageable regardless of how many trades you hold simultaneously.
        </p>
      </Section>

      {/* Backtest */}
      <Section title="How the Backtest Works">
        <p>
          The backtest recomputes the composite score for every trading day in the 2-year dataset by rolling all indicators forward day by day. A <strong>signal</strong> fires when the composite score crosses above 65 (strong) or when it crosses 55 while RSI is below 40 and price is above the 200-DMA (moderate). These thresholds represent conditions that historically precede above-average forward returns in the score model.
        </p>
        <p>
          The threshold of 65 was chosen because the scoring model is designed so that 50 is "neutral" (balanced bull/bear signals). A score of 65 represents a preponderance of bullish evidence across RSI, MACD, Bollinger Bands, momentum, and trend — roughly equivalent to two indicators confirming a buy above baseline.
        </p>
        <p>
          A <strong>cooldown of 63 trading days</strong> (3 months) prevents the model from firing repeatedly during the same trend move, which would overcount wins from a single entry opportunity.
        </p>
        <p>
          <strong>Win rate</strong> tells you how often the signal was profitable at 6 months. But win rate alone is misleading — a model that is right 60% of the time but loses more when wrong than it gains when right is still unprofitable. The <strong>average return</strong> and <strong>median return</strong> capture the magnitude of outcomes. The <strong>average max drawdown</strong> shows how much pain you typically endure during the holding period — a measure of the emotional and capital cost of staying in the trade.
        </p>
        <p>
          <strong>Caution:</strong> 2 years of daily data typically produces only 2–6 signals per stock, depending on how volatile the market was. With so few samples, a single outlier (good or bad) can dramatically shift the win rate and average return. Treat backtest results as directional evidence, not statistical proof.
        </p>
      </Section>

      {/* Composite Score */}
      <Section title="The Composite Score">
        <p>
          The composite score aggregates all indicators into a single 0–100 number. It starts at 50 (neutral) and adds or subtracts points based on RSI, MACD histogram, Bollinger %B, 6-month momentum, 200-DMA regime, and volume ratio. Each indicator contributes independently, so the score reflects the overall weight of evidence across timeframes and methods.
        </p>
        <p>
          Verdicts: 75+ = Strong Buy, 60–74 = Moderate Buy, 40–59 = Neutral, 25–39 = Caution, below 25 = Avoid.
        </p>
      </Section>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">{title}</h2>
      <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}
