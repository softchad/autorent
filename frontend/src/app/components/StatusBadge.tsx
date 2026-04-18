type Props = { status: string };

const statusMap: Record<string, { bg: string; dot: string; text: string }> = {
  patvirtinta: { bg: "bg-emerald-900/40 border-emerald-700/40",  dot: "bg-emerald-400", text: "text-emerald-300" },
  užbaigta:    { bg: "bg-slate-700/40 border-slate-600/40",      dot: "bg-slate-400",   text: "text-slate-300" },
  užbaigtas:   { bg: "bg-slate-700/40 border-slate-600/40",      dot: "bg-slate-400",   text: "text-slate-300" },
  apmokėta:    { bg: "bg-emerald-900/40 border-emerald-700/40",  dot: "bg-emerald-400", text: "text-emerald-300" },
  aktyvi:      { bg: "bg-blue-900/40 border-blue-700/40",        dot: "bg-blue-400",    text: "text-blue-300" },
  vykdoma:     { bg: "bg-blue-900/40 border-blue-700/40",        dot: "bg-blue-400",    text: "text-blue-300" },
  vykdomas:    { bg: "bg-blue-900/40 border-blue-700/40",        dot: "bg-blue-400",    text: "text-blue-300" },
  laukia:      { bg: "bg-amber-900/40 border-amber-700/40",      dot: "bg-amber-400",   text: "text-amber-300" },
  laukiama:    { bg: "bg-amber-900/40 border-amber-700/40",      dot: "bg-amber-400",   text: "text-amber-300" },
  atšaukta:    { bg: "bg-rose-900/40 border-rose-700/40",        dot: "bg-rose-400",    text: "text-rose-300" },
  atšauktas:   { bg: "bg-rose-900/40 border-rose-700/40",        dot: "bg-rose-400",    text: "text-rose-300" },
  vėluojanti:  { bg: "bg-rose-900/40 border-rose-700/40",        dot: "bg-rose-400",    text: "text-rose-300" },
  išrašyta:    { bg: "bg-[#0F597B]/20 border-[#0F597B]/30",      dot: "bg-[#4BAFD4]",   text: "text-[#4BAFD4]" },
  laisvas:     { bg: "bg-emerald-900/40 border-emerald-700/40",  dot: "bg-emerald-400", text: "text-emerald-300" },
  isnuomotas:  { bg: "bg-blue-900/40 border-blue-700/40",        dot: "bg-blue-400",    text: "text-blue-300" },
  servise:     { bg: "bg-amber-900/40 border-amber-700/40",      dot: "bg-amber-400",   text: "text-amber-300" },
  remonte:     { bg: "bg-rose-900/40 border-rose-700/40",        dot: "bg-rose-400",    text: "text-rose-300" },
};

export default function StatusBadge({ status }: Props) {
  const s = statusMap[status] ?? { bg: "bg-slate-700/40 border-slate-600/40", dot: "bg-slate-400", text: "text-slate-300" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
