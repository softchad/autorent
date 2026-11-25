// UI pusės logika: iš serverio grąžinto etapo sudaro laiko juostos žingsnius.
// Kuris veiksmas leidžiamas, sprendžia serveris (reservation_lifecycle.py) – čia tik vaizdavimas.
import { CustomerReservation } from '@/api/types';
import { lt } from '@/i18n/lt';
import { formatDateShort, formatMoney } from '@/utils/format';

export type StepState = 'done' | 'current' | 'upcoming' | 'failed';

export type TimelineStep = {
  key: string;
  label: string;
  state: StepState;
  // Papildoma eilutė po žingsniu, pvz. atšaukimo mokestis.
  detail?: string;
};

// Paėmimo valanda, kai klientas jos nepasirinko (svetainėje sukurta rezervacija).
const DEFAULT_PICKUP_HOUR = 12;
const RETURN_BY_HOUR = 10;

// Įprastas kelias: sukurta → patvirtinta → paėmimas → grąžinimas.
function normalPath(reservation: CustomerReservation, states: StepState[]): TimelineStep[] {
  const hour = reservation.paemimo_valanda ?? DEFAULT_PICKUP_HOUR;
  const pending = reservation.etapas === 'laukia_patvirtinimo';
  const labels = [
    lt.timeline.created,
    pending ? lt.timeline.awaiting : lt.timeline.confirmed,
    reservation.etapas === 'nuomos_laikas' || reservation.etapas === 'pasibaigusi'
      ? lt.timeline.ongoing
      : lt.timeline.pickup(formatDateShort(reservation.rezervacijos_pradzia), hour),
    reservation.etapas === 'pasibaigusi'
      ? lt.timeline.finished
      : lt.timeline.returnBy(formatDateShort(reservation.rezervacijos_pabaiga), RETURN_BY_HOUR),
  ];
  const keys = ['created', 'confirmed', 'pickup', 'return'];
  return keys.map((key, index) => ({ key, label: labels[index], state: states[index] }));
}

function cancelledLabel(reservation: CustomerReservation): string {
  if (reservation.atsaukimo_tipas === 'klientas') return lt.timeline.cancelledByCustomer;
  if (reservation.atsaukimo_tipas === 'darbuotojas') return lt.timeline.cancelledByStaff;
  return lt.timeline.cancelled;
}

function cancelledDetail(reservation: CustomerReservation): string | undefined {
  if (reservation.atsaukimo_mokestis === null) {
    return undefined;
  }
  return reservation.atsaukimo_mokestis > 0
    ? lt.timeline.feeApplied(formatMoney(reservation.atsaukimo_mokestis))
    : lt.timeline.noFee;
}

export function buildTimeline(reservation: CustomerReservation): TimelineStep[] {
  const created: TimelineStep = { key: 'created', label: lt.timeline.created, state: 'done' };

  switch (reservation.etapas) {
    case 'laukia_patvirtinimo':
      return normalPath(reservation, ['done', 'current', 'upcoming', 'upcoming']);
    case 'patvirtinta':
      return normalPath(reservation, ['done', 'done', 'current', 'upcoming']);
    case 'nuomos_laikas':
      return normalPath(reservation, ['done', 'done', 'current', 'upcoming']);
    case 'pasibaigusi':
      return normalPath(reservation, ['done', 'done', 'done', 'done']);
    case 'isnuomota':
      return [
        created,
        { key: 'confirmed', label: lt.timeline.confirmed, state: 'done' },
        { key: 'rented', label: lt.timeline.rented, state: 'current' },
      ];
    case 'nepatvirtinta_laiku':
      return [created, { key: 'not-confirmed', label: lt.timeline.notConfirmed, state: 'failed' }];
    case 'atsaukta':
      return [
        created,
        { key: 'cancelled', label: cancelledLabel(reservation), state: 'failed', detail: cancelledDetail(reservation) },
      ];
    default:
      // Nežinomas etapas (naujesnė serverio versija) – rodome bent tai, kas tikrai įvyko.
      return [created];
  }
}

// Žingsnio aprašas ekrano skaitytuvui: „Patvirtinta, atlikta“.
export function stepAccessibilityLabel(step: TimelineStep): string {
  const parts = [step.label, lt.timeline.state[step.state]];
  if (step.detail) {
    parts.push(step.detail);
  }
  return parts.join(', ');
}
