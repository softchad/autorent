"use client";

import { useEffect, useState } from "react";
import { FiArrowLeft, FiSend, FiPlus, FiInbox, FiCheckCircle } from "react-icons/fi";
import {
  useConversationList,
  useConversation,
  createConversation,
  Conversation,
} from "@/hooks/useCustomerConversations";
import { useCustomerReservations } from "@/hooks/useCustomerReservations";

const KATEGORIJOS: { value: string; label: string }[] = [
  { value: "rezervacija", label: "Rezervacija" },
  { value: "atsiemimas_grazinimas", label: "Atsiėmimas / grąžinimas" },
  { value: "automobilis", label: "Automobilio problema" },
  { value: "saskaita", label: "Sąskaita / mokėjimas" },
  { value: "paskyra", label: "Paskyra" },
  { value: "kita", label: "Kita" },
];

const BUSENA_INFO: Record<string, { label: string; className: string }> = {
  atvira: { label: "Laukiame darbuotojo atsakymo", className: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
  sprendziama: { label: "Sprendžiame jūsų klausimą", className: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
  laukiama_kliento: { label: "Laukiame jūsų atsakymo", className: "bg-amber-900/40 text-amber-300 border-amber-700/40" },
  isspresta: { label: "Išspręsta", className: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" },
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("lt-LT", { dateStyle: "short", timeStyle: "short" });
}

function StatusPill({ busena }: { busena: string }) {
  const info = BUSENA_INFO[busena] ?? { label: busena, className: "bg-slate-700/40 text-slate-300 border-slate-600/40" };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}

// Vienas realus kliento pokalbių langas - naudojamas ir homepage kompaktiškoje
// vietoje, ir paskyros "Pašto dėžutė" tab'e. Sąrašas -> pokalbis -> (jei reikia)
// naujo pokalbio forma, visada tas pats komponentas ir ta pati duomenų šaltinis.
export default function SupportInbox({
  token,
  compact = false,
  initialPrefill,
}: {
  token: string | null;
  compact?: boolean;
  initialPrefill?: { kategorija: string; tema: string; rezervacijos_id?: number } | null;
}) {
  const { conversations, isLoading, refresh: refreshList } = useConversationList(token);
  const { reservations } = useCustomerReservations(token);
  const [openId, setOpenId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const { conversation, sending, error, send, markSeen } = useConversation(token, openId);

  // Kai atidarome pokalbį ar gauname naują žinutę jame, pažymime paskutinę matytą.
  useEffect(() => {
    if (!conversation) return;
    const last = conversation.zinutes[conversation.zinutes.length - 1];
    if (last) markSeen(last.zinutes_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.zinutes.length]);

  useEffect(() => {
    if (initialPrefill) {
      setComposing(true);
      setOpenId(null);
    }
  }, [initialPrefill]);

  const [draft, setDraft] = useState("");

  const handleSend = async () => {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    const ok = await send(text);
    if (!ok) setDraft(text); // klaidos atveju juodraštis neprarandamas
    refreshList();
  };

  const containerHeight = compact ? "max-h-[480px]" : "";

  if (composing) {
    return (
      <NewConversationForm
        token={token}
        reservations={reservations}
        prefill={initialPrefill}
        onCreated={(convo) => {
          setComposing(false);
          setOpenId(convo.pokalbio_id);
          refreshList();
        }}
        onCancel={() => setComposing(false)}
      />
    );
  }

  if (openId && conversation) {
    return (
      <div className={`flex flex-col ${containerHeight}`}>
        <button
          onClick={() => setOpenId(null)}
          className="mb-3 flex items-center gap-1.5 text-xs text-[#8899AA] hover:text-[#F7F7F7] transition"
        >
          <FiArrowLeft /> Visi pokalbiai
        </button>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[#F7F7F7]">{conversation.tema}</h3>
          <StatusPill busena={conversation.busena} />
        </div>

        {conversation.rezervacija && (
          <p className="mb-3 text-xs text-[#707070]">
            Susieta su: {conversation.rezervacija.marke} {conversation.rezervacija.modelis} (
            {conversation.rezervacija.rezervacijos_pradzia} - {conversation.rezervacija.rezervacijos_pabaiga})
          </p>
        )}

        <div className={`mb-3 flex-1 space-y-3 overflow-y-auto ${compact ? "max-h-64" : "max-h-[420px]"}`}>
          {conversation.zinutes.map((m) => (
            <div
              key={m.zinutes_id}
              className={
                m.autoriaus_tipas === "klientas"
                  ? "ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#0F597B]/20 border border-[#0F597B]/30 p-3"
                  : "mr-auto max-w-[85%] rounded-xl rounded-tl-sm border border-[#1C2B3A] bg-[#0E0B1F] p-3"
              }
            >
              {m.autorius_vardas && <p className="mb-1 text-xs font-semibold text-[#4BAFD4]">{m.autorius_vardas}</p>}
              <p className="whitespace-pre-wrap text-sm text-[#F7F7F7]">{m.tekstas}</p>
              <p className="mt-1 text-[10px] text-[#707070]">{fmt(m.sukurimo_data)}</p>
            </div>
          ))}
        </div>

        {conversation.busena === "isspresta" && (
          <div className="mb-2 rounded-lg border border-emerald-700/30 bg-emerald-900/20 p-2.5">
            {conversation.sprendimo_santrauka && (
              <p className="text-xs text-emerald-300">Sprendimas: {conversation.sprendimo_santrauka}</p>
            )}
            <p className="mt-1 text-[11px] text-[#707070]">
              Jei parašysi naują žinutę, ši byla vėl bus atidaryta.
            </p>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Rašyk žinutę..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-[#1C2B3A] bg-[#1A2238] px-3 py-2 text-sm text-[#F7F7F7] placeholder-[#3D4F63] focus:outline-none focus:border-[#0F597B]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 transition"
          >
            <FiSend /> {sending ? "..." : "Siųsti"}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className={containerHeight}>
      <button
        onClick={() => setComposing(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] text-white text-sm font-semibold py-2.5 transition"
      >
        <FiPlus /> Naujas pokalbis
      </button>

      {isLoading && <p className="text-sm text-[#8899AA]">Kraunama...</p>}

      {!isLoading && conversations.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FiInbox className="text-2xl text-[#3D4F63]" />
          <p className="text-sm text-[#8899AA]">Pokalbių dar nėra.</p>
        </div>
      )}

      {!isLoading && conversations.length > 0 && (
        <div className={`space-y-2 ${compact ? "max-h-96 overflow-y-auto" : ""}`}>
          {conversations.map((c: Conversation) => (
            <button
              key={c.pokalbio_id}
              onClick={() => setOpenId(c.pokalbio_id)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#1C2B3A] bg-[#0E0B1F] p-3.5 text-left hover:border-[#0F597B]/40 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {c.neperskaityta && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4BAFD4]" />}
                  <p className="truncate text-sm font-semibold text-[#F7F7F7]">{c.tema}</p>
                </div>
                {c.paskutine_zinute && (
                  <p className="mt-0.5 truncate text-xs text-[#8899AA]">
                    {c.paskutine_zinute_autorius === "darbuotojas" ? "AutoRent: " : "Jūs: "}
                    {c.paskutine_zinute}
                  </p>
                )}
              </div>
              <StatusPill busena={c.busena} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewConversationForm({
  token,
  reservations,
  prefill,
  onCreated,
  onCancel,
}: {
  token: string | null;
  reservations: { rezervacijos_id: number; marke: string; modelis: string; rezervacijos_pradzia: string }[];
  prefill?: { kategorija: string; tema: string; rezervacijos_id?: number } | null;
  onCreated: (convo: { pokalbio_id: number }) => void;
  onCancel: () => void;
}) {
  const [kategorija, setKategorija] = useState(prefill?.kategorija ?? "kita");
  const [tema, setTema] = useState(prefill?.tema ?? "");
  const [rezervacijosId, setRezervacijosId] = useState<number | "">(prefill?.rezervacijos_id ?? "");
  const [pranesimas, setPranesimas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const convo = await createConversation(token, {
        tema: tema.trim(),
        kategorija,
        pranesimas: pranesimas.trim(),
        rezervacijos_id: rezervacijosId === "" ? undefined : rezervacijosId,
      });
      onCreated(convo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko sukurti pokalbio");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs text-[#8899AA] hover:text-[#F7F7F7] transition"
      >
        <FiArrowLeft /> Atgal
      </button>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8899AA]">Sritis</label>
        <select
          value={kategorija}
          onChange={(e) => setKategorija(e.target.value)}
          className="w-full rounded-lg border border-[#1C2B3A] bg-[#1A2238] px-3 py-2 text-sm text-[#F7F7F7] focus:outline-none focus:border-[#0F597B]"
        >
          {KATEGORIJOS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {reservations.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8899AA]">
            Susijusi nuoma (nebūtina)
          </label>
          <select
            value={rezervacijosId}
            onChange={(e) => setRezervacijosId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-[#1C2B3A] bg-[#1A2238] px-3 py-2 text-sm text-[#F7F7F7] focus:outline-none focus:border-[#0F597B]"
          >
            <option value="">Nesusieta</option>
            {reservations.map((r) => (
              <option key={r.rezervacijos_id} value={r.rezervacijos_id}>
                {r.marke} {r.modelis} ({r.rezervacijos_pradzia})
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        value={tema}
        onChange={(e) => setTema(e.target.value)}
        placeholder="Trumpa tema"
        required
        minLength={3}
        maxLength={150}
        className="w-full rounded-lg border border-[#1C2B3A] bg-[#1A2238] px-3 py-2 text-sm text-[#F7F7F7] placeholder-[#3D4F63] focus:outline-none focus:border-[#0F597B]"
      />
      <textarea
        value={pranesimas}
        onChange={(e) => setPranesimas(e.target.value)}
        placeholder="Kuo galime padėti?"
        required
        rows={4}
        className="w-full resize-none rounded-lg border border-[#1C2B3A] bg-[#1A2238] px-3 py-2 text-sm text-[#F7F7F7] placeholder-[#3D4F63] focus:outline-none focus:border-[#0F597B]"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition"
      >
        <FiCheckCircle /> {submitting ? "Siunčiama..." : "Siųsti"}
      </button>
    </form>
  );
}
