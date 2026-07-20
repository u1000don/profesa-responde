import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

interface Props {
  title: string;
  message: string;
  children?: React.ReactNode;
}

export function EmptyState({ title, message, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[type.h1, styles.center]}>{title}</Text>
      <Text style={[type.dim, styles.center, { marginTop: spacing(2), lineHeight: 21 }]}>
        {message}
      </Text>
      {children ? <View style={{ marginTop: spacing(5), alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
  },
  center: { textAlign: 'center', color: colors.text },
});
