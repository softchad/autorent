// Šios funkcijos priima tikras kalendorines datas YYYY-MM-DD formatu (pvz. 2026-02-30 yra klaida).
// Datos nėra paverčiamos į Date objektą, todėl rezultatas nepriklauso nuo įrenginio laiko juostos.

const MONTHS_GENITIVE = [
  'sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
  'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio',
];

// Didžiausia suma, kurią dar galima rodyti su tiksliais centais (toliau skaičiai netenka tikslumo).
const MAX_MONEY = Math.floor(Number.MAX_SAFE_INTEGER / 100);

// Formatuoja jau apskaičiuotą (pvz. serverio) sumą: 1234.5 → '1 234,50 €'.
// Nekeičia kainodaros ar apvalinimo taisyklių; netinkamą arba per didelę sumą atmeta klaida.
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`Netinkama suma: ${amount}`);
  }

  if (Math.abs(amount) > MAX_MONEY) {
    throw new Error(`Per didelė suma: ${amount}`);
  }

  const fixed = Math.abs(amount).toFixed(2);
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // Suapvalinus iki nulio ženklo nerodome („−0,00 €“ netenka prasmės).
  const sign = amount < 0 && Number(fixed) !== 0 ? '−' : '';

  return `${sign}${grouped},${cents} €`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseIsoDate(
  isoDate: string,
): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

  if (!match) {
    throw new Error(`Netinkama data: ${isoDate}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Tikrinama tikra kalendorinė data: mėnuo 1–12, diena pagal mėnesio ilgį ir keliamuosius metus.
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Netinkama data: ${isoDate}`);
  }

  return { year, month, day };
}

// '2026-11-28' → 'lapkričio 28 d.'.
export function formatDateShort(isoDate: string): string {
  const { month, day } = parseIsoDate(isoDate);

  return `${MONTHS_GENITIVE[month - 1]} ${day} d.`;
}

const MONTHS_SHORT = [
  'Sau', 'Vas', 'Kov', 'Bal', 'Geg', 'Bir',
  'Lie', 'Rgp', 'Rgs', 'Spa', 'Lap', 'Gru',
];

// '2026-10-31' → '31 Spa'.
export function formatDateCompact(isoDate: string): string {
  const { month, day } = parseIsoDate(isoDate);

  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

// '2026-11-28' → '2026 m. lapkričio 28 d.'.
export function formatDateLong(isoDate: string): string {
  const { year } = parseIsoDate(isoDate);

  return `${year} m. ${formatDateShort(isoDate)}`;
}

// Tų pačių metų laikotarpis be metų; kai metai skiriasi, abi datos rodomos su metais.
export function formatDateRange(
  fromIso: string,
  toIso: string,
): string {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);

  if (from.year !== to.year) {
    return `${formatDateLong(fromIso)} – ${formatDateLong(toIso)}`;
  }

  return `${formatDateShort(fromIso)} – ${formatDateShort(toIso)}`;
}

// Lietuviškos formos: 1 para, 2 paros, 10 parų, 21 para.
export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;

  if (lastDigit === 1 && lastTwo !== 11) {
    return one;
  }

  if (lastDigit >= 2 && (lastTwo < 10 || lastTwo >= 20)) {
    return few;
  }

  return many;
}

export function formatDays(count: number): string {
  return `${count} ${pluralize(count, 'para', 'paros', 'parų')}`;
}

// 754 sekundės → '12:34'. Baigtinės neigiamos sekundės rodomos kaip 00:00; NaN ir Infinity – klaida.
export function formatCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    throw new Error(`Netinkamas sekundžių skaičius: ${totalSeconds}`);
  }

  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}