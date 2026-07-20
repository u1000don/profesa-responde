import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Fill, Group, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { AlignedPhoto } from '../../../../src/components/AlignedPhoto';
import { Button } from '../../../../src/components/Button';
import { EmptyState } from '../../../../src/components/EmptyState';
import { Screen } from '../../../../src/components/Screen';
import { faceTargets, referenceSize } from '../../../../src/lib/align/canonical';
import { effectiveTransform } from '../../../../src/lib/align/effective';
import { coverTransform, type SimilarityTransform } from '../../../../src/lib/geometry/similarity';
import { formatDay } from '../../../../src/lib/dates';
import { sortedPhotos, useProject, useProjects } from '../../../../src/store/projects';
import { absoluteFill, colors, radius, spacing, type } from '../../../../src/theme';

const ROTATION_SNAP_RAD = (2 * Math.PI) / 180;

export default function AdjustPhoto() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const project = useProject(id);
  const photo = project?.photos.find((p) => p.id === photoId);
  const { width: windowWidth } = useWindowDimensions();

  if (!project || !photo) {
    return (
      <Screen>
        <EmptyState title="Photo not found" message="This photo no longer exists.">
          <Button title="Go back" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  return <Editor key={photo.id} projectId={project.id} photoId={photo.id} windowWidth={windowWidth} />;
}

function Editor({
  projectId,
  photoId,
  windowWidth,
}: {
  projectId: string;
  photoId: string;
  windowWidth: number;
}) {
  const project = useProject(projectId)!;
  const photo = project.photos.find((p) => p.id === photoId)!;
  const setManualTransform = useProjects((s) => s.setManualTransform);

  const ref = referenceSize(project.format);
  const canvasWidth = windowWidth - spacing(5) * 2;
  const canvasHeight = (canvasWidth * ref.height) / ref.width;
  const k = canvasWidth / ref.width;

  const initial = useMemo(() => effectiveTransform(photo, project.format), []);

  const scale = useSharedValue(initial.scale);
  const rotation = useSharedValue(initial.rotation);
  const tx = useSharedValue(initial.tx);
  const ty = useSharedValue(initial.ty);

  // Undo/redo history of committed transforms (index 0 = state on entry).
  const history = useRef<SimilarityTransform[]>([initial]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [ghostOpacity, setGhostOpacity] = useState(0);

  const line = sortedPhotos(project, photo.view);
  const previous = line[Math.max(0, line.findIndex((p) => p.id === photo.id) - 1)];
  const showGhost = previous && previous.id !== photo.id;

  const image = useImage(photo.uri);
  const transform = useDerivedValue(() => [
    { translateX: tx.value * k },
    { translateY: ty.value * k },
    { rotate: rotation.value },
    { scale: scale.value * k },
  ]);

  const apply = (t: SimilarityTransform, animated = false) => {
    if (animated) {
      scale.value = withTiming(t.scale, { duration: 160 });
      rotation.value = withTiming(t.rotation, { duration: 160 });
      tx.value = withTiming(t.tx, { duration: 160 });
      ty.value = withTiming(t.ty, { duration: 160 });
    } else {
      scale.value = t.scale;
      rotation.value = t.rotation;
      tx.value = t.tx;
      ty.value = t.ty;
    }
  };

  const commit = (t: SimilarityTransform) => {
    const next = history.current.slice(0, historyIndex + 1);
    next.push(t);
    history.current = next;
    setHistoryIndex(next.length - 1);
    setManualTransform(projectId, photoId, t);
  };

  const commitCurrent = () => {
    let r = rotation.value;
    // Snap: tiny rotations settle to perfectly level.
    if (Math.abs(r) < ROTATION_SNAP_RAD && r !== 0) {
      r = 0;
      rotation.value = withTiming(0, { duration: 120 });
      Haptics.selectionAsync().catch(() => {});
    }
    commit({ scale: scale.value, rotation: r, tx: tx.value, ty: ty.value });
  };

  const cx = ref.width / 2;
  const cy = ref.height / 2;

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onChange((e) => {
      tx.value += e.changeX / k;
      ty.value += e.changeY / k;
    })
    .onEnd(() => runOnJS(commitCurrent)());

  const pinch = Gesture.Pinch()
    .onChange((e) => {
      const f = e.scaleChange;
      scale.value *= f;
      // Zoom about the canvas center.
      tx.value = cx + f * (tx.value - cx);
      ty.value = cy + f * (ty.value - cy);
    })
    .onEnd(() => runOnJS(commitCurrent)());

  const rotate = Gesture.Rotation()
    .onChange((e) => {
      const d = e.rotationChange;
      rotation.value += d;
      // Rotate about the canvas center.
      const cos = Math.cos(d);
      const sin = Math.sin(d);
      const dx = tx.value - cx;
      const dy = ty.value - cy;
      tx.value = cx + cos * dx - sin * dy;
      ty.value = cy + sin * dx + cos * dy;
    })
    .onEnd(() => runOnJS(commitCurrent)());

  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

  const undo = () => {
    if (historyIndex === 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    const t = history.current[idx];
    apply(t, true);
    setManualTransform(projectId, photoId, idx === 0 && !photo.manual ? null : t);
  };

  const redo = () => {
    if (historyIndex >= history.current.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    apply(history.current[idx], true);
    setManualTransform(projectId, photoId, history.current[idx]);
  };

  const resetCentered = () => {
    const t = coverTransform(photo.width, photo.height, ref.width, ref.height);
    apply(t, true);
    commit(t);
  };

  const resetToAuto = () => {
    if (!photo.auto) return;
    apply(photo.auto.transform, true);
    const next = history.current.slice(0, historyIndex + 1);
    next.push(photo.auto.transform);
    history.current = next;
    setHistoryIndex(next.length - 1);
    setManualTransform(projectId, photoId, null);
  };

  const showFlagReasons = () => {
    if (photo.auto?.reasons.length) {
      Alert.alert('Alignment check', photo.auto.reasons.join('\n\n'));
    }
  };

  // Alignment guide positions (in display pixels).
  const guides: { x?: number; y?: number }[] = [{ x: canvasWidth / 2 }];
  if (project.mode === 'face') {
    guides.push({ y: faceTargets(project.format).leftEye.y * k });
  } else {
    guides.push({ y: canvasHeight * 0.12 }, { y: canvasHeight * 0.92 });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>Adjust</Text>
          <Text style={type.small}>{formatDay(photo.capturedAt)}</Text>
        </View>
        {photo.status === 'flagged' && (
          <Pressable accessibilityRole="button" onPress={showFlagReasons} style={styles.flagPill}>
            <Text style={styles.flagPillText}>Needs review</Text>
          </Pressable>
        )}
      </View>

      <GestureDetector gesture={gesture}>
        <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
          <Canvas style={{ width: canvasWidth, height: canvasHeight, backgroundColor: '#000' }}>
            <Fill color="black" />
            {image && (
              <Group transform={transform}>
                <SkiaImage image={image} x={0} y={0} width={image.width()} height={image.height()} fit="none" />
              </Group>
            )}
          </Canvas>

          {/* Ghost of the previous photo for comparison */}
          {showGhost && ghostOpacity > 0 && (
            <View pointerEvents="none" style={[absoluteFill, { opacity: ghostOpacity }]}>
              <AlignedPhoto photo={previous} format={project.format} width={canvasWidth} />
            </View>
          )}

          {/* Alignment guides */}
          <View pointerEvents="none" style={absoluteFill}>
            {guides.map((g, i) => (
              <View
                key={i}
                style={[
                  styles.guide,
                  g.x != null
                    ? { left: g.x, top: 0, bottom: 0, width: 1 }
                    : { top: g.y, left: 0, right: 0, height: 1 },
                ]}
              />
            ))}
          </View>
        </View>
      </GestureDetector>

      <Text style={[type.small, { textAlign: 'center', marginTop: spacing(2) }]}>
        Drag to move · pinch to zoom · twist to rotate
      </Text>

      {showGhost && (
        <View style={styles.compareRow}>
          <Text style={[type.small, { width: 64 }]}>Compare</Text>
          <Slider
            style={{ flex: 1 }}
            accessibilityLabel="Compare with previous photo"
            value={ghostOpacity}
            minimumValue={0}
            maximumValue={0.9}
            onValueChange={setGhostOpacity}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
          />
        </View>
      )}

      <View style={styles.tools}>
        <Button title="Undo" variant="secondary" small disabled={historyIndex === 0} onPress={undo} style={styles.tool} />
        <Button
          title="Redo"
          variant="secondary"
          small
          disabled={historyIndex >= history.current.length - 1}
          onPress={redo}
          style={styles.tool}
        />
        <Button title="Center" variant="secondary" small onPress={resetCentered} style={styles.tool} />
        <Button title="Auto" variant="secondary" small disabled={!photo.auto} onPress={resetToAuto} style={styles.tool} />
      </View>

      <View style={{ marginTop: 'auto', paddingBottom: spacing(3) }}>
        <Button title="Done" onPress={() => router.back()} />
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
  flagPill: {
    backgroundColor: 'rgba(255,184,77,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  flagPillText: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  guide: { position: 'absolute', backgroundColor: 'rgba(45,212,191,0.45)' },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  tools: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  tool: { flex: 1 },
});
