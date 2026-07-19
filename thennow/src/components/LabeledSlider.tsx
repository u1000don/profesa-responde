import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, type } from '../theme';

interface Props {
  label: string;
  valueLabel: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
}

export function LabeledSlider({
  label,
  valueLabel,
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={type.dim}>{label}</Text>
        <Text style={[type.dim, { color: colors.text }]}>{valueLabel}</Text>
      </View>
      <Slider
        accessibilityLabel={label}
        value={value}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        onValueChange={onValueChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(1) },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
