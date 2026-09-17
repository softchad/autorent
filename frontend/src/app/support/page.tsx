"use client";

import { useEffect, useState } from "react";
import { FiSend, FiLock, FiCheckCircle, FiInbox } from "react-icons/fi";
import {
  useStaffConversationList,
  useStaffConversation,
  QueueFilter,
} from "@/hooks/useStaffSupport";

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "needs_reply", label: "Reikia atsakyti" },
  { value: "unassigned", label: "Nepriskirtos" },
  { value: "mine", label: "Mano" },
  { value: "waiting", label: "Laukiame kliento" },
  { value: "resolved", label: "Išspręstos" },
  { value: "all", label: "Visos" },
];

const KATEGORIJA_LABEL: Record<string, string> = {
  rezervacija: "Rezervacija",
  atsiemimas_grazinimas: "Atsiėmimas/grąžinimas",
  automobilis: "Automobilis",
  saskaita: "Sąskaita",
  paskyra: "Paskyra",
  kita: "Kita",
};

const BUSENA_LABEL: Record<string, { label: string; className: string }> = {
  atvira: { label: "Reikia atsakyti", className: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
  sprendziama: { label: "Vykdomas darbas", className: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
  laukiama_kliento: { label: "Laukiame kliento", className: "bg-amber-900/40 text-amber-300 border-amber-700/40" },
  isspresta: { label: "Išspręsta", className: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" },
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("lt-LT", { dateStyle: "short", timeStyle: "short" });
}

function StatusPill({ busena }: { busena: string }) {
  const info = BUSENA_LABEL[busena] ?? { label: busena, className: "bg-slate-700/40 text-slate-300 border-slate-600/40" };
  return (
    <span className={`inline-block shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}

export default function SupportPage() {
  const [filter, setFilter] = useState<QueueFilter>("needs_reply");
  const { conversations, isLoading, refresh: refreshList } = useStaffConversationList(filter);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { conversation, actionError, claim, reply, addNote, resolve, markSeen } = useStaffConversation(selectedId);

  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [santrauka, setSantrauka] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!conversation) return;
    const last = conversation.zinutes[conversation.zinutes.length - 1];
    if (last) markSeen(last.zinutes_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.zinutes.length]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setMode("reply");
    setText("");
    setShowResolve(false);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (mode === "note") {
        await addNote(text.trim());
      } else {
        await reply(text.trim(), "sprendziama");
      }
      setText("");
      refreshList();
    } catch {
      // klaida jau rodoma per actionError, tekstas nedingsta
    } finally {
      setBusy(false);
    }
  };

  const handleWaitForClient = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await reply(text.trim(), "laukiama_kliento");
      setText("");
      refreshList();
    } catch {
      // tekstas išsaugotas laukelyje
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!santrauka.trim()) return;
    setBusy(true);
    try {
      await resolve(santrauka.trim());
      setSantrauka("");
      setShowResolve(false);
      refreshList();
    } catch {
      // klaida rodoma per actionError
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4 text-[#C5CEDA]">
      {/* Eilė */}
      <aside className="flex w-80 shrink-0 flex-col rounded-2xl border border-[#1C2B3A] bg-[#0E1525]">
        <div className="border-b border-[#1C2B3A] p-3">
          <h1 className="mb-2 text-lg font-bold text-[#F7F7F7]">Aptarnavimas</h1>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  filter === f.value ? "bg-[#0F597B] text-white" : "bg-[#1A2238] text-[#8899AA] hover:text-[#F7F7F7]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm text-[#8899AA]">Kraunama...</p>}
          {!isLoading && conversations.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <FiInbox className="text-2xl text-[#3D4F63]" />
              <p className="text-sm text-[#8899AA]">Šioje eilėje bylų nėra.</p>
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.pokalbio_id}
              onClick={() => handleSelect(c.pokalbio_id)}
              className={`block w-full border-b border-[#1C2B3A] p-3 text-left transition hover:bg-[#1A2238] ${
                selectedId === c.pokalbio_id ? "bg-[#1A2238]" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#F7F7F7]">
                  {c.neperskaityta && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4BAFD4]" />}
                  {c.kliento_vardas}
                </span>
                <StatusPill busena={c.busena} />
              </div>
              <p className="truncate text-xs text-[#8899AA]">{c.tema}</p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#3D4F63]">
                <span>{KATEGORIJA_LABEL[c.kategorija] ?? c.kategorija}</span>
                <span>{c.darbuotojo_vardas ? `Priskirta: ${c.darbuotojo_vardas}` : "Nepriskirta"}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Pokalbis */}
      <section className="flex flex-1 flex-col rounded-2xl border border-[#1C2B3A] bg-[#0E1525]">
        {!conversation && (
          <div className="flex flex-1 items-center justify-center text-sm text-[#8899AA]">
            Pasirink bylą kairėje.
          </div>
        )}

        {conversation && (
          <>
            <div className="border-b border-[#1C2B3A] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#F7F7F7]">{conversation.tema}</h2>
                  <p className="text-xs text-[#8899AA]">
                    {conversation.kliento_vardas} &bull; {KATEGORIJA_LABEL[conversation.kategorija] ?? conversation.kategorija}
                    {conversation.rezervacija && (
                      <>
                        {" "}
                        &bull; {conversation.rezervacija.marke} {conversation.rezervacija.modelis} (
                        {conversation.rezervacija.rezervacijos_pradzia} - {conversation.rezervacija.rezervacijos_pabaiga})
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill busena={conversation.busena} />
                  {!conversation.darbuotojo_id && (
                    <button
                      onClick={() => claim()}
                      className="rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] text-white text-xs font-semibold px-3 py-1.5 transition"
                    >
                      Prisiimti
                    </button>
                  )}
                  {conversation.busena !== "isspresta" && (
                    <button
                      onClick={() => setShowResolve((v) => !v)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#1C2B3A] bg-[#1A2238] hover:bg-[#1E2A47] text-[#F7F7F7] text-xs font-semibold px-3 py-1.5 transition"
                    >
                      <FiCheckCircle /> Išspręsta
                    </button>
                  )}
                </div>
              </div>
              {conversation.sprendimo_santrauka && (
                <p className="mt-2 rounded-lg border border-emerald-700/30 bg-emerald-900/20 p-2 text-xs text-emerald-300">
                  Sprendimas: {conversation.sprendimo_santrauka}
                </p>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {/* Žinutės ir vidinės pastabos sujungiamos į VIENĄ chronologinę juostą pagal
                  sukurimo_data - anksčiau tai buvo du atskiri .map() blokai (visos žinutės,
                  tada visos pastabos po jų), todėl pastaba visada "nuslysdavo" žemyn, kai
                  prirašydavai naujų žinučių po jos, vietoj to, kad liktų savo laiko vietoje. */}
              {[
                ...conversation.zinutes.map((m) => ({ ...m, kind: "message" as const, ts: m.sukurimo_data })),
                ...conversation.pastabos.map((n) => ({ ...n, kind: "note" as const, ts: n.sukurimo_data })),
              ]
                .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
                .map((item) =>
                  item.kind === "message" ? (
                    <div
                      key={`m-${item.zinutes_id}`}
                      className={
                        item.autoriaus_tipas === "darbuotojas"
                          ? "ml-auto max-w-[75%] rounded-xl rounded-tr-sm bg-[#0F597B]/20 border border-[#0F597B]/30 p-3"
                          : "mr-auto max-w-[75%] rounded-xl rounded-tl-sm border border-[#1C2B3A] bg-[#0E0B1F] p-3"
                      }
                    >
                      <p className="mb-1 text-xs font-semibold text-[#4BAFD4]">{item.autorius_vardas}</p>
                      <p className="whitespace-pre-wrap text-sm text-[#F7F7F7]">{item.tekstas}</p>
                      <p className="mt-1 text-[10px] text-[#707070]">{fmt(item.sukurimo_data)}</p>
                    </div>
                  ) : (
                    <div
                      key={`n-${item.pastabos_id}`}
                      className="mx-auto max-w-[85%] rounded-xl border border-amber-700/30 bg-amber-900/10 p-3"
                    >
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                        <FiLock /> Klientas nemato - {item.darbuotojo_vardas}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-[#F7F7F7]">{item.tekstas}</p>
                      <p className="mt-1 text-[10px] text-[#707070]">{fmt(item.sukurimo_data)}</p>
                    </div>
                  )
                )}
            </div>

            {showResolve && (
              <div className="border-t border-[#1C2B3A] bg-[#0E0B1F] p-3">
                <p className="mb-1.5 text-xs font-semibold text-[#F7F7F7]">Sprendimo santrauka</p>
                <div className="flex gap-2">
                  <input
                    value={santrauka}
                    onChange={(e) => setSantrauka(e.target.value)}
                    placeholder="Kas buvo sutarta / išspręsta?"
                    className="flex-1 rounded-lg border border-[#1C2B3A] bg-[#1A2238] px-3 py-2 text-sm text-[#F7F7F7] placeholder-[#3D4F63] focus:outline-none focus:border-[#0F597B]"
                  />
                  <button
                    onClick={handleResolve}
                    disabled={busy || !santrauka.trim()}
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold px-4 transition"
                  >
                    Patvirtinti
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-[#1C2B3A] p-3">
              <div className="mb-2 flex gap-1">
                <button
                  onClick={() => setMode("reply")}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    mode === "reply" ? "bg-[#0F597B] text-white" : "bg-[#1A2238] text-[#8899AA] hover:text-[#F7F7F7]"
                  }`}
                >
                  Atsakymas klientui
                </button>
                <button
                  onClick={() => setMode("note")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    mode === "note" ? "bg-amber-700 text-white" : "bg-[#1A2238] text-[#8899AA] hover:text-[#F7F7F7]"
                  }`}
                >
                  <FiLock /> Vidinė pastaba
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={mode === "note" ? "Pastaba - klientas nemato..." : "Atsakymas klientui..."}
                  rows={2}
                  className={`flex-1 resize-none rounded-lg border px-3 py-2 text-sm text-[#F7F7F7] placeholder-[#3D4F63] focus:outline-none ${
                    mode === "note" ? "border-amber-700/40 bg-amber-900/10 focus:border-amber-600" : "border-[#1C2B3A] bg-[#1A2238] focus:border-[#0F597B]"
                  }`}
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={handleSend}
                    disabled={busy || !text.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0F597B] hover:bg-[#0C4A66] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 transition"
                  >
                    <FiSend /> Siųsti
                  </button>
                  {mode === "reply" && (
                    <button
                      onClick={handleWaitForClient}
                      disabled={busy || !text.trim()}
                      className="rounded-lg border border-[#1C2B3A] bg-[#1A2238] hover:bg-[#1E2A47] disabled:opacity-50 text-[#8899AA] text-xs font-medium px-4 py-1.5 transition"
                    >
                      Siųsti ir laukti kliento
                    </button>
                  )}
                </div>
              </div>
              {actionError && <p className="mt-1.5 text-xs text-red-400">{actionError}</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
