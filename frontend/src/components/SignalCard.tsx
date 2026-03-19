import { getSignalBgColor, getSignalDotColor } from "../explanations";

interface Signal {
  type: "bullish" | "bearish" | "neutral";
  title: string;
  description: string;
}

interface SignalCardProps {
  signal: Signal;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  const bgColor = getSignalBgColor(signal.type);
  const dotColor = getSignalDotColor(signal.type);

  return (
    <div className={`signal-card ${bgColor}`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${dotColor}`} />
      <div>
        <div className="font-semibold text-sm">{signal.title}</div>
        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          {signal.description}
        </div>
      </div>
    </div>
  );
};
