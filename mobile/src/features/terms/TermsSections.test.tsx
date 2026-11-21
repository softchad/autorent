import { render, screen } from '@testing-library/react-native';
import { TermsSections } from './TermsSections';

const SECTIONS = [
  { kodas: 'draudimas', pavadinimas: 'Draudimas', punktai: ['KASKO išskaita – 500 €.', 'Įskaičiuotas civilinės atsakomybės draudimas.'] },
  { kodas: 'uzsienis', pavadinimas: 'Kelionės į užsienį', punktai: ['Reikia išankstinio sutikimo.'] },
];

describe('TermsSections', () => {
  it('rodo kiekvieną skyrių su visais jo punktais', async () => {
    await render(<TermsSections sections={SECTIONS} />);
    for (const section of SECTIONS) {
      expect(screen.getByRole('header', { name: section.pavadinimas })).toBeTruthy();
      const card = screen.getByTestId(`terms-${section.kodas}`);
      for (const point of section.punktai) {
        expect(card).toHaveTextContent(point, { exact: false });
        expect(screen.getByText(point)).toBeTruthy();
      }
    }
  });

  it('dekoratyvūs punktų ženklai paslėpti nuo ekrano skaitytuvo', async () => {
    await render(<TermsSections sections={SECTIONS} />);
    const totalPoints = SECTIONS.reduce((count, section) => count + section.punktai.length, 0);

    // Ženklai yra ekrane, bet prieinamumo medyje jų nėra.
    const bullets = screen.getAllByText('•', { includeHiddenElements: true });
    expect(bullets).toHaveLength(totalPoints);
    expect(screen.queryAllByText('•')).toHaveLength(0);
    for (const bullet of bullets) {
      expect(bullet.props.importantForAccessibility).toBe('no');
      expect(bullet.props.accessibilityElementsHidden).toBe(true);
    }
  });

  it('be skyrių nerodo jokio turinio', async () => {
    const view = await render(<TermsSections sections={[]} />);
    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.queryAllByText(/./, { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.queryByTestId(/^terms-/)).toBeNull();
    // Lieka tik tuščias konteineris be vaikų.
    expect(view.toJSON()).toMatchObject({ children: [] });
  });
});
