import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { AlignedPhoto } from '../../../src/components/AlignedPhoto';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { LabeledSlider } from '../../../src/components/LabeledSlider';
import { Screen } from '../../../src/components/Screen';
import { SegmentedControl } from '../../../src/components/SegmentedControl';
import { referenceSize } from '../../../src/lib/align/canonical';
import { copyIntoProject } from '../../../src/lib/storage/photos';
import { formatDay } from '../../../src/lib/dates';
import { sortedPhotos, useProject, useProjects } from '../../../src/store/projects';
import { absoluteFill, colors, radius, spacing, type } from '../../../src/theme';
import type { ViewAngle } from '../../../src/types';

export default function PreviewScreen() {
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const view = (viewParam ?? 'front') as ViewAngle;
  const project = useProject(id);
  const updateSettings = useProjects((s) => s.updateSettings);
  const { width: windowWidth } = useWindowDimensions();

  const photos = useMemo(() => (project ? sortedPhotos(project, view) : []), [project, view]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settings = project?.settings;

  // Real-time preview: hold each aligned photo, then crossfade (or cut) to
  // the next — the same timing model the exporter uses.
  useEffect(() => {
    if (!project || !settings || !playing || photos.length < 2) return;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      let hold = settings.photoDurationMs;
      if (index === 0) hold += settings.holdFirstMs;
      if (index === photos.length - 1) hold += settings.holdLastMs;

      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const next = (index + 1) % photos.length;
        if (settings.transition === 'crossfade') {
          Animated.timing(fade, {
            toValue: 1,
            duration: settings.crossfadeMs,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished && !cancelled) {
              setIndex(next);
              fade.setValue(0);
            }
          });
        } else {
          setIndex(next);
        }
      }, hold);
    };
    step();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      fade.stopAnimation();
      fade.setValue(0);
    };
  }, [project, settings, playing, index, photos.length, fade]);

  if (!project || !settings) {
    return (
      <Screen>
        <EmptyState title="Project not found" message="This ThenNow no longer exists.">
          <Button title="Back" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  if (photos.length < 2) {
    return (
      <Screen>
        <EmptyState title="Almost there" message="Add at least two photos to preview your progress video.">
          <Button title="Back to timeline" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  const ref = referenceSize(project.format);
  let previewWidth = windowWidth - spacing(5) * 2;
  let previewHeight = (previewWidth * ref.height) / ref.width;
  const maxH = 420;
  if (previewHeight > maxH) {
    previewHeight = maxH;
    previewWidth = (previewHeight * ref.width) / ref.height;
  }

  const current = photos[index];
  const next = photos[(index + 1) % photos.length];

  const pickMusic = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    // Copy into the project so the track survives cache cleanup.
    const stored = await copyIntoProject(project.id, asset.uri);
    updateSettings(project.id, { musicUri: stored, musicName: asset.name ?? 'Music' });
  };

  const totalSeconds =
    (photos.length * settings.photoDurationMs + settings.holdFirstMs + settings.holdLastMs) / 1000;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Preview</Text>
          <Text style={type.small}>
            {photos.length} photos · about {totalSeconds.toFixed(1)}s
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing(28) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}
          onPress={() => setPlaying((p) => !p)}
          style={[styles.player, { width: previewWidth, height: previewHeight }]}
        >
          <AlignedPhoto photo={current} format={project.format} width={previewWidth} />
          <Animated.View style={[absoluteFill, { opacity: fade }]}>
            <AlignedPhoto photo={next} format={project.format} width={previewWidth} />
          </Animated.View>
          {settings.showDates && (
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>{formatDay(current.capturedAt)}</Text>
            </View>
          )}
          {!playing && (
            <View style={styles.playOverlay}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.controls}>
          <LabeledSlider
            label="Time per photo"
            valueLabel={`${(settings.photoDurationMs / 1000).toFixed(1)}s`}
            value={settings.photoDurationMs}
            minimumValue={200}
            maximumValue={2000}
            step={100}
            onValueChange={(v) => updateSettings(project.id, { photoDurationMs: v })}
          />

          <View style={styles.rowBetween}>
            <Text style={type.dim}>Transition</Text>
            <View style={{ width: 190 }}>
              <SegmentedControl
                options={[
                  { key: 'cut', label: 'Cut' },
                  { key: 'crossfade', label: 'Crossfade' },
                ]}
                value={settings.transition}
                onChange={(v) => updateSettings(project.id, { transition: v })}
              />
            </View>
          </View>

          {settings.transition === 'crossfade' && (
            <LabeledSlider
              label="Crossfade length"
              valueLabel={`${settings.crossfadeMs}ms`}
              value={settings.crossfadeMs}
              minimumValue={150}
              maximumValue={800}
              step={50}
              onValueChange={(v) => updateSettings(project.id, { crossfadeMs: v })}
            />
          )}

          <ToggleRow
            label="Pause on first photo"
            value={settings.holdFirstMs > 0}
            onChange={(on) => updateSettings(project.id, { holdFirstMs: on ? 1000 : 0 })}
          />
          <ToggleRow
            label="Pause on last photo"
            value={settings.holdLastMs > 0}
            onChange={(on) => updateSettings(project.id, { holdLastMs: on ? 1500 : 0 })}
          />
          <ToggleRow
            label="Show dates in video"
            value={settings.showDates}
            onChange={(on) => updateSettings(project.id, { showDates: on })}
          />

          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={type.dim}>Music</Text>
              <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>
                {settings.musicName ?? 'None — add a track from your device'}
              </Text>
            </View>
            {settings.musicUri ? (
              <Button
                title="Remove"
                variant="ghost"
                small
                onPress={() => updateSettings(project.id, { musicUri: undefined, musicName: undefined })}
              />
            ) : (
              <Button title="Add music" variant="secondary" small onPress={pickMusic} />
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Share Your Progress"
          onPress={() => router.push(`/project/${project.id}/export?view=${view}`)}
        />
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={type.dim}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accentDim }}
        thumbColor={value ? colors.accent : colors.textDim}
        accessibilityLabel={label}
      />
    </View>
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
  player: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  dateBadge: {
    position: 'absolute',
    left: spacing(3),
    bottom: spacing(3),
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  dateText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  playOverlay: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playIcon: { color: '#fff', fontSize: 44 },
  controls: { marginTop: spacing(5), gap: spacing(4) },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
  },
  footer: {
    position: 'absolute',
    left: spacing(5),
    right: spacing(5),
    bottom: spacing(6),
  },
});
