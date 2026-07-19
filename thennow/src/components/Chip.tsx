import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  label: string;
  tone?: 'neutral' | 'accent' | 'warning';
}

export function Chip({ label, tone = 'neutral' }: Props) {
  const bg =
    tone === 'accent'
      ? 'rgba(45,212,191,0.16)'
      : tone === 'warning'
        ? 'rgba(255,184,77,0.16)'
        : colors.surfaceAlt;
  const fg = tone === 'accent' ? colors.accent : tone === 'warning' ? colors.warning : colors.textDim;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
});
