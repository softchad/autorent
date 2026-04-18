import { useMemo } from "react";
import {
  useGetAllCarsQuery,
  useGetAllOrdersQuery,
  useGetAllInvoicesQuery,
  useGetAllSupportsQuery,
  useGetAllClientsQuery,
  useGetAllReservationsQuery,
  useGetLatestReservationsQuery,
} from "@/store/carRentalApi";

export function useDashboardStats() {
  const {
    data: latest = [],
    isLoading: loadingLatest,
    refetch: refetchReservations,
  } = useGetLatestReservationsQuery({ limit: 5 });

  const latestReservations = latest.filter(
    (r) => r.busena?.toLowerCase() !== "atšaukta"
  );

  const { data: automobiliai = [], isLoading: loadingA } = useGetAllCarsQuery();
  const { data: uzsakymai = [], isLoading: loadingU } = useGetAllOrdersQuery();
  const { data: klientai = [], isLoading: loadingK } = useGetAllClientsQuery();
  const { data: saskaitos = [], isLoading: loadingS } = useGetAllInvoicesQuery();
  const { data: pagalbosUzklausos = [], isLoading: loadingP } = useGetAllSupportsQuery();

  const isLoading =
    loadingLatest || loadingA || loadingU || loadingK || loadingS || loadingP;

  const automobiliaiMap = useMemo(
    () => new Map(automobiliai.map((a) => [a.automobilio_id, a])),
    [automobiliai]
  );

  const klientaiMap = useMemo(
    () => new Map(klientai.map((k) => [k.kliento_id, k])),
    [klientai]
  );

  const laisvi = automobiliai.filter(
    (a) => a.automobilio_statusas === "laisvas"
  ).length;
  const servise = automobiliai.filter(
    (a) => a.automobilio_statusas === "servise"
  ).length;
  const isnuomoti = automobiliai.filter(
    (a) => a.automobilio_statusas === "isnuomotas"
  ).length;

  const neapmoketosSaskaitos = saskaitos.filter(
    (s) => s.status === "vėluojanti"
  ).length;
  const neatsakytosUzklausos = pagalbosUzklausos.filter(
    (u) => !u.atsakymas
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const siandienGrązinimai = uzsakymai.filter(
    (u) => u.grazinimo_data === today
  ).length;

  const barData = useMemo(
    () => [
      {
        name: "Vykdomi",
        value: uzsakymai.filter((u) => u.uzsakymo_busena === "vykdomas").length,
      },
      {
        name: "Užbaigti",
        value: uzsakymai.filter((u) => u.uzsakymo_busena === "užbaigta").length,
      },
      {
        name: "Atšaukti",
        value: uzsakymai.filter((u) => u.uzsakymo_busena === "atšaukta").length,
      },
    ],
    [uzsakymai]
  );

  const pieData = [
    { name: "Laisvi", value: laisvi },
    { name: "Servise", value: servise },
    { name: "Išnuomoti", value: isnuomoti },
  ];

  const getAutomobilis = (id: number) => {
    const a = automobiliaiMap.get(id);
    return a ? `${a.marke} ${a.modelis}` : `#${id}`;
  };

  const getKlientas = (id: number) => {
    const k = klientaiMap.get(id);
    return k ? `${k.vardas} ${k.pavarde}` : `Klientas #${id}`;
  };

  return {
    latestReservations,
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
  };
}
