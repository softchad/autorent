"use client";

import { FiSearch } from "react-icons/fi";
import DatePicker from "./DatePicker";
import LocationSearch from "./LocationSearch";
import { nextDay } from "@/utils/formatLt";

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

// Paieškos forma su vietos ir datų laukais - "hero" variantas pradiniame puslapyje (didelis, pilnas), "compact" header'yje (kompaktiškas, žr. PublicHeader.tsx showCompactSearch).
export default function SearchForm({
  value,
  onChange,
  onSubmit,
  variant = "hero",
}: SearchFormProps) {
  // Bendras laukelio atnaujinimas - pakeičia TIK nurodytus "value" raktus, kitus palieka kaip buvo.
  const set = (patch: Partial<SearchValue>) => onChange({ ...value, ...patch });

  // "Nuo" pasirinkus datą PO esamos "iki" datos - "iki" automatiškai pastumiama į kitą dieną po naujos "nuo", kad trumpam neatsirastų negaliojantis intervalas (iki < nuo), kol vartotojas pats nepataisytų "iki" rankiniu būdu.
  const setDateFrom = (v: string) => set({ dateFrom: v, dateTo: value.dateTo && value.dateTo > v ? value.dateTo : nextDay(v) });

  // "preventDefault" - sustabdo tikrą HTML formos pateikimą (puslapio perkrovimą), kad paieška vyktų per React (router.push), ne per naršyklės navigaciją.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  if (variant === "compact") {
    return (
      <form
        onSubmit={handleSubmit}
        className="hidden lg:flex items-center gap-5 bg-[#1A2238] border border-[#1C2B3A] rounded-full pl-6 pr-1.5 py-1.5 shadow-lg"
      >
        <LocationSearch value={value.location} onChange={(v) => set({ location: v })} placeholder="Vieta" compact />
        <div className="h-5 w-px bg-[#1C2B3A] shrink-0" />
        <DatePicker label="Nuo" value={value.dateFrom} onChange={setDateFrom} compact allowClear={false} />
        <div className="h-5 w-px bg-[#1C2B3A] shrink-0" />
        <DatePicker
          label="Iki"
          value={value.dateTo}
          onChange={(v) => set({ dateTo: v })}
          minDate={value.dateFrom}
          compact
          allowClear={false}
        />
        <button
          type="submit"
          aria-label="Ieškoti"
          className="shrink-0 bg-[#FF7A1A] hover:bg-[#FF8C3D] text-[#0B121F] p-2.5 rounded-full transition"
        >
          <FiSearch className="text-sm" />
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
          <DatePicker label="Nuo" value={value.dateFrom} onChange={setDateFrom} allowClear={false} />
        </div>
        <div className="min-w-0">
          <DatePicker
            label="Iki"
            value={value.dateTo}
            onChange={(v) => set({ dateTo: v })}
            minDate={value.dateFrom}
            allowClear={false}
          />
        </div>

        <button
          type="submit"
          className="flex h-[72px] items-center justify-center gap-2 rounded-2xl bg-[#FF7A1A] px-8 text-lg font-bold text-[#0B121F] shadow-[0_10px_30px_-8px_rgba(255,122,26,0.6)] transition hover:-translate-y-0.5 hover:bg-[#FF8C3D] hover:shadow-[0_14px_36px_-8px_rgba(255,122,26,0.75)]"
        >
          <FiSearch className="text-xl" />
          Ieškoti
        </button>
      </div>
    </form>
  );
}
