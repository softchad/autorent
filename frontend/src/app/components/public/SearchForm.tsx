"use client";

import { FiSearch } from "react-icons/fi";
import DatePicker from "./DatePicker";
import LocationSearch from "./LocationSearch";

export type SearchValue = {
  location: string;
  dateFrom: string;
  dateTo: string;
};

type SearchFormProps = {
  value: SearchValue;
  onChange: (value: SearchValue) => void;
  onSubmit: () => void;
  variant?: "hero" | "compact";
};

export default function SearchForm({
  value,
  onChange,
  onSubmit,
  variant = "hero",
}: SearchFormProps) {
  const set = (patch: Partial<SearchValue>) => onChange({ ...value, ...patch });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  if (variant === "compact") {
    return (
      <form
        onSubmit={handleSubmit}
        className="hidden lg:flex items-center gap-4 bg-[#1A2238] border border-[#1C2B3A] rounded-full pl-6 pr-2 py-2.5 shadow-lg"
      >
        <LocationSearch value={value.location} onChange={(v) => set({ location: v })} placeholder="Vieta" compact />
        <div className="h-6 w-px bg-[#1C2B3A] shrink-0" />
        <DatePicker label="Nuo" value={value.dateFrom} onChange={(v) => set({ dateFrom: v })} compact />
        <div className="h-6 w-px bg-[#1C2B3A] shrink-0" />
        <DatePicker
          label="Iki"
          value={value.dateTo}
          onChange={(v) => set({ dateTo: v })}
          minDate={value.dateFrom}
          compact
        />
        <button
          type="submit"
          aria-label="Ieškoti"
          className="shrink-0 bg-[#FF7A1A] hover:bg-[#FF8C3D] text-[#0E0B1F] p-3 rounded-full transition"
        >
          <FiSearch className="text-base" />
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="group mt-10 mx-auto max-w-5xl rounded-[32px] border-2 border-[#0F597B]/50 bg-[#0E1525]/95 backdrop-blur p-4 shadow-[0_0_0_1px_rgba(15,89,123,0.2),0_40px_100px_-20px_rgba(0,0,0,0.75)] sm:p-6 text-left"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="block text-sm font-semibold uppercase tracking-wide text-[#8899AA] mb-2">
            Paėmimo vieta
          </span>
          <LocationSearch
            value={value.location}
            onChange={(v) => set({ location: v })}
            placeholder="Vilnius, Kaunas, Klaipėda..."
          />
        </label>

        <div className="min-w-0">
          <DatePicker label="Nuo" value={value.dateFrom} onChange={(v) => set({ dateFrom: v })} />
        </div>
        <div className="min-w-0">
          <DatePicker
            label="Iki"
            value={value.dateTo}
            onChange={(v) => set({ dateTo: v })}
            minDate={value.dateFrom}
          />
        </div>

        <button
          type="submit"
          className="flex h-[72px] items-center justify-center gap-2 rounded-2xl bg-[#FF7A1A] px-8 text-lg font-bold text-[#0E0B1F] shadow-[0_10px_30px_-8px_rgba(255,122,26,0.6)] transition hover:-translate-y-0.5 hover:bg-[#FF8C3D] hover:shadow-[0_14px_36px_-8px_rgba(255,122,26,0.75)]"
        >
          <FiSearch className="text-xl" />
          Ieškoti
        </button>
      </div>
    </form>
  );
}
