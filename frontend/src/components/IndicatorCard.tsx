import { getIndicatorExplanation } from "../explanations";

interface IndicatorCardProps {
  name: string;
  value: string | number;
  interpretation: string;
  indicator: string;
  meta?: Record<string, number | string>;
}

export const IndicatorCard: React.FC<IndicatorCardProps> = ({
  name,
  value,
  interpretation,
  indicator,
  meta,
}) => {
  const explanation = getIndicatorExplanation(indicator, value, meta);

  const getColor = (interpretation: string) => {
    if (
      interpretation.includes("Bull") ||
      interpretation.includes("Oversold") ||
      interpretation.includes("bullish") ||
      interpretation.includes("Strong") ||
      interpretation.includes("Bullish") ||
      interpretation.includes("Supportive")
    ) {
      return "text-green-600 dark:text-green-400";
    }
    if (
      interpretation.includes("Bear") ||
      interpretation.includes("Overbought") ||
      interpretation.includes("bearish") ||
      interpretation.includes("Weak") ||
      interpretation.includes("Bearish") ||
      interpretation.includes("Downtrend")
    ) {
      return "text-red-600 dark:text-red-400";
    }
    return "text-amber-600 dark:text-amber-400";
  };

  return (
    <div className="stat-card">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        {name}
      </div>
      <div className={`indicator-value ${getColor(interpretation)}`}>
        {typeof value === "number" ? value.toFixed(2) : value}
      </div>
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 mb-3">
        {interpretation}
      </div>
      <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        {explanation}
      </div>
    </div>
  );
};
