import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Ar telefone įjungtas nustatymas „mažinti judesį“ (WCAG 2.3.3) – tada animacijų nerodome.
//
// Kol nustatymas dar nenuskaitytas (arba jo nepavyko nuskaityti), grąžiname true:
// jautriam žmogui geriau praleisti vieną animaciją, nei ją parodyti per klaidą.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;
    // Jei pasikeitimo įvykis jau atėjo, vėluojantis pradinis atsakymas jo nebeperrašo.
    let changedByEvent = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changedByEvent) setReduced(value);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changedByEvent = true;
      if (active) setReduced(value);
    });

    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
