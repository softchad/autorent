import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, MIN_TOUCH_SIZE, motion, radius, spacing } from '@/theme';

// Kiek taškų reikia patraukti arba kokiu greičiu, kad lapas pereitų į kitą padėtį.
const DRAG_THRESHOLD = 60;
const VELOCITY_THRESHOLD = 0.6;
// Nuo kiek taškų vertikalaus judesio pradedamas tempimas.
const DRAG_START_DISTANCE = 6;

// Nusprendžia, kurioje padėtyje lapas lieka paleidus pirštą. dy < 0 – tempta aukštyn.
export function resolveSnap(expanded: boolean, dy: number, vy: number): boolean {
  if (dy < -DRAG_THRESHOLD || vy < -VELOCITY_THRESHOLD) {
    return true;
  }
  if (dy > DRAG_THRESHOLD || vy > VELOCITY_THRESHOLD) {
    return false;
  }
  return expanded;
}

// Tempimas pradedamas tik vertikaliu judesiu; horizontalūs braukimai (pvz. antraštėje) lieka kitiems.
export function shouldCaptureDrag(dx: number, dy: number): boolean {
  return Math.abs(dy) > DRAG_START_DISTANCE && Math.abs(dy) > Math.abs(dx);
}

// Lapo padėtis tempiant: 0 – išskleistas, travel – suskleistas; į šias ribas ji ir apkerpama.
export function clampPosition(start: number, dy: number, travel: number): number {
  return Math.min(travel, Math.max(0, start + dy));
}

type Props = {
  // Visada matoma lapo dalis (antraštė); rodoma ir suskleistame lape.
  header: ReactNode;
  // Turinys, kuris matomas išskleidus lapą.
  children: ReactNode;
  collapsedHeight: number;
  expandedHeight: number;
  // Pavadinimai ekrano skaitytuvui: ką padarys rankenėlės paspaudimas.
  expandLabel: string;
  collapseLabel: string;
  // Tarpas nuo ekrano apačios (pvz. virš rezervavimo juostos).
  bottomOffset?: number;
  testID?: string;
};

// Iš apačios ištraukiamas lapas: tempiamas pirštu arba atidaromas rankenėlės paspaudimu.
export function ExpandableSheet({ header, children, collapsedHeight, expandedHeight, expandLabel, collapseLabel, bottomOffset = 0, testID }: Props) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const travel = Math.max(0, expandedHeight - collapsedHeight);
  // translateY: 0 – išskleistas, travel – suskleistas.
  const position = useRef(new Animated.Value(travel)).current;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  // Lapo padėtis tempimo pradžioje ir tempimo numeris (pavėluoti atsakymai iš ankstesnio tempimo ignoruojami).
  const dragStart = useRef<number | null>(null);
  const dragId = useRef(0);

  useEffect(() => {
    const target = expanded ? 0 : travel;
    if (reduced) {
      position.setValue(target);
      return;
    }
    const animation = Animated.timing(position, { toValue: target, duration: motion.sheet, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [expanded, position, reduced, travel]);

  // Grąžina lapą į nurodytą padėtį; įjungus sumažintą judesį – iš karto, be animacijos.
  const settleTo = useCallback(
    (target: number) => {
      if (reducedRef.current) {
        position.setValue(target);
        return;
      }
      Animated.timing(position, { toValue: target, duration: motion.select, useNativeDriver: true }).start();
    },
    [position],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => shouldCaptureDrag(gesture.dx, gesture.dy),
        // Kitas komponentas (pvz. slenkantis tėvas) tempimo neperima.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          // Jei lapas dar juda, tempimas prasideda nuo tikrosios jo padėties, o ne nuo galutinės.
          const id = ++dragId.current;
          dragStart.current = null;
          position.stopAnimation((value) => {
            if (dragId.current === id) dragStart.current = value;
          });
        },
        onPanResponderMove: (_event, gesture) => {
          // Kol tikroji pradžios padėtis nežinoma, lapo nejudiname (kitu įvykiu jis pasivys pirštą).
          if (dragStart.current === null) return;
          position.setValue(clampPosition(dragStart.current, gesture.dy, travel));
        },
        onPanResponderRelease: (_event, gesture) => {
          dragStart.current = null;
          const next = resolveSnap(expandedRef.current, gesture.dy, gesture.vy);
          if (next === expandedRef.current) {
            // Padėtis nepasikeitė – lapas grąžinamas atgal.
            settleTo(next ? 0 : travel);
          }
          setExpanded(next);
        },
        // Gestą nutraukė sistema ar kita sąsaja: lapas grįžta į padėtį, kurioje buvo prieš tempimą.
        onPanResponderTerminate: () => {
          dragStart.current = null;
          dragId.current += 1;
          settleTo(expandedRef.current ? 0 : travel);
        },
      }),
    [position, travel, settleTo],
  );

  return (
    <Animated.View
      style={[styles.sheet, { height: expandedHeight, bottom: bottomOffset, transform: [{ translateY: position }] }]}
      testID={testID}
    >
      <View {...panResponder.panHandlers}>
        {/* Rankenėlė – tempimo alternatyva: paspaudus lapas išsiskleidžia arba susiskleidžia. */}
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? collapseLabel : expandLabel}
          accessibilityState={{ expanded }}
          style={styles.handleArea}
          testID={testID ? `${testID}-handle` : undefined}
        >
          <View style={styles.handle} />
        </Pressable>
        {header}
      </View>
      <ScrollView
        style={[styles.body, !expanded && styles.hiddenBody]}
        contentContainerStyle={styles.bodyContent}
        indicatorStyle="white"
        // Suskleisto lapo turinys nepasiekiamas nei pirštu, nei ekrano skaitytuvu.
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    overflow: 'visible',
  },
  handleArea: { minHeight: MIN_TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  body: { flex: 1 },
  hiddenBody: { opacity: 0 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
});
