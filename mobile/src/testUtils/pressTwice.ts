import { act, screen } from '@testing-library/react-native';

// Tik testams.
type FiberLike = { memoizedProps?: { onPress?: unknown }; return: FiberLike | null } | null;

// Du paspaudimai prieš React įsipareigojant būsenos pakeitimą: abu kartus kviečiamas tas pats (senas)
// onPress, todėl antrą sustabdyti gali tik sinchroniška (ref) apsauga. onPress randamas taip pat, kaip
// jį randa RNTL fireEvent (per unstable_fiber), o abu kvietimai vyksta viename act().
export async function pressTwiceBeforeCommit(testID: string): Promise<void> {
  let fiber = (screen.getByTestId(testID) as unknown as { unstable_fiber: FiberLike }).unstable_fiber;
  while (fiber && typeof fiber.memoizedProps?.onPress !== 'function') {
    fiber = fiber.return;
  }
  const onPress = fiber?.memoizedProps?.onPress as (() => void) | undefined;
  if (!onPress) {
    throw new Error(`Nerastas onPress: ${testID}`);
  }
  await act(async () => {
    onPress();
    onPress();
  });
}
