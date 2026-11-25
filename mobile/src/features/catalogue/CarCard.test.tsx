import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeCar } from '@/testUtils/fixtures';
import { colors } from '@/theme';
import { CarCard, carSummary } from './CarCard';

const FREE = 'Laisvas pasirinktomis dienomis';
const BUSY = 'Užimtas pasirinktomis dienomis';
const BASE_LABEL_START = 'Toyota Corolla, 2022. automatinė · hibridas · 5 vietos · 103 kW. Vilnius';

describe('CarCard – pasiūlymas', () => {
  it('pasiūlymo žyma išsaugo laisvumo būseną ir patenka į prieinamumo etiketę', async () => {
    await render(<CarCard car={makeCar({ laisvas_pasirinktu_laikotarpiu: true })} topPick onPress={jest.fn()} />);
    expect(screen.getByText('Puikus pasiūlymas')).toBeTruthy();
    expect(screen.getByText(FREE)).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityLabel).toContain('Puikus pasiūlymas');
    expect(screen.getByRole('button').props.accessibilityLabel).toContain(FREE);
  });
});

describe('CarCard – laisvumo būsena', () => {
  it('null: ženklelio nėra, etiketėje laisvumo teksto nėra', async () => {
    await render(<CarCard car={makeCar({ laisvas_pasirinktu_laikotarpiu: null })} onPress={jest.fn()} />);
    expect(screen.queryByText(FREE)).toBeNull();
    expect(screen.queryByText(BUSY)).toBeNull();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(`${BASE_LABEL_START}. 45,00 € už parą`);
  });

  it('true: rodomas „Laisvas…“ ženklelis su success tonu ir tas pats tekstas etiketėje', async () => {
    await render(<CarCard car={makeCar({ laisvas_pasirinktu_laikotarpiu: true })} onPress={jest.fn()} />);
    expect(screen.getByText(FREE)).toHaveStyle({ color: colors.success });
    expect(screen.queryByText(BUSY)).toBeNull();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(`${BASE_LABEL_START}. ${FREE}. 45,00 € už parą`);
  });

  it('false: rodomas „Užimtas…“ ženklelis su danger tonu ir tas pats tekstas etiketėje', async () => {
    await render(<CarCard car={makeCar({ laisvas_pasirinktu_laikotarpiu: false })} onPress={jest.fn()} />);
    expect(screen.getByText(BUSY)).toHaveStyle({ color: colors.danger });
    expect(screen.queryByText(FREE)).toBeNull();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(`${BASE_LABEL_START}. ${BUSY}. 45,00 € už parą`);
  });
});

describe('CarCard – be lokacijos', () => {
  it('rodomi tik metai, etiketėje nėra tuščio sakinio ar dvigubos skyrybos', async () => {
    await render(<CarCard car={makeCar({ lokacija: null })} onPress={jest.fn()} />);
    expect(screen.getByText('2022')).toBeTruthy();
    expect(screen.queryByText(/Vilnius/)).toBeNull();

    const label: string = screen.getByRole('button').props.accessibilityLabel;
    expect(label).toBe('Toyota Corolla, 2022. automatinė · hibridas · 5 vietos · 103 kW. 45,00 € už parą');
    expect(label).not.toMatch(/\.\s*\./);
  });

  it('su lokacija žyma rodo metus ir miestą', async () => {
    await render(<CarCard car={makeCar()} onPress={jest.fn()} />);
    expect(screen.getByText('2022 · Vilnius')).toBeTruthy();
  });

  it('turi užuominą, ką daro paspaudimas', async () => {
    await render(<CarCard car={makeCar()} onPress={jest.fn()} />);
    expect(screen.getByRole('button').props.accessibilityHint).toBe('Atidaryti automobilio informaciją');
  });
});

describe('CarCard', () => {
  it('rodo pavadinimą, kainą ir aprašą', async () => {
    await render(<CarCard car={makeCar()} onPress={jest.fn()} />);
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.getByText('45,00 €')).toBeTruthy();
    expect(screen.getByText('automatinė · hibridas · 5 vietos · 103 kW')).toBeTruthy();
  });

  it('visa kortelė yra vienas mygtukas su pilnu aprašu ekrano skaitytuvui', async () => {
    await render(<CarCard car={makeCar()} onPress={jest.fn()} />);
    const card = screen.getByRole('button');
    expect(card.props.accessibilityLabel).toBe(
      'Toyota Corolla, 2022. automatinė · hibridas · 5 vietos · 103 kW. Vilnius. 45,00 € už parą',
    );
  });

  it('paspaudus atidaro automobilį', async () => {
    const onPress = jest.fn();
    await render(<CarCard car={makeCar()} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('car-card-12'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('laisvumo ženklelį rodo tik kai serveris jį grąžino', async () => {
    const { rerender } = await render(<CarCard car={makeCar()} onPress={jest.fn()} />);
    expect(screen.queryByText('Laisvas pasirinktomis dienomis')).toBeNull();
    await rerender(<CarCard car={makeCar({ laisvas_pasirinktu_laikotarpiu: true })} onPress={jest.fn()} />);
    expect(screen.getByText('Laisvas pasirinktomis dienomis')).toBeTruthy();
  });

  it('carSummary sudeda keturias savybes', () => {
    expect(carSummary(makeCar({ pavaru_deze: 'mechaninė', kuro_tipas: 'dyzelinas', sedimos_vietos: 7, galia_kw: 110 }))).toBe(
      'mechaninė · dyzelinas · 7 vietos · 110 kW',
    );
  });
});
