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

// Darbuotojų pusės aptarnavimo hook'ai - paprastas fetch, ne RTK codegen; tokenas imamas iš tos pačios Redux authSlice, kaip ir likusi darbuotojų sąsaja.
export function useStaffConversationList(filter: QueueFilter) {
  const token = useAppSelector((s) => s.auth.token);
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/support/conversations?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setConversations(await res.json());
      setLoadError(null);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setLoadError("Nepavyko įkelti pokalbių sąrašo.");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    refresh(controller.signal);
    // Eilė atnaujinama pati (20s intervalu), kad darbuotojas pamatytų naują/pakeistą pokalbį nepersikraunant puslapio.
    const interval = setInterval(() => refresh(controller.signal), 20000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refresh]);

  return { conversations, isLoading, loadError, refresh };
}

// Vieno atidaryto pokalbio duomenys ir darbuotojo veiksmai (claim/reassign/reply/addNote/resolve) - visi veiksmai eina per bendrą runAction žemiau.
export function useStaffConversation(pokalbioId: number | null) {
  const token = useAppSelector((s) => s.auth.token);
  const [conversation, setConversation] = useState<StaffConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Atskiras nuo "actionError" - šis yra FONINIO poll'o klaida, tas - VARTOTOJO paspausto veiksmo (claim/reassign/reply/...) klaida; sumaišius juos, nepavykęs poll'as 5s intervalu užgožtų/trintų tik ką parodytą veiksmo klaidą.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token || !pokalbioId) return;
    try {
      const res = await fetch(`${API}/api/v1/support/conversations/${pokalbioId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setConversation(await res.json());
      setLoadError(null);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setLoadError("Nepavyko įkelti pokalbio.");
      }
    }
  }, [token, pokalbioId]);

  useEffect(() => {
    if (!pokalbioId) {
      setConversation(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    refresh(controller.signal).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    // Atidarytas pokalbis atnaujinamas dažniau (5s) nei eilė aukščiau, nes čia darbuotojas realiu laiku laukia kliento atsakymo.
    const interval = setInterval(() => refresh(controller.signal), 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [pokalbioId, refresh]);

  // Bendras POST veiksmo kvietimas visiems pokalbio veiksmams žemiau - klaidą IR įrašo į actionError (kad būtų parodyta UI), IR vis tiek meta toliau (throw), kad kviečiantis (pvz. support/page.tsx) žinotų, kad veiksmas nepavyko, ir nedarytų tolimesnių žingsnių (pvz. formos išvalymo).
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
  const reassign = useCallback(
    (darbuotojoId: number) => runAction("/reassign", { darbuotojo_id: darbuotojoId }),
    [runAction]
  );
  const reply = useCallback((tekstas: string, busena: "sprendziama" | "laukiama_kliento") => runAction("/messages", { tekstas, busena }), [runAction]);
  const addNote = useCallback((tekstas: string) => runAction("/notes", { tekstas }), [runAction]);
  const resolve = useCallback((santrauka: string) => runAction("/resolve", { santrauka }), [runAction]);

  // /seen grąžina tik santrauką (be žinučių/pastabų), tad NEpertvarko viso conversation state - kitaip dingtų jau įkeltas pokalbio turinys.
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

  return { conversation, isLoading, loadError, actionError, claim, reassign, reply, addNote, resolve, markSeen, refresh };
}
