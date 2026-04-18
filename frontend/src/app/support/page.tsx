"use client";

import { useState, useMemo } from "react";
import DataTable from "@/app/components/DataTable";
import { useSupportData } from "@/hooks/useSupportData";
import { useClientsData } from "@/hooks/useClientsData";

export default function SupportPage() {
  const { supports, isLoading, answer } = useSupportData();
  const { clients } = useClientsData();

  const clientMap = useMemo(
    () =>
      new Map(
        clients.map((c: any) => [c.kliento_id, `${c.vardas} ${c.pavarde}`])
      ),
    [clients]
  );

  const getClientName = (id: number) => clientMap.get(id) ?? `#${id}`;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "visi" | "neatsakyta" | "atsakyta"
  >("visi");
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [sendingId, setSendingId] = useState<number | null>(null);

  const filtered = supports.filter((u: any) => {
    const target = `${getClientName(u.kliento_id)} ${u.tema}`.toLowerCase();
    const matchSearch = target.includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "visi" ||
      (statusFilter === "neatsakyta" && !u.atsakymas) ||
      (statusFilter === "atsakyta" && !!u.atsakymas);
    return matchSearch && matchStatus;
  });

  const columns = [
    { label: "Klientas", accessor: (u: any) => getClientName(u.kliento_id) },
    { label: "Tema", accessor: "tema" },
    {
      label: "Pateikta",
      accessor: (u: any) => new Date(u.pateikimo_data).toLocaleString("lt-LT"),
    },
    { label: "Pranešimas", accessor: "pranesimas" },
    {
      label: "Atsakymas",
      accessor: (u: any) => {
        if (u.atsakymas && activeReplyId !== u.uzklausos_id) {
          return (
            <div className="flex flex-col">
              <p>{u.atsakymas}</p>
              <button
                className="text-sm text-[#0F597B] hover:underline w-max mt-1"
                onClick={() => {
                  setActiveReplyId(u.uzklausos_id);
                  setResponses((prev) => ({
                    ...prev,
                    [u.uzklausos_id]: u.atsakymas,
                  }));
                }}
              >
                Redaguoti
              </button>
            </div>
          );
        }

        if (activeReplyId !== u.uzklausos_id) {
          return (
            <button
              onClick={() => setActiveReplyId(u.uzklausos_id)}
              className="bg-[#0F597B]  hover:bg-[#0C374D] text-[#F7F7F7]  px-4 py-1 rounded text-sm"
            >
              Atsakyti
            </button>
          );
        }

        return (
          <div className="flex flex-col gap-2">
            <textarea
              className="border rounded p-2 w-full"
              rows={2}
              placeholder="Įveskite atsakymą..."
              value={responses[u.uzklausos_id] || ""}
              onChange={(e) =>
                setResponses((prev) => ({
                  ...prev,
                  [u.uzklausos_id]: e.target.value,
                }))
              }
            />
            <div className="flex gap-2">
              <button
                className="bg-[#0F597B] hover:bg-[#0C374D] text-[#F7F7F7]  px-4 py-1 rounded text-sm"
                disabled={sendingId === u.uzklausos_id}
                onClick={async () => {
                  const text = responses[u.uzklausos_id]?.trim();
                  if (!text) return;
                  setSendingId(u.uzklausos_id);
                  await answer(u.uzklausos_id, text);
                  setResponses((prev) => ({ ...prev, [u.uzklausos_id]: "" }));
                  setActiveReplyId(null);
                  setSendingId(null);
                }}
              >
                {sendingId === u.uzklausos_id ? "Siunčiama..." : "Siųsti"}
              </button>
              <button
                className="text-sm text-gray-500 hover:underline"
                onClick={() => {
                  setActiveReplyId(null);
                  setResponses((prev) => ({
                    ...prev,
                    [u.uzklausos_id]: "",
                  }));
                }}
              >
                Atšaukti
              </button>
            </div>
          </div>
        );
      },
    },
    {
      label: "Atsakyta",
      accessor: (u: any) =>
        u.atsakymo_data
          ? new Date(u.atsakymo_data).toLocaleString("lt-LT")
          : "—",
    },
  ];

  return (
    <div className="text-[#707070]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">
          Pagalbos užklausos
        </h1>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-[#707070]">
        <input
          type="text"
          placeholder="Ieškoti..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <select
          className="border p-2 rounded"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "visi" | "neatsakyta" | "atsakyta"
            )
          }
        >
          <option value="visi">Visos</option>
          <option value="neatsakyta">Neatsakytos</option>
          <option value="atsakyta">Atsakytos</option>
        </select>
      </div>

      {isLoading ? (
        <p>Kraunama...</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(u) => u.uzklausos_id}
        />
      )}
    </div>
  );
}
