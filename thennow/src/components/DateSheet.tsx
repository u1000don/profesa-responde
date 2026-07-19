import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, type } from '../theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  date: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

/** Date editor for a photo's capture date. */
export function DateSheet({ visible, date, onClose, onConfirm }: Props) {
  const [value, setValue] = useState(date);

  if (!visible) return null;

  if (Platform.OS === 'android') {
    // Android shows its own dialog; render the picker directly.
    return (
      <DateTimePicker
        value={date}
        mode="date"
        maximumDate={new Date()}
        onChange={(event: DateTimePickerEvent, selected?: Date) => {
          if (event.type === 'set' && selected) onConfirm(selected);
          else onClose();
        }}
      />
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={[type.h2, styles.title]}>Photo date</Text>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            themeVariant="dark"
            onChange={(_: DateTimePickerEvent, selected?: Date) => selected && setValue(selected)}
          />
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.flex} />
            <Button title="Save date" onPress={() => onConfirm(value)} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(5),
    paddingBottom: spacing(9),
  },
  title: { textAlign: 'center', marginBottom: spacing(2) },
  row: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(3) },
  flex: { flex: 1 },
});
