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
  "pavarų_deze": string;
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

function buildDateParams(range?: DateRange): string {
  if (!range?.dateFrom || !range?.dateTo) return "";
  const params = new URLSearchParams({ date_from: range.dateFrom, date_to: range.dateTo });
  return `?${params.toString()}`;
}

// Vienkartinis realaus laisvų automobilių sąrašo gavimas iš viešo /public/cars
// endpointo. Kadangi parkas kol kas nedidelis, filtravimas/rikiavimas atliekamas
// kliento pusėje po vieno užklausimo, o ne per kiekvieną filtro paspaudimą.
// Jeigu perduotas datų intervalas, sąrašas vėl užklausiamas iš serverio - laisvumas
// tam laikotarpiui tikrinamas realiai (žr. backend app/services/availability_service.py).
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
        setCars(data);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Nepavyko įkelti automobilių sąrašo.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [dateFrom, dateTo]);

  return { cars, isLoading, error };
}

// Vieno automobilio detalių gavimas /public/cars/{id} endpointui - naudojama
// automobilio detalių puslapyje. Jeigu perduotas datų intervalas, atsakyme atkeliauja
// laisvas_pasirinktu_laikotarpiu, parodantis realų laisvumą TAI datai, ne vien bendrą statusą.
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
          setNotFound(true);
          return null;
        }
        if (!res.ok) {
          // NE "automobilio nėra" - tai gali būti ir 400 (netinkamas datų
          // intervalas), kurį anksčiau ši funkcija klaidingai paversdavo į notFound.
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? `Klaida (${res.status})`);
        }
        return res.json();
      })
      .then((data: PublicCar | null) => {
        if (data) setCar(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message ?? "Nepavyko įkelti automobilio duomenų.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [id, dateFrom, dateTo]);

  return { car, isLoading, notFound, error };
}

// Konkretaus automobilio užimtos dienos (ateinančius ~4 mėn.) - naudojama
// kalendoriuje vizualiai pažymėti, kad nereikėtų aklai spėlioti datų.
export function useCarBusyDates(id: number) {
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/v1/public/cars/${id}/busy-dates`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { busy_dates: [] }))
      .then((data: { busy_dates: string[] }) => setBusyDates(new Set(data.busy_dates)))
      .catch((e) => {
        if (e.name !== "AbortError") setBusyDates(new Set());
      });

    return () => controller.abort();
  }, [id]);

  return busyDates;
}
