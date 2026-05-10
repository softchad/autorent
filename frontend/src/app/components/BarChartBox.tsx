import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartData = {
  name: string;
  value: number;
}[];

type BarChartBoxProps = {
  title: string;
  data: ChartData;
  height?: number;
  barColor?: string;
};

export default function BarChartBox({
  title,
  data,
  height = 200,
  barColor = "#1E2B45",
}: BarChartBoxProps) {
  return (
    <div className="bg-[#0E1525] p-6 rounded shadow text-[#F7F7F7] ">
      <h2 className="text-sm font-semibold text-[#F7F7F7]  mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
          <XAxis dataKey="name" stroke="#E2E8F0" />
          <YAxis allowDecimals={false} stroke="#E2E8F0" />
          <Tooltip />
          <Bar dataKey="value" fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
