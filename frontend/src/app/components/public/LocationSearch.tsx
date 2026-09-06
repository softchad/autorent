"use client";

import { useMemo, useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { FiMapPin, FiSearch, FiLoader, FiNavigation } from "react-icons/fi";
import { LOCATIONS, distanceKm, LocationWithCoords } from "@/utils/locations";

// Kayak stiliaus vietos paieška, bet sąžininga mūsų realybei: AutoRent turi tik 10
// tikrų padalinių, ne pristatymą bet kuriuo adresu. Atidarius be teksto rodomi visi
// padaliniai ("Populiariausios vietos"). Renkant tekstą, sąrašas filtruojamas VIETOJE
// (be jokios užklausos - laisva ir greita). Paspaudus Enter/paieškos mygtuką daroma
// VIENA (ne kiekvienam klavišui) užklausa į Nominatim, kad rastume įvesto adreso
// koordinates ir surikiuotume tikrus padalinius nuo artimiausio - taip Nominatim
// naudojimo taisyklės nepažeidžiamos (jos draudžia autocomplete kiekvienam klavišui,
// bet vienkartinė adreso paieška yra tiksliai tam skirta).
type SortedLocation = LocationWithCoords & { distanceKm?: number };

async function geocodeOnce(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=lt&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function LocationSearch({
  value,
  onChange,
  compact = false,
  placeholder = "Pasirink padalinį",
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [sorted, setSorted] = useState<SortedLocation[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const selectedLocation = LOCATIONS.find((l) => l.city === value);

  const filtered = useMemo((): SortedLocation[] => {
    // Kai jau turime atstumu surikiuotus rezultatus (po adreso paieškos), rodome
    // visus - vartotojo įvestas adresas natūraliai nesutaps su padalinio pavadinimu,
    // tad papildomas teksto filtras čia tik ištrintų sąrašą.
    if (sorted) return sorted;
    if (!query.trim()) return LOCATIONS;
    const q = query.trim().toLowerCase();
    return LOCATIONS.filter(
      (l) => l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    );
  }, [query, sorted]);

  const runAddressSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const point = await geocodeOnce(query);
      if (!point) {
        setSearchError("Adreso nepavyko rasti. Pabandyk kitaip suformuluoti.");
        setSorted(null);
        return;
      }
      const withDistance = LOCATIONS.map((l) => ({
        ...l,
        distanceKm: distanceKm(point.lat, point.lng, l.lat, l.lng),
      })).sort((a, b) => a.distanceKm - b.distanceKm);
      setSorted(withDistance);
    } catch {
      setSearchError("Nepavyko atlikti paieškos. Pabandyk vėliau.");
    } finally {
      setSearching(false);
    }
  };

  const reset = () => {
    setQuery("");
    setSorted(null);
    setSearchError(null);
  };

  const panel = (close: () => void) => (
    <div className="w-[320px] rounded-2xl border border-[#1C2B3A] bg-[#0E1525] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-[#1C2B3A] p-3">
        <FiSearch className="shrink-0 text-[#4BAFD4]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (sorted) setSorted(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runAddressSearch();
            }
          }}
          placeholder="Įvesk adresą ir spausk Enter..."
          className="w-full bg-transparent text-sm text-[#F7F7F7] placeholder-[#3D4F63] focus:outline-none"
        />
        {searching && <FiLoader className="shrink-0 animate-spin text-[#3D4F63]" />}
      </div>

      {query.trim() && (
        <button
          onClick={runAddressSearch}
          disabled={searching}
          className="flex w-full items-center gap-2 border-b border-[#1C2B3A] px-4 py-2.5 text-left text-xs text-[#4BAFD4] hover:bg-[#1A2238] transition disabled:opacity-50"
        >
          <FiNavigation className="shrink-0" />
          Rasti artimiausius padalinius adresui &quot;{query}&quot;
        </button>
      )}

      {searchError && <p className="px-4 py-2 text-xs text-red-400">{searchError}</p>}

      <div className="max-h-72 overflow-y-auto py-1">
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#3D4F63]">
          {sorted ? "Artimiausi padaliniai" : query.trim() ? "Atitinka" : "Populiariausios vietos"}
        </p>
        {filtered.length === 0 && <p className="px-4 py-3 text-sm text-[#707070]">Nieko nerasta.</p>}
        {filtered.map((l) => (
          <button
            key={l.vietos_id}
            onClick={() => {
              onChange(l.city);
              close();
              reset();
            }}
            className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-[#1A2238]"
          >
            <FiMapPin className="mt-0.5 shrink-0 text-[#4BAFD4]" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-[#F7F7F7]">{l.name}</span>
              <span className="block truncate text-xs text-[#707070]">{l.address}</span>
            </span>
            {typeof l.distanceKm === "number" && (
              <span className="shrink-0 text-xs text-[#4BAFD4]">{l.distanceKm.toFixed(1)} km</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  if (compact) {
    return (
      <Popover className="relative min-w-0">
        <PopoverButton className="flex min-w-0 items-center gap-2 text-left focus:outline-none">
          <FiMapPin className="text-[#4BAFD4] text-lg shrink-0" />
          <span className="w-32 min-w-0 truncate text-sm font-medium text-[#F7F7F7]">
            {selectedLocation ? selectedLocation.name : placeholder}
          </span>
        </PopoverButton>
        <PopoverPanel anchor="bottom start" className="z-50 mt-2">
          {({ close }) => panel(close)}
        </PopoverPanel>
      </Popover>
    );
  }

  return (
    <Popover className="relative">
      <PopoverButton className="w-full text-left focus:outline-none">
        <span className="flex h-[72px] w-full items-center gap-2.5 rounded-2xl border border-[#1C2B3A] bg-[#1A2238] px-5 transition hover:border-[#0F597B]/50 data-[active]:border-[#0F597B]">
          <FiMapPin className="shrink-0 text-[#4BAFD4] text-xl" />
          <span className={`truncate text-lg font-medium ${selectedLocation ? "text-[#F7F7F7]" : "text-[#3D4F63]"}`}>
            {selectedLocation ? selectedLocation.name : placeholder}
          </span>
        </span>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" className="z-50 mt-2">
        {({ close }) => panel(close)}
      </PopoverPanel>
    </Popover>
  );
}
