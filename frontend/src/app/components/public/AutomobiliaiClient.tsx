"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  FiUsers,
  FiSettings,
  FiDroplet,
  FiMapPin,
  FiX,
  FiSlash,
  FiChevronDown,
  FiStar,
} from "react-icons/fi";
import PublicHeader from "./PublicHeader";
import MapTexture from "./MapTexture";
import { SearchValue } from "./SearchForm";
import { usePublicCars, PublicCar } from "@/hooks/usePublicCars";
import { getCarPhoto } from "@/utils/carPhoto";
import { LOCATIONS, distanceKm } from "@/utils/locations";
import { formatLt, defaultDateRange } from "@/utils/formatLt";
import { buildAutomobiliaiHref } from "@/utils/publicSearch";

const CarResultsMap = dynamic(() => import("./CarResultsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[#8899AA]">Kraunamas žemėlapis...</div>
  ),
});

type SortKey = "recommended" | "kaina_asc" | "closest" | "quality";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Rekomenduojama" },
  { value: "kaina_asc", label: "Pigiausia" },
  { value: "closest", label: "Arčiausiai žemėlapyje" },
  { value: "quality", label: "Geriausia kokybė" },
];

const DEFAULT_CENTER = { lat: 55.2, lng: 23.9 };

// Mažas, savarankiškas dropdown filtras juostoje - kiekviena kategorija (markė, kėbulo
// tipas...) savo atskiras mygtukas, o ne visi sugrūsti į vieną "Daugiau filtrų" meniu.
function FilterDropdown({
  label,
  count,
  options,
  selected,
  onToggle,
}: {
  label: string;
  count: number;
  options: { value: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <Popover className="relative">
      <PopoverButton
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
          count > 0
            ? "border-[#0F597B] bg-[#0F597B]/20 text-[#4BAFD4]"
            : "border-[#1C2B3A] bg-[#1A2238] text-[#8899AA] hover:text-[#F7F7F7]"
        }`}
      >
        {label} {count > 0 && `(${count})`}
        <FiChevronDown className="text-xs" />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="bottom start"
        className="z-50 mt-2 w-56 max-h-80 overflow-y-auto rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-3 shadow-2xl origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[closed]:-translate-y-1"
      >
        <div className="space-y-1">
          {options.map((o) => (
            <label key={o.value} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-[#1A2238]">
              <span className="flex items-center gap-2 text-[#C5CEDA]">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => onToggle(o.value)}
                  className="h-4 w-4 rounded border-[#1C2B3A] bg-[#1A2238] accent-[#0F597B]"
                />
                {o.value}
              </span>
              <span className="text-xs text-[#3D4F63]">{o.count}</span>
            </label>
          ))}
        </div>
      </PopoverPanel>
    </Popover>
  );
}

// Vietų skaičius yra VIENO pasirinkimo (ne multi-select) filtras, tad savo, atskiras
// dropdown, bet TOKS PAT vizualus stilius/elgesys kaip FilterDropdown (Markė/Kėbulas/
// Kuras) - atskiras mygtukas juostoje, ne sujungtas su kažkuo kitu į "Daugiau filtrų".
function SeatsFilterDropdown({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
          value
            ? "border-[#0F597B] bg-[#0F597B]/20 text-[#4BAFD4]"
            : "border-[#1C2B3A] bg-[#1A2238] text-[#8899AA] hover:text-[#F7F7F7]"
        }`}
      >
        Vietų sk. {value && `(${value}+)`}
        <FiChevronDown className="text-xs" />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="bottom start"
        className="z-50 mt-2 w-48 rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-3 shadow-2xl origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[closed]:-translate-y-1"
      >
        {({ close }) => (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => { onChange(null); close(); }}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
                !value ? "bg-[#0F597B]/20 text-[#4BAFD4]" : "text-[#C5CEDA] hover:bg-[#1A2238]"
              }`}
            >
              Visos
            </button>
            {[2, 4, 5, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { onChange(n); close(); }}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  value === n ? "bg-[#0F597B]/20 text-[#4BAFD4]" : "text-[#C5CEDA] hover:bg-[#1A2238]"
                }`}
              >
                {n}+ vietos
              </button>
            ))}
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}

