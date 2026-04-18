import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type ChartData = {
  name: string;
  value: number;
}[];

type PieChartBoxProps = {
  title: string;
  data: ChartData;
  height?: number;
  colors?: string[];
  radius?: number;
};

export default function PieChartBox({
  title,
  data,
  height = 200,
  colors = ["#0F597B", "#4089AE", "#8BA5B2", "#BFDBFE"],
  radius = 70,
}: PieChartBoxProps) {
  return (
    <div className="bg-[#0E1525] p-6 rounded shadow text-[#F7F7F7] ">
      <h2 className="text-sm font-semibold text-[#F7F7F7]  mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            dataKey="value"
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={radius}
            label
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            wrapperStyle={{ backgroundColor: "#1E2B45", color: "white" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
