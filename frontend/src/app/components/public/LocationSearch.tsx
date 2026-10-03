"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from "@headlessui/react";
import { FiMapPin, FiLoader, FiNavigation, FiCrosshair } from "react-icons/fi";
import { LOCATIONS, distanceKm, LocationWithCoords } from "@/utils/locations";

type SortedLocation = LocationWithCoords & { distanceKm?: number };
// Ypatinga "pasirinktis" sąrašo gale - geokoduoti laisvą tekstą, ne rinktis esamą padalinį.
const GEOCODE_ACTION = "__geocode__";

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
  const [userPoint, setUserPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const triedGeolocation = useRef(false);

  const withDistances = useMemo((): SortedLocation[] => {
    if (!userPoint) return LOCATIONS;
    return LOCATIONS.map((l) => ({ ...l, distanceKm: distanceKm(userPoint.lat, userPoint.lng, l.lat, l.lng) })).sort(
      (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)
    );
  }, [userPoint]);

  // Vieną kartą bando nustatyti vartotojo buvimo vietą (naršyklės Geolocation API -
  // tikslesnis ir nemokamas, be IP-geolokacijos trečios šalies servisų/raktų) ir
  // automatiškai parenka ARTIMIAUSIĄ padalinį, jei vartotojas vietos dar nepasirinko.
  // Tylus "best effort" - jei leidimas atmetamas, tiesiog nieko numatytai nerenkama.
  useEffect(() => {
    if (triedGeolocation.current || value || !navigator.geolocation) return;
    triedGeolocation.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPoint(point);
        const nearest = [...LOCATIONS].sort(
          (a, b) => distanceKm(point.lat, point.lng, a.lat, a.lng) - distanceKm(point.lat, point.lng, b.lat, b.lng)
        )[0];
        if (nearest) onChange(nearest.city);
      },
      () => {
        // atmesta/nepavyko - paliekam tuščią, vartotojas rinksis pats
      },
      { timeout: 5000, maximumAge: 10 * 60 * 1000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo((): SortedLocation[] => {
    if (!query.trim()) return withDistances;
    const q = query.trim().toLowerCase();
    return withDistances.filter(
      (l) => l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    );
  }, [query, withDistances]);

  const runAddressSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const point = await geocodeOnce(query);
      if (!point) {
        setSearchError("Adreso nepavyko rasti. Pabandyk kitaip suformuluoti.");
        return;
      }
      setUserPoint(point);
      const nearest = [...LOCATIONS].sort(
        (a, b) => distanceKm(point.lat, point.lng, a.lat, a.lng) - distanceKm(point.lat, point.lng, b.lat, b.lng)
      )[0];
      if (nearest) {
        onChange(nearest.city);
        setQuery("");
      }
    } catch {
      setSearchError("Nepavyko atlikti paieškos. Pabandyk vėliau.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (city: string | null) => {
    if (!city) return;
    if (city === GEOCODE_ACTION) {
      runAddressSearch();
      return;
    }
    onChange(city);
    setQuery("");
    setSearchError(null);
  };

  // TIKRA (ne placeholder) reikšmė lauke, kai padalinys pasirinktas - kitaip
  // pavadinimas rodytųsi placeholder spalva (prigesinta), ne kaip tikras pasirinkimas.
  const displayValue = (city: string) => LOCATIONS.find((l) => l.city === city)?.name ?? "";

  return (
    <Combobox value={value} onChange={handleSelect} immediate>
      <div className="relative min-w-0">
        <div className={`flex min-w-0 items-center gap-2 ${compact ? "" : "h-[72px] w-full rounded-2xl border border-[#1C2B3A] bg-[#1A2238] px-5 transition hover:border-[#0F597B]/50 data-[active]:border-[#0F597B]"}`}>
          <FiMapPin className={`shrink-0 text-[#4BAFD4] ${compact ? "text-lg" : "text-xl"}`} />
          <ComboboxInput
            displayValue={displayValue}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder={placeholder}
            className={`w-full min-w-0 truncate bg-transparent focus:outline-none placeholder-[#3D4F63] ${
              compact ? "text-sm font-medium text-[#F7F7F7]" : "text-lg font-medium text-[#F7F7F7]"
            }`}
          />
          {searching && <FiLoader className="shrink-0 animate-spin text-[#3D4F63]" />}
        </div>

        <ComboboxOptions
          transition
          anchor="bottom start"
          className="z-50 mt-2 w-[320px] rounded-2xl border border-[#1C2B3A] bg-[#0E1525] shadow-2xl py-1 empty:hidden origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[closed]:-translate-y-1"
        >
          {searchError && <p className="px-4 py-2 text-xs text-red-400">{searchError}</p>}

          <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#3D4F63]">
            {userPoint ? "Artimiausi padaliniai" : query.trim() ? "Atitinka" : "Visi padaliniai"}
          </p>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-[#707070]">Nieko nerasta - pabandyk įvesti adresą žemiau.</p>
            )}
            {filtered.map((l) => (
              <ComboboxOption
                key={l.vietos_id}
                value={l.city}
                className="flex cursor-pointer items-start gap-2.5 px-4 py-2.5 data-[focus]:bg-[#1A2238]"
              >
                <FiMapPin className="mt-0.5 shrink-0 text-[#4BAFD4]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[#F7F7F7]">{l.name}</span>
                  <span className="block truncate text-xs text-[#707070]">{l.address}</span>
                </span>
                {typeof l.distanceKm === "number" && (
                  <span className="shrink-0 text-xs text-[#4BAFD4]">{l.distanceKm.toFixed(0)} km</span>
                )}
              </ComboboxOption>
            ))}
          </div>

          {query.trim() && (
            <ComboboxOption
              value={GEOCODE_ACTION}
              className="flex w-full items-center gap-2 border-t border-[#1C2B3A] px-4 py-2.5 text-left text-xs text-[#4BAFD4] data-[focus]:bg-[#1A2238]"
            >
              <FiNavigation className="shrink-0" />
              Rasti artimiausią padalinį adresui &quot;{query}&quot;
            </ComboboxOption>
          )}

          {!query.trim() && !userPoint && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triedGeolocation.current = false;
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setUserPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => setSearchError("Nepavyko nustatyti buvimo vietos - leisk prieigą naršyklėje.")
                  );
                }
              }}
              className="flex w-full items-center gap-2 border-t border-[#1C2B3A] px-4 py-2.5 text-left text-xs text-[#4BAFD4] hover:bg-[#1A2238] transition"
            >
              <FiCrosshair className="shrink-0" />
              Arčiausiai manės
            </button>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
