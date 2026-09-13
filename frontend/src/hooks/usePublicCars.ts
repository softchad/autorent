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
  kuro_tipas: string;
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
  const { dateFrom, dateTo } = range ?? {};

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setNotFound(false);
    fetch(`${API}/api/v1/public/cars/${id}${buildDateParams({ dateFrom, dateTo })}`, { signal: controller.signal })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: PublicCar | null) => {
        if (data) setCar(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setNotFound(true);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [id, dateFrom, dateTo]);

  return { car, isLoading, notFound };
}
