"use client";

import { useCallback, useEffect, useState } from "react";

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

// Kliento pokalbių hook'ai - naujas pokalbio/žinučių modelis, žr.
// backend app/api/v1/endpoints/customer_support.py.
export function useConversationList(token: string | null) {
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
      setConversations(await res.json());
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

  return { conversations, isLoading, loadError, refresh };
}

export function useConversation(token: string | null, pokalbioId: number | null) {
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
      setConversation(await res.json());
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setError("Nepavyko įkelti pokalbio.");
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
    const interval = setInterval(() => refresh(controller.signal), 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [pokalbioId, refresh]);

  const send = useCallback(
    async (tekstas: string) => {
      if (!token || !pokalbioId) return false;
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
          throw new Error(body?.detail ?? "Nepavyko išsiųsti žinutės");
        }
        setConversation(await res.json());
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepavyko išsiųsti žinutės");
        return false;
      } finally {
        setSending(false);
      }
    },
    [token, pokalbioId]
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

  return { conversation, isLoading, sending, error, send, markSeen, refresh };
}

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
    throw new Error(body?.detail ?? "Nepavyko sukurti pokalbio");
  }
  return res.json();
}
