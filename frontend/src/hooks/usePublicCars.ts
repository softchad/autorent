"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PublicCar = {
  automobilio_id: number;
  marke: string;
  modelis: string;
  metai: number;
  spalva: string;
  kebulo_tipas: string;
  pavaru_deze: string;
  variklio_turis: number;
  galia_kw: number;
  kuro_tipas: string;
  rida: number;
  sedimos_vietos: number;
  klimato_kontrole: boolean;
  navigacija: boolean;
  kaina_parai: number;
  automobilio_statusas: string;
  lokacija: {
    vietos_id: number;
    pavadinimas: string;
    adresas: string;
    miestas: string;
  } | null;
  // Užpildoma tik kai užklausoje nurodytas datų intervalas - žr. usePublicCars/usePublicCar.
  laisvas_pasirinktu_laikotarpiu?: boolean | null;
};

export type DateRange = {
  dateFrom?: string;
  dateTo?: string;
};

// Grąžina tuščią eilutę, jei datos nepilnos - galima klausti laisvumo TIK kai yra ABI datos, pusė intervalo backend'ui nieko nereikštų.
function buildDateParams(range?: DateRange): string {
  if (!range?.dateFrom || !range?.dateTo) return "";
  const params = new URLSearchParams({ date_from: range.dateFrom, date_to: range.dateTo });
  return `?${params.toString()}`;
}

// Visų laisvų automobilių sąrašas iš /public/cars - parkas kol kas nedidelis, tad filtravimas/rikiavimas vyksta kliento pusėje po VIENO užklausimo, o ne per kiekvieną filtro paspaudimą; datų intervalui pasikeitus sąrašas užklausiamas IŠ NAUJO, nes laisvumas tam laikotarpiui tikrinamas realiai serveryje.
export function usePublicCars(range?: DateRange) {
  const [cars, setCars] = useState<PublicCar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dateFrom, dateTo } = range ?? {};

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetch(`${API}/api/v1/public/cars${buildDateParams({ dateFrom, dateTo })}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: PublicCar[]) => {
        if (controller.signal.aborted) return;
        setCars(data);
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError") setError("Nepavyko įkelti automobilių sąrašo.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });

    return () => controller.abort();
  }, [dateFrom, dateTo]);

  return { cars, isLoading, error };
}

// Vieno automobilio detalės /public/cars/{id} - jei perduotas datų intervalas, atsakyme atkeliauja "laisvas_pasirinktu_laikotarpiu", rodantis realų laisvumą TAI datai, ne vien bendrą automobilio statusą.
export function usePublicCar(id: number, range?: DateRange) {
  const [car, setCar] = useState<PublicCar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dateFrom, dateTo } = range ?? {};

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setNotFound(false);
    setError(null);
    fetch(`${API}/api/v1/public/cars/${id}${buildDateParams({ dateFrom, dateTo })}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          if (!controller.signal.aborted) setNotFound(true);
          return null;
        }
        if (!res.ok) {
          // Likusios ne-404 klaidos (pvz. 400 - netinkamas datų intervalas) NĖRA "automobilio nėra" - jas rodome kaip "error", ne "notFound", kad vartotojas nepamatytų klaidinančio "puslapis nerastas".
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? `Klaida (${res.status})`);
        }
        return res.json();
      })
      .then((data: PublicCar | null) => {
        if (!controller.signal.aborted && data) setCar(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError") setError(e.message ?? "Nepavyko įkelti automobilio duomenų.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });

    return () => controller.abort();
  }, [id, dateFrom, dateTo]);

  return { car, isLoading, notFound, error };
}

// Konkretaus automobilio užimtos dienos (ateinančius ~5 mėn., žr. backend public.py) - naudojama kalendoriuje vizualiai pažymėti, kad nereikėtų aklai spėlioti datų.
export function useCarBusyDates(id: number) {
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    // Nerodomas "error" - jei užklausa nepavyksta, tiesiog grąžinamas tuščias Set (kalendorius nerodys NIEKO užimto); žemo rizikingumo atvejis, nes tikra laisvumo patikra vis tiek vyksta serveryje rezervacijos kūrimo metu.
    fetch(`${API}/api/v1/public/cars/${id}/busy-dates`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { busy_dates: [] }))
      .then((data: { busy_dates: string[] }) => { if (!controller.signal.aborted) setBusyDates(new Set(data.busy_dates)); })
      .catch((e) => {
        if (!controller.signal.aborted && e.name !== "AbortError") setBusyDates(new Set());
      });

    return () => controller.abort();
  }, [id]);

  return busyDates;
}
