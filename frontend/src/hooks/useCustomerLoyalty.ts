"use client";

import { useCallback, useEffect, useState } from "react";
import { extractErrorMessage } from "@/utils/extractErrorMessage";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type LoyaltyReward = {
  atlygio_id: number;
  etapo_numeris: number;
  busena: "neisnaudotas" | "isnaudotas";
  verte_eur: number;
  sukurimo_data: string | null;
  panaudojimo_data: string | null;
};

export type LoyaltyStatus = {
  uzbaigtu_nuomu_skaicius: number;
  progresas_dabartiniame_etape: number;
  etapo_dydis: number;
  atlygio_verte_eur: number;
  atlygiai: LoyaltyReward[];
};

// Kliento lojalumo progreso būsena ir atlygių panaudojimas - kraunama vieną kartą prisijungus, vėliau iš naujo tik po sėkmingo "redeem" (nereikia nuolatinio poll'o kaip pokalbiams, progresas keičiasi tik po užsakymo).
export function useCustomerLoyalty(token: string | null) {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Kraunama IR pirmą kartą prisijungus (žr. useEffect žemiau), IR pakartotinai iš "redeem" sėkmės atveju, kad progresas/atlygių sąrašas atsinaujintų be puslapio perkrovimo.
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setStatus(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customer/loyalty`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setError("Nepavyko įkelti lojalumo būsenos.");
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

  // Grąžina sugeneruotą nuolaidos kodą (string) sėkmės atveju, arba null nepavykus - kviečiantis komponentas (AccountClient.tsx) kodą parodo klientui IŠ KARTO, nelaukiant, kol jis susirastų jį atskirame kodų sąraše.
  const redeem = useCallback(
    async (atlygioId: number): Promise<string | null> => {
      if (!token) return null;
      setRedeemError(null);
      try {
        const res = await fetch(`${API}/api/v1/customer/loyalty/rewards/${atlygioId}/redeem`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(extractErrorMessage(body, "Nepavyko panaudoti atlygio"));
        }
        await refresh();
        return body?.kodas ?? null;
      } catch (err) {
        setRedeemError(err instanceof Error ? err.message : "Nepavyko panaudoti atlygio");
        return null;
      }
    },
    [token, refresh]
  );

  return { status, isLoading, error, redeemError, redeem };
}
