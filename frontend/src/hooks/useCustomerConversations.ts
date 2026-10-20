"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractErrorMessage } from "@/utils/extractErrorMessage";

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

export type Conversation = {
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
};

export type ConversationDetail = Conversation & { zinutes: SupportMessage[] };

// Pokalbių sąrašas - atnaujinamas pats (20s intervalu), kad klientas pamatytų darbuotojo atsakymą nepersikraunant puslapio.
export function useConversationList(token: string | null) {
  const active = useRef(token);
  active.current = token;
  const [owner, setOwner] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      setConversations([]);
      return;
    }
    try {
      const res = await fetch(`${API}/api/v1/customer/support/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: Conversation[] = await res.json();
      if (signal?.aborted || active.current !== token) return;
      setOwner(token);
      setConversations(data);
      setLoadError(null);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setLoadError("Nepavyko įkelti pokalbių sąrašo.");
      }
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    refresh(controller.signal).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    const interval = setInterval(() => refresh(controller.signal), 20000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refresh]);

  return { conversations: owner === token ? conversations : [], isLoading, loadError, refresh };
}

// Atidaryto pokalbio žinutės - atnaujinamos dažniau (5s) nei sąrašas aukščiau, nes čia klientas realiu laiku laukia darbuotojo atsakymo.
export function useConversation(token: string | null, pokalbioId: number | null) {
  const identity = `${token}:${pokalbioId}`;
  const active = useRef(identity);
  active.current = identity;
  const pending = useRef(false);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token || !pokalbioId) return;
    try {
      const res = await fetch(`${API}/api/v1/customer/support/conversations/${pokalbioId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data: ConversationDetail = await res.json();
      if (signal?.aborted || active.current !== identity) return;
      setConversation(data);
      // Be šito VIENA nepavykusi apklausa amžinai paliktų klaidos žinutę ekrane, net kai KITAS (po 5s) bandymas jau pavyksta.
      setError(null);
    } catch (e) {
      if (active.current === identity && !signal?.aborted && (e as { name?: string })?.name !== "AbortError") {
        setError("Nepavyko įkelti pokalbio.");
      }
    }
  }, [token, pokalbioId, identity]);

  useEffect(() => {
    setConversation(null); setError(null);
    if (!pokalbioId) {
      setConversation(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    refresh(controller.signal).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    const interval = setInterval(() => refresh(controller.signal), 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [pokalbioId, refresh]);

  // Siunčia žinutę ir IŠKART pakeičia "conversation" atsakymu (jame jau yra naujausia žinutė) - nelaukiama kito poll'o, kad klientas pamatytų savo žinutę be delsos.
  const send = useCallback(
    async (tekstas: string) => {
      if (!token || !pokalbioId || pending.current) return false;
      pending.current = true;
      setSending(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/v1/customer/support/conversations/${pokalbioId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tekstas }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(extractErrorMessage(body, "Nepavyko išsiųsti žinutės"));
        }
        const data: ConversationDetail = await res.json();
        if (active.current === identity) setConversation(data);
        return true;
      } catch (err) {
        if (active.current === identity) setError(err instanceof Error ? err.message : "Nepavyko išsiųsti žinutės");
        return false;
      } finally {
        pending.current = false;
        setSending(false);
      }
    },
    [token, pokalbioId, identity]
  );

  // /seen grąžina tik santrauką - NEpertvarkome viso conversation state.
  const markSeen = useCallback(
    async (zinutesId: number) => {
      if (!token || !pokalbioId) return;
      try {
        await fetch(`${API}/api/v1/customer/support/conversations/${pokalbioId}/seen`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zinutes_id: zinutesId }),
        });
      } catch {
        // tylus
      }
    },
    [token, pokalbioId]
  );

  return { conversation: conversation?.pokalbio_id === pokalbioId ? conversation : null, isLoading, sending, error, send, markSeen, refresh };
}

// Naujo pokalbio sukūrimas - atskira funkcija, NE hook'as, nes kviečiama VIENKARTINIO veiksmo metu (naujo pokalbio formoje), ne komponento viso gyvavimo metu.
export async function createConversation(
  token: string,
  payload: { tema: string; kategorija: string; pranesimas: string; rezervacijos_id?: number }
): Promise<ConversationDetail> {
  const res = await fetch(`${API}/api/v1/customer/support/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(body, "Nepavyko sukurti pokalbio"));
  }
  return res.json();
}
