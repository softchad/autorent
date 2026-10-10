"use client";

import {
  FiTruck,
  FiTool,
  FiCreditCard,
  FiAlertCircle,
  FiCornerDownLeft,
  FiInbox,
} from "react-icons/fi";
import Link from "next/link";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { ActionButtons } from "@/app/components/ActionButtons";
import DataTable from "@/app/components/DataTable";
import StatCard from "@/app/components/StatCard";
import BarChartBox from "@/app/components/BarChartBox";
import PieChartBox from "@/app/components/PieChartBox";
import LoadingScreen from "@/app/components/LoadingScreen";
import EntityModal, { FieldConfig } from "@/app/components/modals/EntityModal";
import { useUpdateReservationMutation } from "@/store/carRentalApi";
import StatusBadge from "@/app/components/StatusBadge";
import React, { useState } from "react";

type Reservation = ReturnType<
  typeof useDashboardStats
>["latestReservations"][number];

export default function DashboardPage() {
  const {
    latestReservations,
    latestSupportRequests,
    barData,
    pieData,
    laisvi,
    servise,
    neapmoketosSaskaitos,
    neatsakytosUzklausos,
    siandienGrązinimai,
    getAutomobilis,
    getKlientas,
    isLoading,
    refetchReservations,
  } = useDashboardStats();

  const [selected, setSelected] = useState<Reservation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updateReservation] = useUpdateReservationMutation();

  const reservationFields: FieldConfig<Reservation>[] = [
    { name: "rezervacijos_pradzia", label: "Pradžia", type: "text" },
    { name: "rezervacijos_pabaiga", label: "Pabaiga", type: "text" },
    {
      name: "busena",
      label: "Būsena",
      type: "select",
      options: [
        { value: "patvirtinta", label: "Patvirtinta" },
        { value: "laukia", label: "Laukia" },
        { value: "atšaukta", label: "Atšaukta" },
      ],
    },
  ];

  const columns = [
    {
      label: "Automobilis",
      accessor: (r: Reservation) => getAutomobilis(r.automobilio_id),
    },
    {
      label: "Klientas",
      accessor: (r: Reservation) => getKlientas(r.kliento_id),
    },
    { label: "Pradžia", accessor: "rezervacijos_pradzia" },
    { label: "Pabaiga", accessor: "rezervacijos_pabaiga" },
    {
      label: "Būsena",
      accessor: (r: Reservation) => <StatusBadge status={r.busena} />,
    },
    {
      label: "Veiksmai",
      accessor: (r: Reservation) => (
        <ActionButtons
          onEdit={() => {
            setSelected(r);
            setModalOpen(true);
          }}
          show={{ edit: true }}
        />
      ),
    },
  ];

  const handleSave = async (updated: Reservation) => {
    await updateReservation({
      rezervacijosId: selected!.rezervacijos_id,
      reservationUpdate: {
        rezervacijos_pradzia: updated.rezervacijos_pradzia,
        rezervacijos_pabaiga: updated.rezervacijos_pabaiga,
        busena: updated.busena,
      },
    }).unwrap();

    setModalOpen(false);
    setSelected(null);
    refetchReservations();
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-[#F7F7F7] ">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard
          color="bg-[#163858]"
          title="Laisvi automobiliai"
          value={laisvi}
          icon={<FiTruck />}
        />
        <StatCard
          color="bg-[#3D3F5A]"
          title="Servise esantys automobiliai"
          value={servise}
          icon={<FiTool />}
        />
        <StatCard
          color="bg-[#5B2C3A]"
          title="Neapmokėtos sąskaitos"
          value={neapmoketosSaskaitos}
          icon={<FiCreditCard />}
        />
        <StatCard
          color="bg-[#533D52]"
          title="Neatsakytos užklausos"
          value={neatsakytosUzklausos}
          icon={<FiAlertCircle />}
        />
        <StatCard
          color="bg-[#12344D]"
          title="Grąžinimai šiandien"
          value={siandienGrązinimai}
          icon={<FiCornerDownLeft />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 ">
        <BarChartBox title="Užsakymai pagal būsenas" data={barData} valueLabel="Užsakymų skaičius" />
        <PieChartBox title="Automobilių statusai" data={pieData} valueLabel="Automobilių skaičius" />
      </div>

      <div className="rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#F7F7F7]">Naujausios pagalbos užklausos</h2>
          <Link href="/support" className="text-sm text-[#4BAFD4] hover:underline">
            Visos užklausos
          </Link>
        </div>

        {latestSupportRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FiInbox className="text-2xl text-[#3D4F63]" />
            <p className="text-sm text-[#8899AA]">Neatsakytų užklausų nėra.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {latestSupportRequests.map((p) => (
              <Link
                key={p.pokalbio_id}
                href="/support"
                className="flex items-center justify-between gap-3 rounded-xl border border-[#1C2B3A] bg-[#0E0B1F] p-3 transition hover:border-[#0F597B]/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F7F7F7]">{p.kliento_vardas}</p>
                  <p className="truncate text-xs text-[#8899AA]">{p.tema}</p>
                </div>
                <span className="shrink-0 text-xs text-[#707070]">
                  {new Date(p.atnaujinimo_data).toLocaleString("lt-LT", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray">
        <h2 className="text-lg font-bold mb-4 text-[#F7F7F7] ">
          Naujausios rezervacijos
        </h2>
        <DataTable<Reservation>
          columns={columns}
          data={latestReservations}
          rowKey={(r) => r.rezervacijos_id}
          itemsPerPage={10}
        />
      </div>

      {selected && (
        <EntityModal
          title={`Redaguoti rezervaciją #${selected.rezervacijos_id}`}
          entity={selected}
          fields={reservationFields}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={handleSave}
          startInEdit
        />
      )}
    </div>
  );
}
