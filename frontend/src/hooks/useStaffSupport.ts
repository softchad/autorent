"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ReservationContext = {
  rezervacijos_id: number;
  marke: string;
  modelis: string;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
};

export type SupportMessage = {
  zinutes_id: number;
  autoriaus_tipas: "klientas" | "darbuotojas";
  autorius_vardas: string | null;
  tekstas: string;
  sukurimo_data: string;
};

export type SupportNote = {
  pastabos_id: number;
  darbuotojo_vardas: string;
  tekstas: string;
  sukurimo_data: string;
};

export type StaffConversation = {
  pokalbio_id: number;
  tema: string;
  kategorija: string;
  busena: string;
  sukurimo_data: string;
  atnaujinimo_data: string;
  paskutine_zinute: string | null;
  paskutine_zinute_autorius: string | null;
  neperskaityta: boolean;
  rezervacija: ReservationContext | null;
  sprendimo_santrauka: string | null;
  kliento_vardas: string;
  darbuotojo_id: number | null;
  darbuotojo_vardas: string | null;
  reikia_atsakyti: boolean;
};

export type StaffConversationDetail = StaffConversation & {
  zinutes: SupportMessage[];
  pastabos: SupportNote[];
};

export type QueueFilter = "all" | "unassigned" | "mine" | "needs_reply" | "waiting" | "resolved";

// Darbuotojų pusės aptarnavimo hook'ai - paprastas fetch, ne RTK codegen (naujas
// modulis, sąmoningai laikomas mažas - žr. AUTORENT_KLIENTU_APTARNAVIMO_SISTEMOS_SPECIFIKACIJA.md).
// Tokenas imamas iš tos pačios Redux authSlice, kaip ir likusi darbuotojų sąsaja.
export function useStaffConversationList(filter: QueueFilter) {
  const token = useAppSelector((s) => s.auth.token);
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/support/conversations?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setConversations(await res.json());
    setIsLoading(false);
  }, [token, filter]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    // Sąrašo/eilės polling - kas 20s, kol matoma (žr. specifikacijos 10 skyrių).
    const interval = setInterval(refresh, 20000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { conversations, isLoading, refresh };
}

export function useStaffConversation(pokalbioId: number | null) {
  const token = useAppSelector((s) => s.auth.token);
  const [conversation, setConversation] = useState<StaffConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !pokalbioId) return;
    const res = await fetch(`${API}/api/v1/support/conversations/${pokalbioId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setConversation(await res.json());
  }, [token, pokalbioId]);

  useEffect(() => {
    if (!pokalbioId) {
      setConversation(null);
      return;
    }
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
    // Atidaryto pokalbio polling - kas 5s (žr. specifikacijos 10 skyrių).
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [pokalbioId, refresh]);

  const runAction = useCallback(
    async (path: string, body?: object) => {
      if (!token || !pokalbioId) return;
      setActionError(null);
      try {
        const res = await fetch(`${API}/api/v1/support/conversations/${pokalbioId}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail ?? "Veiksmas nepavyko");
        }
        setConversation(await res.json());
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Veiksmas nepavyko");
        throw err;
      }
    },
    [token, pokalbioId]
  );

  const claim = useCallback(() => runAction("/claim"), [runAction]);
  const reply = useCallback((tekstas: string, busena: "sprendziama" | "laukiama_kliento") => runAction("/messages", { tekstas, busena }), [runAction]);
  const addNote = useCallback((tekstas: string) => runAction("/notes", { tekstas }), [runAction]);
  const resolve = useCallback((santrauka: string) => runAction("/resolve", { santrauka }), [runAction]);

  // /seen grąžina tik santrauką (be žinučių/pastabų), tad NEpertvarko viso
  // conversation state - kitaip dingtų jau įkeltas pokalbio turinys.
  const markSeen = useCallback(
    async (zinutesId: number) => {
      if (!token || !pokalbioId) return;
      try {
        await fetch(`${API}/api/v1/support/conversations/${pokalbioId}/seen`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zinutes_id: zinutesId }),
        });
      } catch {
        // tylus - neperskaitymo žyma nėra kritinė
      }
    },
    [token, pokalbioId]
  );

  return { conversation, isLoading, actionError, claim, reply, addNote, resolve, markSeen, refresh };
}
