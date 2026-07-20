import type { ViewStyle } from 'react-native';

/** RN 0.86 removed StyleSheet.absoluteFillObject; local equivalent for spreads. */
export const absoluteFill: ViewStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

export const colors = {
  bg: '#0B0B0F',
  surface: '#15151C',
  surfaceAlt: '#1E1E28',
  border: '#2A2A36',
  text: '#F4F4F6',
  textDim: '#9B9BA8',
  textFaint: '#6B6B78',
  accent: '#2DD4BF',
  accentDim: '#14655C',
  onAccent: '#04221E',
  danger: '#FF6B6B',
  warning: '#FFB84D',
  overlay: 'rgba(11,11,15,0.72)',
};

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const type = {
  title: { fontSize: 30, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  dim: { fontSize: 14, fontWeight: '400' as const, color: colors.textDim },
  small: { fontSize: 12, fontWeight: '500' as const, color: colors.textDim },
  button: { fontSize: 16, fontWeight: '700' as const },
};
