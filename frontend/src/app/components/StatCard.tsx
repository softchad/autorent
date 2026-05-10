import { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  color?: string;
  icon?: ReactNode;
};

export default function StatCard({
  title,
  value,
  color = "bg-gray-100",
  icon,
}: StatCardProps) {
  return (
    <div
      className={`${color} p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-[#F7F7F7] ">{title}</h2>
        {icon && <div className="text-xl text-[#F7F7F7] ">{icon}</div>}
      </div>
      <p className="text-3xl font-bold text-[#F7F7F7] ">{value}</p>
    </div>
  );
}
