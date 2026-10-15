import { useMemo } from "react";
import {
  useGetAllCarsQuery,
  useGetAllOrdersQuery,
  useGetAllInvoicesQuery,
  useGetStaffConversationsQuery,
  useGetAllClientsQuery,
  useGetLatestReservationsQuery,
} from "@/store/autorentApi";

// Dashboard'o suvestinės skaičiai - daug mažų, nebrangių užklausų atskirai (ne vienas "dashboard stats" endpoint'as), nes kiekvienas sąrašas jau turi savo cache tarp puslapių (automobiliai/užsakymai/klientai/sąskaitos).
export function useDashboardStats() {
  // Atšauktos NEĮEINA čia - backend'as (GET /reservations/latest) jas atmeta PRIEŠ limit'ą, kitaip dashboard'as rodytų mažiau nei 5 įrašus, kai keletas naujausių būtų atšauktos.
  const {
    data: latestReservations = [],
    isLoading: loadingLatest,
    refetch: refetchReservations,
  } = useGetLatestReservationsQuery({ limit: 5 });

  const { data: automobiliai = [], isLoading: loadingA } = useGetAllCarsQuery();
  const { data: uzsakymai = [], isLoading: loadingU } = useGetAllOrdersQuery();
  const { data: klientai = [], isLoading: loadingK } = useGetAllClientsQuery();
  const { data: saskaitos = [], isLoading: loadingS } = useGetAllInvoicesQuery();
  const { data: pokalbiai = [], isLoading: loadingP } = useGetStaffConversationsQuery({ filter: "needs_reply" });

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

  // "status" čia TIKRAI yra užsakymo būsena (žr. backend invoice.py - sąskaita neturi atskiro apmokėjimo lauko), tad šis skaičius realiai reiškia "sąskaitos, kurių užsakymas dar nebaigtas", ne tikrą apmokėjimo būseną.
  const neapmoketosSaskaitos = saskaitos.filter(
    (s) => s.status !== "užbaigta"
  ).length;
  const neatsakytosUzklausos = pokalbiai.length;
  // Seniausia pirma (tas pats raštas kaip support/page.tsx "needs_reply" eilėje) - kuo ilgiau klientas laukia atsakymo, tuo svarbiau, kad dashboard'e matytųsi pirmas.
  const latestSupportRequests = [...pokalbiai]
    .sort((a, b) => new Date(a.atnaujinimo_data).getTime() - new Date(b.atnaujinimo_data).getTime())
    .slice(0, 5);

  const today = new Date().toISOString().slice(0, 10);
  const siandienGrazinimai = uzsakymai.filter(
    (u) => u.grazinimo_data === today
  ).length;

  // Grafiko duomenys - "name" tiesiog rodomas Recharts legendoje/ašyse, ne kažkoks backend identifikatorius.
  const barData = useMemo(
    () => [
      {
        name: "Vykdomi",
        value: uzsakymai.filter((u) => u.uzsakymo_busena === "vykdoma").length,
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

  // Vardą paieško per automobiliaiMap aukščiau, ne atskira užklausa kiekvienai "pastarosios rezervacijos" eilutei.
  const getAutomobilis = (id: number) => {
    const a = automobiliaiMap.get(id);
    return a ? `${a.marke} ${a.modelis}` : `#${id}`;
  };

  // Tas pats principas kaip getAutomobilis aukščiau, tik klientaiMap.
  const getKlientas = (id: number) => {
    const k = klientaiMap.get(id);
    return k ? `${k.vardas} ${k.pavarde}` : `Klientas #${id}`;
  };

  return {
    latestReservations,
    latestSupportRequests,
    barData,
    pieData,
    laisvi,
    servise,
    neapmoketosSaskaitos,
    neatsakytosUzklausos,
    siandienGrazinimai,
    getAutomobilis,
    getKlientas,
    isLoading,
    refetchReservations,
  };
}
