import { clockOffsetMs, remainingMs, remainingSeconds, timerPhase, timerProgress } from './holdTimer';

const SERVER_NOW = '2026-11-28T09:00:00Z';
const EXPIRES = '2026-11-28T09:10:00Z';
const serverMs = Date.parse(SERVER_NOW);

describe('clockOffsetMs', () => {
  it('tikslus telefono laikrodis → 0', () => {
    expect(clockOffsetMs(SERVER_NOW, serverMs)).toBe(0);
  });

  it('telefonas atsilieka 3 minutėmis → +180 s', () => {
    expect(clockOffsetMs(SERVER_NOW, serverMs - 180_000)).toBe(180_000);
  });

  it('telefonas skuba → neigiama pataisa', () => {
    expect(clockOffsetMs(SERVER_NOW, serverMs + 60_000)).toBe(-60_000);
  });

  it('sugadintas serverio laikas → pataisos nėra', () => {
    expect(clockOffsetMs('ne-laikas', serverMs)).toBe(0);
  });
});

describe('remainingMs', () => {
  it('ką tik sukurtam laikymui lieka 10 minučių', () => {
    expect(remainingMs(EXPIRES, serverMs, 0)).toBe(600_000);
  });

  it('rezultatas nepriklauso nuo to, kiek klysta telefono laikrodis', () => {
    for (const drift of [-3_600_000, -180_000, 0, 180_000, 86_400_000]) {
      const deviceNow = serverMs + drift;
      const offset = clockOffsetMs(SERVER_NOW, deviceNow);
      // Praėjus 4 minutėms tikro laiko:
      expect(remainingMs(EXPIRES, deviceNow + 240_000, offset)).toBe(360_000);
    }
  });

  it('po pabaigos lieka 0, ne neigiamas skaičius', () => {
    expect(remainingMs(EXPIRES, serverMs + 700_000, 0)).toBe(0);
  });

  it('po 7 minučių perskaičiavus rodo 3 minutes', () => {
    expect(remainingMs(EXPIRES, serverMs + 420_000, 0)).toBe(180_000);
  });

  it('sugadinta pabaigos data laikoma pasibaigusia', () => {
    expect(remainingMs('???', serverMs, 0)).toBe(0);
  });
});

describe('timerProgress', () => {
  it.each([
    [600_000, 600_000, 1],
    [300_000, 600_000, 0.5],
    [0, 600_000, 0],
    [700_000, 600_000, 1],
    [-5, 600_000, 0],
    [100, 0, 0],
  ])('remaining %i iš %i → %f', (remaining, total, expected) => {
    expect(timerProgress(remaining, total)).toBe(expected);
  });
});

describe('timerPhase', () => {
  it.each([
    [600_000, 'normal'],
    [120_001, 'normal'],
    [120_000, 'warning'],
    [30_001, 'warning'],
    [30_000, 'critical'],
    [1, 'critical'],
    [0, 'expired'],
  ])('%i ms → %s', (remaining, phase) => {
    expect(timerPhase(remaining)).toBe(phase);
  });
});

describe('remainingSeconds', () => {
  it('apvalina į viršų', () => {
    expect(remainingSeconds(600_000)).toBe(600);
    expect(remainingSeconds(1)).toBe(1);
    expect(remainingSeconds(59_001)).toBe(60);
    expect(remainingSeconds(0)).toBe(0);
  });
});
