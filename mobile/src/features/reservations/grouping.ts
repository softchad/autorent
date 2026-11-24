import { CustomerReservation, ReservationStage } from '@/api/types';

// Etapai, kuriuose rezervacija dar „gyva“: klientui gali reikėti ką nors daryti arba ruoštis paėmimui.
const CURRENT_STAGES: ReservationStage[] = ['laukia_patvirtinimo', 'patvirtinta', 'nuomos_laikas'];

export function isCurrent(reservation: CustomerReservation): boolean {
  return CURRENT_STAGES.includes(reservation.etapas);
}

export type GroupedReservations = {
  current: CustomerReservation[];
  past: CustomerReservation[];
};

// Esamos – nuo artimiausios paėmimo datos; buvusios – nuo naujausios.
export function groupReservations(reservations: CustomerReservation[]): GroupedReservations {
  const byStart = (first: CustomerReservation, second: CustomerReservation) =>
    first.rezervacijos_pradzia.localeCompare(second.rezervacijos_pradzia) || first.rezervacijos_id - second.rezervacijos_id;

  const current = reservations.filter(isCurrent).sort(byStart);
  const past = reservations.filter((reservation) => !isCurrent(reservation)).sort((first, second) => byStart(second, first));
  return { current, past };
}

// Artimiausia esama rezervacija (rodoma viršuje kaip priminimas); null – jei tokių nėra.
export function nextReservation(reservations: CustomerReservation[]): CustomerReservation | null {
  return groupReservations(reservations).current[0] ?? null;
}
