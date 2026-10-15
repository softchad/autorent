"use client";

import { useCallback, useEffect, useState } from "react";
import { extractErrorMessage } from "@/utils/extractErrorMessage";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type CustomerReservation = {
  rezervacijos_id: number;
  automobilio_id: number;
  marke: string;
  modelis: string;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
  busena: string;
  dienu_skaicius: number;
  kaina_parai: number;
  viso_kaina: number;
};

// Prisijungusio kliento rezervacijų sąrašas "Mano nuomos" sekcijai paskyros puslapyje.
export function useCustomerReservations(token: string | null) {
  const [reservations, setReservations] = useState<CustomerReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kraunama vieną kartą prisijungus (žr. useEffect žemiau); "refresh" IR grąžinamas, kad kviečiantis komponentas galėtų jį rankiniu būdu iškviesti iš naujo, kai reikia.
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setReservations([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customer/reservations`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setReservations(await res.json());
      setError(null);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setError("Nepavyko įkelti rezervacijų.");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return { reservations, isLoading, error, refresh };
}

// Naujos rezervacijos kūrimas automobilio detalių puslapyje - atskira funkcija (ne hook'as), nes kviečiama VIENKARTINIO veiksmo metu, ne komponento viso gyvavimo metu; meta serverio klaidos pranešimą (409 užimtas, 404 nerastas ir pan.), kad kviečiantis komponentas galėtų jį tiesiog parodyti vartotojui.
export async function createCustomerReservation(
  token: string,
  automobilio_id: number,
  dateFrom: string,
  dateTo: string
): Promise<CustomerReservation> {
  const res = await fetch(`${API}/api/v1/customer/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ automobilio_id, date_from: dateFrom, date_to: dateTo }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(body, "Nepavyko sukurti rezervacijos"));
  }
  return res.json();
}
