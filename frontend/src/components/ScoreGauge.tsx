import { getVerdictColor } from "../explanations";

interface ScoreGaugeProps {
  score: number;
  verdict: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, verdict }) => {
  const radius = 60;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getVerdictColor(verdict);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={160} height={100} viewBox="0 0 160 100">
        {/* Background arc */}
        <path
          d={`M 20 80 A 60 60 0 0 1 140 80`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d={`M 20 80 A 60 60 0 0 1 140 80`}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        {/* Score text */}
        <text
          x="80"
          y="65"
          textAnchor="middle"
          className="font-mono text-2xl font-bold"
          fill="currentColor"
        >
          {score.toFixed(0)}
        </text>
      </svg>

      <div className="text-center">
        <div className="text-lg font-semibold" style={{ color }}>
          {verdict}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Entry Score (0–100)
        </div>
      </div>
    </div>
  );
};
