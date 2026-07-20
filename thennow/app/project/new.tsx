import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useProjects } from '../../src/store/projects';
import { colors, radius, spacing, type } from '../../src/theme';
import type { ProjectMode, VideoFormat } from '../../src/types';

const MODES: { key: ProjectMode; title: string; description: string; icon: string }[] = [
  {
    key: 'face',
    title: 'Face Progress',
    description: 'Aligns eyes, nose and mouth so your face stays perfectly steady.',
    icon: '🙂',
  },
  {
    key: 'body',
    title: 'Full-Body Progress',
    description: 'Aligns shoulders, hips, knees and feet across full-body photos.',
    icon: '🧍',
  },
];

const FORMATS: { key: VideoFormat; label: string; hint: string; w: number; h: number }[] = [
  { key: '9:16', label: '9:16', hint: 'Stories & Reels', w: 27, h: 48 },
  { key: '1:1', label: '1:1', hint: 'Square', w: 40, h: 40 },
  { key: '16:9', label: '16:9', hint: 'Widescreen', w: 48, h: 27 },
];

export default function NewProject() {
  const createProject = useProjects((s) => s.createProject);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<ProjectMode>('face');
  const [format, setFormat] = useState<VideoFormat>('9:16');

  const create = () => {
    const project = createProject(name, mode, format);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace(`/project/${project.id}`);
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing(10) }}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={type.h1}>Create a ThenNow</Text>
        </View>

        <Text style={[type.small, styles.sectionLabel]}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="My ThenNow"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          accessibilityLabel="Project name"
        />

        <Text style={[type.small, styles.sectionLabel]}>WHAT ARE YOU TRACKING?</Text>
        <View style={{ gap: spacing(3) }}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(m.key)}
                style={[styles.modeCard, active && styles.cardActive]}
              >
                <Text style={styles.modeIcon}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h2, active && { color: colors.accent }]}>{m.title}</Text>
                  <Text style={[type.small, { marginTop: 2, lineHeight: 17 }]}>{m.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[type.small, styles.sectionLabel]}>VIDEO FORMAT</Text>
        <View style={styles.formats}>
          {FORMATS.map((f) => {
            const active = format === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFormat(f.key)}
                style={[styles.formatCard, active && styles.cardActive]}
              >
                <View style={styles.aspectBox}>
                  <View
                    style={[
                      styles.aspectShape,
                      { width: f.w, height: f.h },
                      active && { borderColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[type.h2, { fontSize: 15 }, active && { color: colors.accent }]}>{f.label}</Text>
                <Text style={type.small}>{f.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Create a ThenNow" onPress={create} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingTop: spacing(3),
    paddingBottom: spacing(4),
  },
  back: { color: colors.text, fontSize: 32, lineHeight: 32, marginTop: -4 },
  sectionLabel: { marginTop: spacing(5), marginBottom: spacing(2) },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: spacing(4),
  },
  cardActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  modeIcon: { fontSize: 30 },
  formats: { flexDirection: 'row', gap: spacing(3) },
  formatCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: spacing(3.5),
  },
  aspectBox: { height: 52, justifyContent: 'center' },
  aspectShape: { borderWidth: 2, borderColor: colors.textDim, borderRadius: 4 },
  footer: { paddingVertical: spacing(3) },
});
