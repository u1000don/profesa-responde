import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { Screen } from '../../../src/components/Screen';
import { exportVideo, type ExportProgress } from '../../../src/lib/video/exporter';
import { renderBeforeAfter } from '../../../src/lib/video/beforeAfter';
import { useProject } from '../../../src/store/projects';
import { colors, radius, spacing, type } from '../../../src/theme';
import type { ViewAngle } from '../../../src/types';

type Phase =
  | { name: 'working'; progress: ExportProgress | null }
  | { name: 'done'; uri: string; durationMs: number; warnings: string[]; savedToLibrary: boolean }
  | { name: 'error'; message: string };

const STAGE_LABELS: Record<ExportProgress['stage'], string> = {
  photos: 'Aligning photos',
  transitions: 'Rendering transitions',
  encoding: 'Encoding video',
};

export default function ExportScreen() {
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const view = (viewParam ?? 'front') as ViewAngle;
  const project = useProject(id);
  const [phase, setPhase] = useState<Phase>({ name: 'working', progress: null });
  const startedRef = useRef(false);

  useEffect(() => {
    if (!project || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const result = await exportVideo(project, view, (progress) =>
          setPhase({ name: 'working', progress })
        );
        let saved = false;
        try {
          const permission = await MediaLibrary.requestPermissionsAsync(true);
          if (permission.granted) {
            await MediaLibrary.saveToLibraryAsync(result.uri);
            saved = true;
          }
        } catch {
          // Saving is optional; sharing from the app cache still works.
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPhase({
          name: 'done',
          uri: result.uri,
          durationMs: result.durationMs,
          warnings: result.warnings,
          savedToLibrary: saved,
        });
      } catch (e: any) {
        setPhase({ name: 'error', message: e?.message ?? 'Something went wrong during export.' });
      }
    })();
  }, [project, view]);

  if (!project) {
    return (
      <Screen>
        <EmptyState title="Project not found" message="This ThenNow no longer exists.">
          <Button title="Back" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  const shareVideo = async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'video/mp4', dialogTitle: 'Share Your Progress' });
    }
  };

  const shareBeforeAfter = async () => {
    try {
      const path = await renderBeforeAfter(project, view);
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Then & Now' });
      }
    } catch {
      // Rendering issues surface via the export flow; keep the button quiet.
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={type.h1}>Share Your Progress</Text>
      </View>

      {phase.name === 'working' && (
        <View style={styles.center}>
          <Text style={[type.h2, { textAlign: 'center' }]}>
            {phase.progress ? STAGE_LABELS[phase.progress.stage] : 'Preparing'}…
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    phase.progress && phase.progress.total > 0
                      ? Math.round((phase.progress.done / phase.progress.total) * 100)
                      : 6
                  }%`,
                },
              ]}
            />
          </View>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Everything is processed on your device.
          </Text>
        </View>
      )}

      {phase.name === 'done' && (
        <View style={styles.center}>
          <Text style={styles.doneEmoji}>✓</Text>
          <Text style={[type.h1, { textAlign: 'center' }]}>Your ThenNow is ready</Text>
          <Text style={[type.dim, { textAlign: 'center', marginTop: spacing(1) }]}>
            {(phase.durationMs / 1000).toFixed(1)}s · {project.format} MP4
            {phase.savedToLibrary ? ' · saved to your photos' : ''}
          </Text>
          {phase.warnings.map((w) => (
            <Text key={w} style={[type.small, { color: colors.warning, textAlign: 'center', marginTop: spacing(2) }]}>
              {w}
            </Text>
          ))}
          <View style={{ alignSelf: 'stretch', gap: spacing(2.5), marginTop: spacing(6) }}>
            <Button title="Share video" onPress={() => shareVideo(phase.uri)} />
            <Button title="Before & after image" variant="secondary" onPress={shareBeforeAfter} />
            <Button title="Done" variant="ghost" onPress={() => router.dismissTo(`/project/${project.id}`)} />
          </View>
        </View>
      )}

      {phase.name === 'error' && (
        <EmptyState title="Export failed" message={phase.message}>
          <Button title="Back to preview" onPress={() => router.back()} />
        </EmptyState>
      )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    gap: spacing(3),
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  doneEmoji: {
    fontSize: 34,
    color: colors.onAccent,
    backgroundColor: colors.accent,
    width: 72,
    height: 72,
    borderRadius: 36,
    textAlign: 'center',
    lineHeight: 70,
    overflow: 'hidden',
  },
});
