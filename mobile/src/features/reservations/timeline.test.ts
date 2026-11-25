import { CustomerReservation, ReservationStage } from '@/api/types';
import { makeReservation } from '@/testUtils/fixtures';
import { buildTimeline, stepAccessibilityLabel } from './timeline';

const states = (reservation: CustomerReservation) => buildTimeline(reservation).map((step) => step.state);
const labels = (reservation: CustomerReservation) => buildTimeline(reservation).map((step) => step.label);

describe('buildTimeline – įprastas kelias', () => {
  it('laukia patvirtinimo', () => {
    const reservation = makeReservation({ etapas: 'laukia_patvirtinimo' });
    expect(states(reservation)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(labels(reservation)).toEqual([
      'Rezervacija sukurta',
      'Laukia darbuotojo patvirtinimo',
      'Paėmimas: gruodžio 1 d., 14:00',
      'Grąžinimas: gruodžio 5 d., iki 10:00',
    ]);
  });

  it('patvirtinta – kitas žingsnis yra paėmimas', () => {
    const reservation = makeReservation({ etapas: 'patvirtinta' });
    expect(states(reservation)).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(labels(reservation)[1]).toBe('Patvirtinta');
  });

  it('nuomos laikas', () => {
    const reservation = makeReservation({ etapas: 'nuomos_laikas' });
    expect(labels(reservation)[2]).toBe('Nuomos laikotarpis prasidėjo');
    expect(states(reservation)).toEqual(['done', 'done', 'current', 'upcoming']);
  });

  it('pasibaigusi – praėjęs laikotarpis nevadinamas įvykusiu paėmimu ar grąžinimu', () => {
    const reservation = makeReservation({ etapas: 'pasibaigusi' });
    expect(states(reservation)).toEqual(['done', 'done', 'done', 'done']);
    expect(labels(reservation)[2]).toBe('Nuomos laikotarpis prasidėjo');
    expect(labels(reservation)[3]).toBe('Nuomos laikotarpis baigėsi');
    expect(stepAccessibilityLabel(buildTimeline(reservation)[2])).toBe('Nuomos laikotarpis prasidėjo, atlikta');
    expect(stepAccessibilityLabel(buildTimeline(reservation)[3])).toBe('Nuomos laikotarpis baigėsi, atlikta');
  });

  it('svetainėje sukurtai rezervacijai (be valandos) rodo 12:00', () => {
    const reservation = makeReservation({ etapas: 'patvirtinta', paemimo_valanda: null });
    expect(labels(reservation)[2]).toBe('Paėmimas: gruodžio 1 d., 12:00');
  });
});

describe('buildTimeline – nutrauktos rezervacijos', () => {
  it('klientas atšaukė nemokamai', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'atsaukta', atsaukimo_tipas: 'klientas', atsaukimo_mokestis: 0 }));
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ label: 'Atšaukėte rezervaciją', state: 'failed', detail: 'Atšaukta nemokamai' });
  });

  it('klientas atšaukė su mokesčiu', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'atsaukta', atsaukimo_tipas: 'klientas', atsaukimo_mokestis: 45 }));
    expect(steps[1].detail).toBe('Atšaukimo mokestis: 45,00 €');
  });

  it('atšaukė darbuotojas – be mokesčio eilutės', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'atsaukta', atsaukimo_tipas: 'darbuotojas' }));
    expect(steps[1].label).toBe('Rezervaciją atšaukė AutoRent');
    expect(steps[1].detail).toBeUndefined();
  });

  it('sena atšaukta rezervacija be priežasties', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'atsaukta', atsaukimo_tipas: null }));
    expect(steps[1].label).toBe('Rezervacija atšaukta');
    expect(steps[1].detail).toBeUndefined();
  });

  it('išnuomota rezervacija nerodoma kaip atšaukta', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'isnuomota', atsaukimo_tipas: 'isnuomota' }));
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'current']);
    expect(steps.some((step) => step.state === 'failed')).toBe(false);
  });

  it('nepatvirtinta laiku', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'nepatvirtinta_laiku' }));
    expect(steps[1]).toMatchObject({ state: 'failed', label: 'Rezervacija nepatvirtinta iki paėmimo dienos' });
  });
});

describe('bendros savybės', () => {
  const ALL: ReservationStage[] = [
    'laukia_patvirtinimo', 'patvirtinta', 'nuomos_laikas', 'pasibaigusi', 'nepatvirtinta_laiku', 'isnuomota', 'atsaukta',
  ];

  it.each(ALL)('etapas %s: pirmas žingsnis „sukurta“, raktai unikalūs, ne daugiau kaip vienas „dabar“', (etapas) => {
    const steps = buildTimeline(makeReservation({ etapas }));
    expect(steps[0]).toMatchObject({ key: 'created', state: 'done' });
    expect(new Set(steps.map((step) => step.key)).size).toBe(steps.length);
    expect(steps.filter((step) => step.state === 'current').length).toBeLessThanOrEqual(1);
  });

  it('nežinomas etapas nesugriauna ekrano', () => {
    const steps = buildTimeline(makeReservation({ etapas: 'naujas_etapas' as ReservationStage }));
    expect(steps).toEqual([{ key: 'created', label: 'Rezervacija sukurta', state: 'done' }]);
  });

  it('stepAccessibilityLabel sujungia pavadinimą, būseną ir detalę', () => {
    expect(stepAccessibilityLabel({ key: 'a', label: 'Patvirtinta', state: 'done' })).toBe('Patvirtinta, atlikta');
    expect(
      stepAccessibilityLabel({ key: 'b', label: 'Atšaukėte rezervaciją', state: 'failed', detail: 'Atšaukta nemokamai' }),
    ).toBe('Atšaukėte rezervaciją, nutraukta, Atšaukta nemokamai');
  });

  it.each([
    ['current', 'dabar'],
    ['upcoming', 'laukia'],
  ] as const)('prieinamumo etiketė perteikia %s būseną', (state, label) => {
    expect(stepAccessibilityLabel({ key: 'pickup', label: 'Paėmimas', state })).toBe(`Paėmimas, ${label}`);
  });

  it('naudoja serverio etapą, o ne iš naujo sprendžia pagal datas ar DB būseną', () => {
    const reservation = makeReservation({
      etapas: 'patvirtinta', busena: 'laukia',
      rezervacijos_pradzia: '2000-12-31', rezervacijos_pabaiga: '2001-01-02',
      paemimo_valanda: 18,
    });
    const original = JSON.parse(JSON.stringify(reservation));
    expect(states(reservation)).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(labels(reservation)[2]).toBe('Paėmimas: gruodžio 31 d., 18:00');
    expect(labels(reservation)[3]).toBe('Grąžinimas: sausio 2 d., iki 10:00');
    expect(reservation).toEqual(original);
  });
});
