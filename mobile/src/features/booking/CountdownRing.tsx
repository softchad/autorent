import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { lt } from '@/i18n/lt';
import { colors, typography } from '@/theme';
import { formatCountdown } from '@/utils/format';
import { remainingSeconds, TimerPhase, timerPhase, timerProgress } from './holdTimer';

type Props = {
  remainingMs: number;
  totalMs: number;
  size?: number;
};

const STROKE = 10;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Fazė keičia žiedo spalvą, o laiko ir paaiškinimo tekstų spalvos lieka tos pačios.
const PHASE_COLORS: Record<TimerPhase, string> = {
  normal: colors.primary,
  warning: colors.warning,
  critical: colors.danger,
  expired: colors.textMuted,
};

// Tekstas ekrano skaitytuvui, pvz. „Liko 9 min. 30 sek.“
export function ringLabel(remainingMs: number): string {
  const seconds = remainingSeconds(remainingMs);
  if (seconds <= 0) {
    return lt.holdTimer.expired;
  }
  return lt.holdTimer.remaining(Math.floor(seconds / 60), seconds % 60);
}

export function CountdownRing({ remainingMs, totalMs, size = 160 }: Props) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = timerProgress(remainingMs, totalMs);
  const phase = timerPhase(remainingMs);

  // Žiedas tarp atnaujinimų juda tolygiai, o ne šuoliais kas sekundę.
  const animated = useRef(new Animated.Value(progress)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      animated.setValue(progress);
      return;
    }
    const animation = Animated.timing(animated, { toValue: progress, duration: 450, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [animated, progress, reduced]);

  const dashOffset = animated.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <View
      style={[styles.wrapper, { width: size, height: size }]}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={ringLabel(remainingMs)}
      testID="countdown-ring"
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.neutralSoft} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={PHASE_COLORS[phase]}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          // Pradžia viršuje (12 valandos padėtis), o ne dešinėje.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.time} testID="countdown-text">
        {formatCountdown(remainingSeconds(remainingMs))}
      </Text>
      <Text style={styles.caption}>{phase === 'expired' ? lt.holdTimer.expired : lt.holdTimer.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  svg: { position: 'absolute' },
  time: { ...typography.title, fontVariant: ['tabular-nums'] },
  caption: { ...typography.caption, textAlign: 'center', maxWidth: 110 },
});