// Rezultato "plytelė" - apvalus, iškylantis mygtukas, ne Excel lentelės eilutė. Puikaus
// pasiūlymo žymeklis (oranžinis švytėjimas) skirtas TOP 3 pagal "Rekomenduojama" balą,
// nepriklausomai nuo realiai pasirinkto rūšiavimo - tai nuoseklus "geras sandoris" ženklas.
function ResultCard({ car, isTopPick }: { car: PublicCar; isTopPick: boolean }) {
  return (
    <Link
      href={`/automobiliai/${car.automobilio_id}`}
      className={`group relative flex gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 ${
        isTopPick
          ? "border-[#FF7A1A]/50 bg-[#1A2238] shadow-[0_0_0_1px_rgba(255,122,26,0.15),0_8px_24px_-8px_rgba(255,122,26,0.35)] hover:shadow-[0_0_0_1px_rgba(255,122,26,0.3),0_12px_32px_-8px_rgba(255,122,26,0.5)]"
          : "border-[#1C2B3A] bg-[#0E1525] hover:border-[#0F597B]/40"
      }`}
    >
      {isTopPick && (
        <span className="absolute -top-2 left-3 flex items-center gap-1 rounded-full bg-[#FF7A1A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0B121F] shadow-[0_2px_10px_rgba(255,122,26,0.6)]">
          <FiStar className="text-[10px]" /> Puikus pasiūlymas
        </span>
      )}
      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl">
        <Image
          src={getCarPhoto(car)}
          alt={`${car.marke} ${car.modelis}`}
          fill
          sizes="128px"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-[#F7F7F7]">
            {car.marke} {car.modelis}
          </h3>
          <span className="shrink-0 text-sm text-[#707070]">{car.metai}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-[#8899AA]">
          <FiMapPin className="shrink-0" />
          <span className="truncate">{car.lokacija?.miestas ?? "Nenurodyta"}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8899AA]">
          <span className="flex items-center gap-1">
            <FiUsers className="text-[#4BAFD4]" /> {car.sedimos_vietos}
          </span>
          <span className="flex items-center gap-1">
            <FiSettings className="text-[#4BAFD4]" /> {car["pavaru_deze"]}
          </span>
          <span className="flex items-center gap-1">
            <FiDroplet className="text-[#4BAFD4]" /> {car.kuro_tipas}
          </span>
        </div>
        <p className="mt-2 text-lg font-bold text-[#F7F7F7]">
          {car.kaina_parai} € <span className="text-xs font-normal text-[#707070]">/ parai</span>
        </p>
      </div>
    </Link>
  );
}

export default function AutomobiliaiClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState<SearchValue>({ location: "", ...defaultDateRange() });
  const { cars, isLoading, error } = usePublicCars({ dateFrom: search.dateFrom, dateTo: search.dateTo });
  const [sort, setSort] = useState<SortKey>("recommended");
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  const [marke, setMarke] = useState<string[]>([]);
  const [kebuloTipas, setKebuloTipas] = useState<string[]>([]);
  const [kuroTipas, setKuroTipas] = useState<string[]>([]);
  const [pavaruDeze, setPavaruDeze] = useState<string[]>([]);
  const [minKaina, setMinKaina] = useState<string>("");
  const [maxKaina, setMaxKaina] = useState<string>("");
  const [sedimosVietos, setSedimosVietos] = useState<number | null>(null);
  const [vietosId, setVietosId] = useState<number | null>(null);

  // Iš URL parametrų (ateinant iš pradinio puslapio paieškos) paimame pradinę vietą ir datas.
  useEffect(() => {
    const loc = searchParams.get("location");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (loc || dateFrom || dateTo) {
      setSearch((s) => ({
        ...s,
        location: loc ?? s.location,
        dateFrom: dateFrom ?? s.dateFrom,
        dateTo: dateTo ?? s.dateTo,
      }));
    }
  }, [searchParams]);

  // Iš pradinio puslapio "Automobilių tipai" kortelių (ateina su ?kebulas= arba ?kuras=).
  useEffect(() => {
    const kebulas = searchParams.get("kebulas");
    const kuras = searchParams.get("kuras");
    if (kebulas) setKebuloTipas([kebulas]);
    if (kuras) setKuroTipas([kuras]);
  }, [searchParams]);

  // search.location visada tiksliai atitinka vieno padalinio miestą (LocationSearch
  // renkasi tik iš tikrų vietų, ne laisvo teksto), tad filtro vietos_id tiesiog
  // sinchronizuojame su juo - taip pasikeitus antraštės vietos laukui rezultatai
  // realiai atsinaujina, o ne tik iš pradinio URL.
  useEffect(() => {
    if (!search.location) return;
    const match = LOCATIONS.find((l) => l.city === search.location);
    if (match) setVietosId(match.vietos_id);
  }, [search.location]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const facets = useMemo(() => {
    const count = (key: keyof PublicCar) => {
      const map = new Map<string, number>();
      cars.forEach((c) => {
        const v = String(c[key]);
        map.set(v, (map.get(v) ?? 0) + 1);
      });
      return Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    };
    return {
      marke: count("marke"),
      kebuloTipas: count("kebulo_tipas"),
      kuroTipas: count("kuro_tipas"),
      pavaruDeze: count("pavaru_deze"),
    };
  }, [cars]);

  // Filtrai BE vietos - kad visi padaliniai liktų matomi/spaudžiami žemėlapyje net kai vienas pasirinktas.
  const filteredExceptLocation = useMemo(() => {
    return cars.filter((c) => {
      if (marke.length && !marke.includes(c.marke)) return false;
      if (kebuloTipas.length && !kebuloTipas.includes(c.kebulo_tipas)) return false;
      if (kuroTipas.length && !kuroTipas.includes(c.kuro_tipas)) return false;
      if (pavaruDeze.length && !pavaruDeze.includes(c["pavaru_deze"])) return false;
      if (minKaina && c.kaina_parai < Number(minKaina)) return false;
      if (maxKaina && c.kaina_parai > Number(maxKaina)) return false;
      if (sedimosVietos && c.sedimos_vietos < sedimosVietos) return false;
      return true;
    });
  }, [cars, marke, kebuloTipas, kuroTipas, pavaruDeze, minKaina, maxKaina, sedimosVietos]);

  const filtered = useMemo(() => {
    if (!vietosId) return filteredExceptLocation;
    return filteredExceptLocation.filter((c) => c.lokacija?.vietos_id === vietosId);
  }, [filteredExceptLocation, vietosId]);

  // "Rekomenduojama" balas - derina kainą (žemesnė geriau, svoris 0.6) ir metus (naujesni
  // geriau, svoris 0.4), normalizuota pagal šiuo metu matomus rezultatus. Naudojama ir
  // numatytajam rūšiavimui, ir TOP 3 "Puikus pasiūlymas" ženkleliui (žr. ResultCard).
  const scoreById = useMemo(() => {
    const map = new Map<number, number>();
    if (filtered.length === 0) return map;
    const prices = filtered.map((c) => c.kaina_parai);
    const years = filtered.map((c) => c.metai);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const minY = Math.min(...years), maxY = Math.max(...years);
    filtered.forEach((c) => {
      const priceScore = maxP > minP ? 1 - (c.kaina_parai - minP) / (maxP - minP) : 1;
      const yearScore = maxY > minY ? (c.metai - minY) / (maxY - minY) : 1;
      map.set(c.automobilio_id, priceScore * 0.6 + yearScore * 0.4);
    });
    return map;
  }, [filtered]);

  const topPickIds = useMemo(() => {
    if (filtered.length < 4) return new Set<number>();
    return new Set(
      [...scoreById.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
    );
  }, [scoreById, filtered.length]);

  function carDistanceKm(car: PublicCar): number {
    const loc = car.lokacija ? LOCATIONS.find((l) => l.vietos_id === car.lokacija!.vietos_id) : null;
    if (!loc) return Infinity;
    return distanceKm(mapCenter.lat, mapCenter.lng, loc.lat, loc.lng);
  }

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sort === "kaina_asc") copy.sort((a, b) => a.kaina_parai - b.kaina_parai);
    else if (sort === "quality") copy.sort((a, b) => b.metai - a.metai);
    else if (sort === "closest") copy.sort((a, b) => carDistanceKm(a) - carDistanceKm(b));
    else copy.sort((a, b) => (scoreById.get(b.automobilio_id) ?? 0) - (scoreById.get(a.automobilio_id) ?? 0));
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, mapCenter, scoreById]);

  // Žemėlapio taškai skaičiuojami BE vietos filtro (žr. filteredExceptLocation aukščiau),
  // kad visi padaliniai liktų matomi nepriklausomai nuo to, kuris šiuo metu pasirinktas.
  const mapStats = useMemo(() => {
    const map: Record<number, { count: number; minPrice: number }> = {};
    filteredExceptLocation.forEach((c) => {
      const id = c.lokacija?.vietos_id;
      if (!id) return;
      const existing = map[id];
      if (!existing) {
        map[id] = { count: 1, minPrice: c.kaina_parai };
      } else {
        existing.count += 1;
        existing.minPrice = Math.min(existing.minPrice, c.kaina_parai);
      }
    });
    return map;
  }, [filteredExceptLocation]);

  // Datų laukai NIEKADA neturi likti tušti - "Išvalyti" grąžina juos į numatytąjį
  // (šiandien -> rytoj) intervalą, ne į "", lygiai kaip pradinė šio komponento būsena.
  const clearFilters = () => {
    setMarke([]);
    setKebuloTipas([]);
    setKuroTipas([]);
    setPavaruDeze([]);
    setMinKaina("");
    setMaxKaina("");
    setSedimosVietos(null);
    setVietosId(null);
    setSearch((s) => ({ ...s, ...defaultDateRange() }));
  };

  // Datos skaičiuojamos kaip "aktyvus filtras" tik kai jos SKIRIASI nuo numatytojo
  // intervalo - priešingu atveju jos būtų amžinai įskaičiuotos (nes dabar niekada
  // nėra tuščios), ir "Išvalyti" mygtukas niekada neišnyktų net nieko nepasirinkus.
  const defaultRange = defaultDateRange();
  const activeFilterCount =
    marke.length + kebuloTipas.length + kuroTipas.length + pavaruDeze.length +
    (minKaina ? 1 : 0) + (maxKaina ? 1 : 0) + (sedimosVietos ? 1 : 0) + (vietosId ? 1 : 0) +
    (search.dateFrom !== defaultRange.dateFrom ? 1 : 0) +
    (search.dateTo !== defaultRange.dateTo ? 1 : 0);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#0B121F]">
      <MapTexture />
      <div className="relative z-10 flex h-full flex-col">
        <PublicHeader
          searchValue={search}
          onSearchChange={setSearch}
          onSearchSubmit={() => router.push(buildAutomobiliaiHref(search))}
        />

        {/* Filtrų juosta - vieta/datos valdomos VIRŠUTINĖJE paieškos juostoje (header'yje),
            ne čia pakartotinai - dvi atskiros paieškos juostos vienos po kitos buvo tikra
            dubliavimo/"per storo top bar" priežastis. Čia tik likę filtrai, sugrupuoti su
            plonais skirtukais - KIEKVIENAS savo atskiras mygtukas, jokio sujungto "Daugiau
            filtrų" meniu. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#1C2B3A] bg-[#0E1525]/80 px-4 py-2.5 backdrop-blur sm:px-6">
          {vietosId && (
            <span className="flex items-center gap-1.5 rounded-lg border border-[#0F597B] bg-[#0F597B]/20 px-3 py-2 text-sm text-[#4BAFD4]">
              <FiMapPin className="text-xs" />
              {LOCATIONS.find((l) => l.vietos_id === vietosId)?.name ?? "Pasirinkta vieta"}
              <button onClick={() => setVietosId(null)} aria-label="Pašalinti vietos filtrą" className="text-[#4BAFD4]/70 hover:text-[#4BAFD4]">
                <FiX className="text-xs" />
              </button>
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              placeholder="Kaina nuo"
              value={minKaina}
              onChange={(e) => setMinKaina(e.target.value)}
              className="w-24 bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#0F597B]"
            />
            <span className="text-[#3D4F63]">-</span>
            <input
              type="number"
              min={0}
              placeholder="iki"
              value={maxKaina}
              onChange={(e) => setMaxKaina(e.target.value)}
              className="w-20 bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] placeholder-[#3D4F63] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#0F597B]"
            />
          </div>

          <div className="h-6 w-px shrink-0 bg-[#1C2B3A]" />

          <FilterDropdown label="Markė" count={marke.length} options={facets.marke} selected={marke} onToggle={(v) => toggle(marke, setMarke, v)} />
          <FilterDropdown label="Kėbulas" count={kebuloTipas.length} options={facets.kebuloTipas} selected={kebuloTipas} onToggle={(v) => toggle(kebuloTipas, setKebuloTipas, v)} />
          <FilterDropdown label="Kuras" count={kuroTipas.length} options={facets.kuroTipas} selected={kuroTipas} onToggle={(v) => toggle(kuroTipas, setKuroTipas, v)} />

          <div className="h-6 w-px shrink-0 bg-[#1C2B3A]" />

          <SeatsFilterDropdown value={sedimosVietos} onChange={setSedimosVietos} />
          <FilterDropdown label="Pavarų dėžė" count={pavaruDeze.length} options={facets.pavaruDeze} selected={pavaruDeze} onToggle={(v) => toggle(pavaruDeze, setPavaruDeze, v)} />

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/50"
            >
              <FiX /> Išvalyti ({activeFilterCount})
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <p className="whitespace-nowrap text-xs text-[#8899AA]">
              {isLoading
                ? "Kraunama..."
                : search.dateFrom && search.dateTo
                  ? `${sorted.length} automobilių, laisvų ${formatLt(search.dateFrom)} - ${formatLt(search.dateTo)}`
                  : `${sorted.length} automobilių`}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-[#1A2238] border border-[#1C2B3A] text-[#F7F7F7] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F597B]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pagrindinis turinys: žemėlapis (2/3, dominuojantis) + rezultatų sąrašas (1/3) */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative h-[42vh] shrink-0 lg:h-auto lg:flex-[2]">
            <CarResultsMap
              stats={mapStats}
              activeVietosId={vietosId}
              // Funkcinė setState forma - visada mato NAUJAUSIĄ vietosId, net jei
              // Leaflet event handler closure (CarResultsMap.tsx) būtų pasenusi.
              onSelectLocation={(id) => setVietosId((prev) => (prev === id ? null : id))}
              onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
            />
            {/* Vinjetė - pritemdyti žemėlapio kraštai, kad tikros (nebe invertuotos)
                plytelių spalvos švelniau "susilietų" su tamsiu puslapio fonu, ne
                staigiai nukirstų stačiu kampu. pointer-events-none, kad nebūtų
                užblokuoti markerių paspaudimai/vilkimas po šiuo sluoksniu. */}
            <div className="pointer-events-none absolute inset-0 z-[5] shadow-[inset_0_0_60px_30px_rgba(11,18,31,0.55)]" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-[#1C2B3A] p-3 lg:flex-[1] lg:border-t-0 lg:border-l">
            {error && <div className="p-6 text-sm text-[#8899AA]">{error}</div>}

            {!error && !isLoading && sorted.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-16 text-center">
                <FiSlash className="text-3xl text-[#3D4F63]" />
                <p className="text-sm text-[#8899AA]">Pagal pasirinktus filtrus automobilių nerasta.</p>
                <button onClick={clearFilters} className="text-sm text-[#4BAFD4] hover:underline">
                  Išvalyti filtrus
                </button>
              </div>
            )}

            {!error && sorted.map((car) => (
              <ResultCard key={car.automobilio_id} car={car} isTopPick={topPickIds.has(car.automobilio_id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
