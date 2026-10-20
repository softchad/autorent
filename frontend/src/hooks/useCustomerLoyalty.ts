"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractErrorMessage } from "@/utils/extractErrorMessage";
import type { DiscountCodeOut } from "@/store/autorentApi";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Kliento nuolaidų sąrašas naudoja jo prisijungimo bilietą, nes darbuotojų užklausų bilietas nesuteikia prieigos prie kliento savitarnos.
export function useCustomerDiscountCodes(token: string | null) {
  const active = useRef(token);
  active.current = token;
  const [result, setResult] = useState<{ token: string; data: DiscountCodeOut[] } | null>(null);
  const refetch = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/v1/customer/discount-codes`, {
        headers: { Authorization: `Bearer ${token}` }, signal,
      });
      if (!response.ok) return;
      const data: DiscountCodeOut[] = await response.json();
      if (!signal?.aborted && active.current === token) setResult({ token, data });
    } catch {
      // Nepavykęs kodo gavimas nekeičia išsaugotų duomenų; sąrašas vėl užklausiamas atidarius paskyrą arba panaudojus atlygį.
    }
  }, [token]);
  useEffect(() => {
    const controller = new AbortController();
    refetch(controller.signal);
    return () => controller.abort();
  }, [refetch]);
  return { data: result?.token === token ? result.data : undefined, refetch };
}

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
  const active = useRef(token);
  active.current = token;
  const [owner, setOwner] = useState<string | null>(null);
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
      const data: LoyaltyStatus = await res.json();
      if (signal?.aborted || active.current !== token) return;
      setOwner(token);
      setStatus(data);
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

  return { status: owner === token ? status : null, isLoading, error, redeemError, redeem };
}
