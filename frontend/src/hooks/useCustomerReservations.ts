"use client";

import { useCallback, useEffect, useState } from "react";

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

// Prisijungusio kliento rezervacijų sąrašas "Mano nuomos" sekcijai - žr.
// backend app/api/v1/endpoints/customer.py GET /customer/reservations.
export function useCustomerReservations(token: string | null) {
  const [reservations, setReservations] = useState<CustomerReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setReservations([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customer/reservations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setReservations(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reservations, isLoading, refresh };
}

// Naujos rezervacijos kūrimas - naudojama automobilio detalių puslapyje.
// Meta serverio klaidos pranešimą (409 užimtas, 404 nerastas ir pan.), kad
// kviečiantis komponentas galėtų jį tiesiog parodyti vartotojui.
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
    throw new Error(body?.detail ?? "Nepavyko sukurti rezervacijos");
  }
  return res.json();
}
