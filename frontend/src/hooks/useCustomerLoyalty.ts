"use client";

import { useCallback, useEffect, useState } from "react";

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

// Kliento lojalumo progreso ir atlygių gavimas/panaudojimas - žr. backend
// app/api/v1/endpoints/customer_loyalty.py.
export function useCustomerLoyalty(token: string | null) {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setStatus(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customer/loyalty`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const redeem = useCallback(
    async (atlygioId: number) => {
      if (!token) return;
      setRedeemError(null);
      try {
        const res = await fetch(`${API}/api/v1/customer/loyalty/rewards/${atlygioId}/redeem`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? "Nepavyko panaudoti atlygio");
        }
        await refresh();
      } catch (err) {
        setRedeemError(err instanceof Error ? err.message : "Nepavyko panaudoti atlygio");
      }
    },
    [token, refresh]
  );

  return { status, isLoading, redeemError, redeem };
}
