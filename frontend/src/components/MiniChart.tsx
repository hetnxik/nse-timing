import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MiniChartProps {
  data: Array<{
    date: string;
    close: number;
  }>;
}

export const MiniChart: React.FC<MiniChartProps> = ({ data }) => {
  return (
    <div className="w-full h-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="close"
            stroke="#2563eb"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
