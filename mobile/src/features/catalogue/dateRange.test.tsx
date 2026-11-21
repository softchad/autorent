import { fireEvent, render, screen } from '@testing-library/react-native';
import { EMPTY_RANGE, deviceToday, isMonthBefore, monthOf, monthWeeks, pickDay, rangeRole, shiftMonthRef } from './dateRange';
import { DateRangeSheet } from './DateRangeSheet';
import { LocationSheet } from './LocationSheet';

describe('monthWeeks', () => {
  it('2026 m. lapkritis prasideda sekmadienį ir turi 30 dienų', () => {
    const weeks = monthWeeks({ year: 2026, month: 11 });
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('keliamųjų metų vasaris turi 29 dienas', () => {
    expect(monthWeeks({ year: 2028, month: 2 }).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('mėnesių skaičiavimas', () => {
  it('shiftMonthRef pereina per metų ribą', () => {
    expect(shiftMonthRef({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonthRef({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });

  it('monthOf ir isMonthBefore', () => {
    expect(monthOf('2026-10-31')).toEqual({ year: 2026, month: 10 });
    expect(isMonthBefore({ year: 2026, month: 12 }, { year: 2027, month: 1 })).toBe(true);
    expect(isMonthBefore({ year: 2026, month: 12 }, { year: 2026, month: 12 })).toBe(false);
  });

  it('deviceToday grąžina telefono datą ISO formatu', () => {
    expect(deviceToday(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
  });
});

describe('pickDay', () => {
  it('pirmas paspaudimas – pradžia, antras vėlesnis – pabaiga', () => {
    const started = pickDay(EMPTY_RANGE, '2026-11-10');
    expect(started).toEqual({ from: '2026-11-10', to: null });
    expect(pickDay(started, '2026-11-14')).toEqual({ from: '2026-11-10', to: '2026-11-14' });
  });

  it('ankstesnė arba ta pati diena pradeda iš naujo (trumpiausia nuoma – 1 para)', () => {
    const started = { from: '2026-11-10', to: null };
    expect(pickDay(started, '2026-11-08')).toEqual({ from: '2026-11-08', to: null });
    expect(pickDay(started, '2026-11-10')).toEqual({ from: '2026-11-10', to: null });
  });

  it('kai laikotarpis pilnas, naujas paspaudimas pradeda naują', () => {
    expect(pickDay({ from: '2026-11-10', to: '2026-11-14' }, '2026-11-20')).toEqual({ from: '2026-11-20', to: null });
  });
});

describe('rangeRole', () => {
  it('skiria pradžią, pabaigą ir vidurį', () => {
    const range = { from: '2026-11-10', to: '2026-11-14' };
    expect(rangeRole('2026-11-10', range)).toBe('start');
    expect(rangeRole('2026-11-12', range)).toBe('inside');
    expect(rangeRole('2026-11-14', range)).toBe('end');
    expect(rangeRole('2026-11-15', range)).toBe('none');
  });
});

describe('DateRangeSheet', () => {
  const TODAY = '2026-11-05';

  function renderSheet(overrides = {}) {
    const props = { visible: true, range: EMPTY_RANGE, today: TODAY, onConfirm: jest.fn(), onClose: jest.fn(), ...overrides };
    return { props, view: render(<DateRangeSheet {...props} />) };
  }

  it('rodo mėnesį ir lietuviškas savaitės dienas', async () => {
    await renderSheet().view;
    expect(screen.getByTestId('dates-month')).toHaveTextContent('lapkritis 2026');
    for (const name of ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk']) {
      expect(screen.getByText(name, { includeHiddenElements: true })).toBeTruthy();
    }
  });

  it('patvirtinti galima tik pasirinkus abi datas', async () => {
    const { props, view } = renderSheet();
    await view;
    await fireEvent.press(screen.getByTestId('dates-confirm'));
    expect(props.onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('date-2026-11-10'));
    expect(screen.getByTestId('dates-summary')).toHaveTextContent('Pasirinkite grąžinimo dieną');
    await fireEvent.press(screen.getByTestId('date-2026-11-14'));
    expect(screen.getByTestId('dates-summary')).toHaveTextContent('lapkričio 10 d. – lapkričio 14 d.');
    await fireEvent.press(screen.getByRole('button', { name: 'Patvirtinti datas' }));
    expect(props.onConfirm).toHaveBeenCalledWith({ from: '2026-11-10', to: '2026-11-14' });
  });

  it('praėjusių dienų pasirinkti negalima', async () => {
    await renderSheet().view;
    const past = screen.getByTestId('date-2026-11-04');
    expect(past.props.accessibilityState).toEqual({ selected: false, disabled: true });
    await fireEvent.press(past);
    expect(screen.getByTestId('dates-summary')).toHaveTextContent('Pasirinkite paėmimo dieną');
  });

  it('pasirinktos dienos ekrano skaitytuvui pasako savo vaidmenį', async () => {
    await renderSheet({ range: { from: '2026-11-10', to: '2026-11-14' } }).view;
    expect(screen.getByLabelText('2026 m. lapkričio 10 d., paėmimo diena')).toBeTruthy();
    expect(screen.getByLabelText('2026 m. lapkričio 14 d., grąžinimo diena')).toBeTruthy();
    expect(screen.getByLabelText('2026 m. lapkričio 12 d., pasirinktame laikotarpyje')).toBeTruthy();
  });

  it('į kitą mėnesį pereiti galima, į praėjusį – ne', async () => {
    await renderSheet().view;
    await fireEvent.press(screen.getByRole('button', { name: 'Ankstesnis mėnuo' }));
    expect(screen.getByTestId('dates-month')).toHaveTextContent('lapkritis 2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Kitas mėnuo' }));
    expect(screen.getByTestId('dates-month')).toHaveTextContent('gruodis 2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Ankstesnis mėnuo' }));
    expect(screen.getByTestId('dates-month')).toHaveTextContent('lapkritis 2026');
  });

  it('uždarius be patvirtinimo pasirinkimas nepritaikomas', async () => {
    const { props, view } = renderSheet();
    await view;
    await fireEvent.press(screen.getByTestId('date-2026-11-10'));
    await fireEvent.press(screen.getByRole('button', { name: 'Uždaryti' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('tėvui persipiešus su tomis pačiomis datomis naujame objekte, juodraštis ir mėnuo išlieka', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { rerender } = await render(
      <DateRangeSheet visible range={{ from: null, to: null }} today={TODAY} onConfirm={onConfirm} onClose={onClose} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Kitas mėnuo' }));
    await fireEvent.press(screen.getByTestId('date-2026-12-03'));
    expect(screen.getByTestId('dates-summary')).toHaveTextContent('Pasirinkite grąžinimo dieną');

    // Naujas objektas, tos pačios reikšmės – kaip CatalogueView kiekviename atvaizdavime.
    await rerender(<DateRangeSheet visible range={{ from: null, to: null }} today={TODAY} onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByTestId('dates-month')).toHaveTextContent('gruodis 2026');
    expect(screen.getByTestId('dates-summary')).toHaveTextContent('Pasirinkite grąžinimo dieną');
    expect(screen.getByLabelText('2026 m. gruodžio 3 d., paėmimo diena')).toBeTruthy();
  });

  it('pakartotinai atidarius juodraštis ir mėnuo pradedami nuo pritaikyto laikotarpio', async () => {
    const applied = { from: '2026-11-10', to: '2026-11-14' };
    const props = { today: TODAY, onConfirm: jest.fn(), onClose: jest.fn() };
    const { rerender } = await render(<DateRangeSheet visible range={applied} {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Kitas mėnuo' }));
    await fireEvent.press(screen.getByTestId('date-2026-12-03'));

    // Uždaryta be patvirtinimo ir vėl atidaryta.
    await rerender(<DateRangeSheet visible={false} range={{ ...applied }} {...props} />);
    await rerender(<DateRangeSheet visible range={{ ...applied }} {...props} />);

    expect(screen.getByTestId('dates-month')).toHaveTextContent('lapkritis 2026');
    expect(screen.getByTestId('dates-summary')).toHaveTextContent('lapkričio 10 d. – lapkričio 14 d.');
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

describe('LocationSheet', () => {
  const LOCATIONS = [
    { vietos_id: 1, pavadinimas: 'Vilnius Centras', adresas: 'Gedimino pr. 1, Vilnius', miestas: 'Vilnius' },
    { vietos_id: 2, pavadinimas: 'Kaunas Centras', adresas: 'Laisvės al. 10, Kaunas', miestas: 'Kaunas' },
  ];

  it('rodo „Visi padaliniai“ ir realius padalinius su adresais', async () => {
    await render(<LocationSheet visible locations={LOCATIONS} selectedId={2} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Visi padaliniai' }).props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByRole('radio', { name: 'Vilnius Centras, Gedimino pr. 1, Vilnius' }).props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByRole('radio', { name: 'Kaunas Centras, Laisvės al. 10, Kaunas' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByRole('radio', { name: 'Kaunas Centras, Laisvės al. 10, Kaunas', checked: true })).toBeTruthy();
  });

  it('kai pasirinkta „Visi padaliniai“, pažymėtas tik jis', async () => {
    await render(<LocationSheet visible locations={LOCATIONS} selectedId={null} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Visi padaliniai', checked: true })).toBeTruthy();
    expect(screen.getAllByRole('radio', { checked: false })).toHaveLength(2);
  });

  it('kraunant rodomas krovimas, o ne tuščias sąrašas', async () => {
    await render(<LocationSheet visible locations={[]} status="loading" selectedId={null} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    expect(screen.queryByTestId('error-view')).toBeNull();
  });

  it('nepavykus užkrauti rodoma klaida su pakartojimu, o „Visi padaliniai“ lieka pasirenkami', async () => {
    const onRetry = jest.fn();
    const onSelect = jest.fn();
    await render(
      <LocationSheet visible locations={[]} status="error" onRetry={onRetry} selectedId={null} onSelect={onSelect} onClose={jest.fn()} />,
    );
    expect(screen.getByText('Padalinių sąrašo užkrauti nepavyko.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('location-any'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('pasirinkimas perduodamas ekranui; „Visi padaliniai“ – kaip null', async () => {
    const onSelect = jest.fn();
    await render(<LocationSheet visible locations={LOCATIONS} selectedId={null} onSelect={onSelect} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('location-1'));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    await fireEvent.press(screen.getByTestId('location-any'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
