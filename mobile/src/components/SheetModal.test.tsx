import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { lt } from '@/i18n/lt';
import { SheetModal } from './SheetModal';

const isEnabled = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;

function renderSheet(props: { visible?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? jest.fn();
  const view = render(
    <SheetModal
      visible={props.visible ?? true}
      title="Pasirinkite datas"
      onClose={onClose}
      footer={<Text>Patvirtinti datas</Text>}
      testID="lapas"
      closeTestID="lapas-uzdaryti"
    >
      <Text>Kalendorius</Text>
    </SheetModal>,
  );
  return { onClose, view };
}

// Modal yra tėvinis lapo elementas; jo savybes randame lipdami nuo lapo aukštyn.
function modalProps(): { animationType?: string; onRequestClose?: () => void } {
  let element: { props: Record<string, unknown>; parent: unknown } | null = screen.getByTestId('lapas');
  while (element && !('onRequestClose' in element.props)) {
    element = element.parent as typeof element;
  }
  if (!element) throw new Error('Modal elementas nerastas');
  return element.props as ReturnType<typeof modalProps>;
}

beforeEach(() => {
  isEnabled.mockReset().mockResolvedValue(false);
});

describe('SheetModal rodymas', () => {
  it('visible=false – nieko nerodo', async () => {
    const { view } = renderSheet({ visible: false });
    await view;

    expect(screen.queryByTestId('lapas')).toBeNull();
    expect(screen.queryByText('Kalendorius')).toBeNull();
  });

  it('visible=true – rodo antraštę, turinį ir apatinę juostą', async () => {
    const { view } = renderSheet();
    await view;

    expect(screen.getByRole('header')).toHaveTextContent('Pasirinkite datas');
    expect(screen.getByText('Kalendorius')).toBeTruthy();
    expect(screen.getByText('Patvirtinti datas')).toBeTruthy();
  });
});

describe('SheetModal uždarymas', () => {
  it('uždarymo mygtukas turi pavadinimą ir iškviečia onClose', async () => {
    const { onClose, view } = renderSheet();
    await view;

    await fireEvent.press(screen.getByRole('button', { name: lt.common.close }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('lapas-uzdaryti'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('paspaudus užtamsintą foną lapas uždaromas', async () => {
    const { onClose, view } = renderSheet();
    await view;

    await fireEvent.press(screen.getByTestId('lapas-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fonas ekrano skaitytuvui nėra atskiras mygtukas', async () => {
    const { view } = renderSheet();
    await view;

    const scrim = screen.getByTestId('lapas-scrim');
    expect(scrim.props.accessible).toBe(false);
    expect(scrim.props.importantForAccessibility).toBe('no');
  });

  it('Android atgal mygtukas (onRequestClose) uždaro lapą', async () => {
    const { onClose, view } = renderSheet();
    await view;

    await act(async () => {
      modalProps().onRequestClose?.();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turinio paspaudimas lapo neuždaro', async () => {
    const { onClose, view } = renderSheet();
    await view;

    await fireEvent.press(screen.getByText('Kalendorius'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SheetModal ir sumažintas judesys', () => {
  it('kol nustatymas nenuskaitytas, animacijos nėra', async () => {
    isEnabled.mockReturnValue(new Promise<boolean>(() => {}));
    const { view } = renderSheet();
    await view;

    expect(modalProps().animationType).toBe('none');
  });

  it('judesys sumažintas – be animacijos', async () => {
    isEnabled.mockResolvedValue(true);
    const { view } = renderSheet();
    await view;
    await act(async () => {});

    expect(modalProps().animationType).toBe('none');
  });

  it('judesys nesumažintas – lapas iškyla iš apačios', async () => {
    isEnabled.mockResolvedValue(false);
    const { view } = renderSheet();
    await view;
    await act(async () => {});

    expect(modalProps().animationType).toBe('slide');
  });
});
