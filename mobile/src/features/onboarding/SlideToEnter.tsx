import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, motion, overlays, radius, typography } from '@/theme';

const TRACK_HEIGHT = 74;
const HANDLE_SIZE = 60;
const PADDING = (TRACK_HEIGHT - HANDLE_SIZE) / 2;
// Kokią kelio dalį reikia nutempti, kad veiksmas būtų įvykdytas.
const COMPLETE_AT = 0.85;

// Ar rankenėlė nutempta pakankamai toli. maxTravel – visas kelias nuo kairio iki dešinio krašto.
export function isSlideComplete(position: number, maxTravel: number): boolean {
  return maxTravel > 0 && position >= maxTravel * COMPLETE_AT;
}

// Rankenėlė negali išeiti už kapsulės ribų.
export function clampSlide(position: number, maxTravel: number): number {
  return Math.min(Math.max(position, 0), Math.max(maxTravel, 0));
}

// Rankenėlės gyvenimo etapai: laukia, tempiama, grįžta atgal, važiuoja iki galo, veiksmas įvykdytas.
type Phase = 'idle' | 'dragging' | 'returning' | 'completing' | 'done';

type Props = {
  label: string;
  accessibilityHint: string;
  onComplete: () => void;
  testID?: string;
};

// „Patrauk, kad pradėtum“ kapsulė. Ekrano skaitytuvui tai paprastas mygtukas – tempti nereikia.
export function SlideToEnter({ label, accessibilityHint, onComplete, testID }: Props) {
  const reduced = useReducedMotion();
  const [maxTravel, setMaxTravel] = useState(0);
  const position = useRef(new Animated.Value(0)).current;

  // PanResponder sukuriamas vieną kartą, todėl pasikeitę nustatymai ar atgalinis iškvietimas
  // jo nepakeičia ir nenutraukia pradėto gesto – dabartinės reikšmės imamos iš nuorodų.
  const maxRef = useRef(0);
  maxRef.current = maxTravel;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const phase = useRef<Phase>('idle');
  const mounted = useRef(true);
  // Rankenėlės padėtis tempimo pradžioje ir tempimo numeris (pavėluoti atsakymai ignoruojami).
  const dragStart = useRef<number | null>(null);
  const dragId = useRef(0);

  // Veiksmas įvykdomas ne daugiau kaip vieną kartą ir niekada po išmontavimo.
  const finish = useCallback(() => {
    if (!mounted.current || phase.current === 'done') return;
    phase.current = 'done';
    onCompleteRef.current();
  }, []);

  // Grąžina rankenėlę į pradžią: be animacijos, jei įjungtas „mažinti judesį“.
  const returnToStart = useCallback(() => {
    if (reducedRef.current) {
      position.setValue(0);
      phase.current = 'idle';
      return;
    }
    phase.current = 'returning';
    Animated.spring(position, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start(({ finished }) => {
      // Nutraukta animacija (pvz. išmontuojant ar vėl pradėjus tempti) etapo nekeičia.
      if (finished && mounted.current && phase.current === 'returning') phase.current = 'idle';
    });
  }, [position]);

  // Išmontuojant sustabdoma bet kuri vykstanti animacija; po to veiksmas nebekviečiamas.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      position.stopAnimation();
    };
  }, [position]);

  // Įjungus „mažinti judesį“ grįžtanti rankenėlė nelaukia animacijos ir nelieka pusiaukelėje.
  useEffect(() => {
    if (reduced && phase.current === 'returning') {
      position.stopAnimation();
      position.setValue(0);
      phase.current = 'idle';
    }
  }, [reduced, position]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Pasibaigus veiksmui ar kol rankenėlė važiuoja iki galo, naujo gesto nepriimame.
        onStartShouldSetPanResponder: () => phase.current !== 'completing' && phase.current !== 'done',
        onMoveShouldSetPanResponder: () => phase.current !== 'completing' && phase.current !== 'done',
        // Kiti komponentai tempimo neperima; nutraukimą (pvz. sistemos) apdoroja onPanResponderTerminate.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          // Jei rankenėlė dar grįžta, tempimas prasideda nuo tikrosios jos padėties, o ne nuo nulio.
          const id = ++dragId.current;
          dragStart.current = null;
          phase.current = 'dragging';
          position.stopAnimation((value) => {
            if (dragId.current === id) dragStart.current = value;
          });
        },
        onPanResponderMove: (_event, gesture) => {
          if (phase.current !== 'dragging' || dragStart.current === null) return;
          position.setValue(clampSlide(dragStart.current + gesture.dx, maxRef.current));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (phase.current !== 'dragging') return;
          const max = maxRef.current;
          const start = dragStart.current ?? 0;
          dragStart.current = null;

          if (!isSlideComplete(clampSlide(start + gesture.dx, max), max)) {
            // Nepakankamai nutempta – rankenėlė grįžta atgal.
            returnToStart();
            return;
          }

          if (reducedRef.current) {
            position.setValue(max);
            finish();
            return;
          }

          // Rankenėlė pati nuvažiuoja iki galo; programėlė atidaroma tik sėkmingai pabaigus animaciją.
          phase.current = 'completing';
          Animated.timing(position, { toValue: max, duration: motion.press, useNativeDriver: true }).start(({ finished }) => {
            if (!mounted.current) return;
            if (finished) {
              finish();
            } else {
              // Animacija nutraukta, o veiksmas neįvykdytas – rankenėlė nelieka pusiaukelėje.
              returnToStart();
            }
          });
        },
        // Gestą nutraukė sistema ar kita sąsaja: rankenėlė grįžta į pradžią, veiksmas nevykdomas.
        onPanResponderTerminate: () => {
          if (phase.current !== 'dragging') return;
          dragId.current += 1;
          dragStart.current = null;
          returnToStart();
        },
      }),
    [position, returnToStart, finish],
  );

  // Tempiant užrašas blanksta.
  const labelOpacity = position.interpolate({ inputRange: [0, Math.max(maxTravel * 0.6, 1)], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      style={styles.track}
      onLayout={(event) => setMaxTravel(event.nativeEvent.layout.width - HANDLE_SIZE - PADDING * 2 - 2)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate') {
          finish();
        }
      }}
      testID={testID}
    >
      <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>{label}</Animated.Text>
      <View style={styles.chevrons}>
        <Ionicons name="chevron-forward" size={18} color="rgba(247, 247, 247, 0.35)" />
        <Ionicons name="chevron-forward" size={18} color="rgba(247, 247, 247, 0.6)" />
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </View>
      <Animated.View style={[styles.handle, { transform: [{ translateX: position }] }]} {...panResponder.panHandlers} testID={testID ? `${testID}-handle` : undefined}>
        <Ionicons name="arrow-forward" size={26} color={colors.textOnBrand} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: overlays.glassLight,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    justifyContent: 'center',
  },
  label: { ...typography.button, fontSize: 17, color: colors.text, textAlign: 'center' },
  chevrons: { position: 'absolute', right: 22, flexDirection: 'row' },
  handle: {
    position: 'absolute',
    left: PADDING,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});