// UI pusės logika: kiek laiko liko iki laikymo pabaigos. Laikymą nutraukia serveris (hold_service.py),
// programėlė tik parodo likusį laiką, pataisytą pagal telefono ir serverio laikrodžių skirtumą atsakymo gavimo metu.

// Kiek telefono laikrodis atsilieka nuo serverio (teigiama – telefonas atsilieka).
// serverTimeIso – serverio laikas iš atsakymo, deviceNowMs – telefono laikas, kai atsakymas gautas.
export function clockOffsetMs(serverTimeIso: string, deviceNowMs: number): number {
  const serverMs = Date.parse(serverTimeIso);
  if (Number.isNaN(serverMs)) {
    return 0;
  }
  return serverMs - deviceNowMs;
}

// Likęs laikas kaskart skaičiuojamas iš serverio nurodytos pabaigos ir pataisyto telefono laiko, o ne mažinant skaitiklį.
// Pataisa nekompensuoja tinklo delsos ir telefono laikrodžio pakeitimo po paskutinio serverio atsakymo.
export function remainingMs(expiresAtIso: string, deviceNowMs: number, offsetMs: number): number {
  const expiresMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresMs)) {
    return 0;
  }
  return Math.max(0, expiresMs - (deviceNowMs + offsetMs));
}

// Žiedo užpildymas nuo 1 (ką tik sukurta) iki 0 (baigėsi).
export function timerProgress(remaining: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, remaining / total));
}

export type TimerPhase = 'normal' | 'warning' | 'critical' | 'expired';

export const WARNING_BELOW_MS = 120_000;
export const CRITICAL_BELOW_MS = 30_000;

export function timerPhase(remaining: number): TimerPhase {
  if (remaining <= 0) return 'expired';
  if (remaining <= CRITICAL_BELOW_MS) return 'critical';
  if (remaining <= WARNING_BELOW_MS) return 'warning';
  return 'normal';
}

// Rodoma sekundėmis apvalinant į viršų: kol liko nors dalis sekundės, laikmatis nerodo 00:00.
export function remainingSeconds(remaining: number): number {
  return Math.ceil(remaining / 1000);
}
