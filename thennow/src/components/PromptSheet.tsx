import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function PromptSheet({
  visible,
  title,
  initialValue,
  placeholder,
  confirmLabel = 'Save',
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={[type.h2, { marginBottom: spacing(3) }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            autoFocus
            style={styles.input}
          />
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.flex} />
            <Button
              title={confirmLabel}
              onPress={() => {
                onClose();
                onConfirm(value);
              }}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing(6),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(5),
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    marginBottom: spacing(4),
  },
  row: { flexDirection: 'row', gap: spacing(3) },
  flex: { flex: 1 },
});
