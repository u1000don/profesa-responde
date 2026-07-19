import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Camera,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import Slider from '@react-native-community/slider';
import { AlignedPhoto } from '../../../src/components/AlignedPhoto';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { Screen } from '../../../src/components/Screen';
import { referenceSize } from '../../../src/lib/align/canonical';
import { ALIGNED_MESSAGE, computeGuidance } from '../../../src/lib/align/guidance';
import { detectFace } from '../../../src/lib/landmarks/face';
import { detectPose, midpoint } from '../../../src/lib/landmarks/pose';
import { addPhotoToProject } from '../../../src/lib/ingest';
import { getImageSize } from '../../../src/lib/storage/photos';
import { sortedPhotos, useProject } from '../../../src/store/projects';
import { absoluteFill, colors, radius, spacing, type } from '../../../src/theme';
import { VIEW_LABELS, type SubjectSummary, type ViewAngle } from '../../../src/types';

const GUIDANCE_INTERVAL_MS = 1500;

export default function CaptureScreen() {
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const view = (viewParam ?? 'front') as ViewAngle;
  const project = useProject(id);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>(
    project?.mode === 'face' ? 'front' : 'back'
  );
  const cameraRef = useRef<CameraRef>(null);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });

  const [ghostOpacity, setGhostOpacity] = useState(0.45);
  const [ghostMirrored, setGhostMirrored] = useState(position === 'front');
  const [hint, setHint] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ uri: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const previous = useMemo(() => {
    if (!project) return undefined;
    const line = sortedPhotos(project, view);
    return line[line.length - 1];
  }, [project, view]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Live guidance: every ~1.5s, grab a low-quality preview snapshot, detect
  // landmarks on-device, compare against the previous photo, then delete the
  // snapshot. Skipped entirely when there is no reference yet.
  const refSummary = previous?.auto?.summary;
  const mode = project?.mode ?? 'face';
  useEffect(() => {
    if (!refSummary || captured || !hasPermission) return;
    let cancelled = false;
    const tick = async () => {
      const cam = cameraRef.current;
      if (!cam) return;
      let snapPath: string | null = null;
      try {
        const snapshot = await cam.takeSnapshot();
        const path = await snapshot.saveToTemporaryFileAsync('jpg', 60);
        snapshot.dispose();
        snapPath = path.startsWith('file://') ? path : `file://${path}`;
        const current = await summarize(snapPath, mode);
        if (!cancelled) {
          setHint(
            current
              ? (computeGuidance(mode, refSummary, current, position === 'front') ?? ALIGNED_MESSAGE)
              : null
          );
        }
      } catch {
        // Snapshot/detection is best-effort; the ghost overlay still works.
      } finally {
        if (snapPath) FileSystem.deleteAsync(snapPath, { idempotent: true }).catch(() => {});
      }
    };
    const timer = setInterval(tick, GUIDANCE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refSummary, captured, hasPermission, mode, position]);

  if (!project) return null;

  if (!hasPermission) {
    return (
      <Screen>
        <EmptyState
          title="Camera access"
          message="ThenNow uses the camera to capture progress photos. Images stay on your device unless you choose to share them."
        >
          <Button title="Allow camera" onPress={requestPermission} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing(2) }} />
        </EmptyState>
      </Screen>
    );
  }

  // Centered frame matching the project's video format, letterboxed into the screen.
  const ref = referenceSize(project.format);
  const frameAspect = ref.width / ref.height;
  let frameWidth = windowWidth;
  let frameHeight = frameWidth / frameAspect;
  const maxFrameHeight = windowHeight * 0.72;
  if (frameHeight > maxFrameHeight) {
    frameHeight = maxFrameHeight;
    frameWidth = frameHeight * frameAspect;
  }

  const takePhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
      const path = await photo.saveToTemporaryFileAsync();
      photo.dispose();
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      setCaptured({ uri });
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? 'Could not take the photo.');
    }
  };

  const usePhoto = async () => {
    if (!captured) return;
    setSaving(true);
    try {
      // The capture date is saved automatically; it can be changed later
      // from the timeline.
      await addPhotoToProject(project.id, view, captured.uri, new Date().toISOString());
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save photo', e?.message ?? 'Something went wrong.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={position}
        isActive={!captured}
        outputs={[photoOutput]}
      />

      {/* Format frame + ghost of the previous photo */}
      {!captured && (
        <View pointerEvents="none" style={styles.frameLayer}>
          <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
            {previous && (
              <View
                style={[
                  { opacity: ghostOpacity },
                  ghostMirrored && { transform: [{ scaleX: -1 }] },
                ]}
              >
                <AlignedPhoto photo={previous} format={project.format} width={frameWidth} />
              </View>
            )}
            {/* Rule-of-thirds guides */}
            <View style={[styles.gridLine, { left: '33.3%', width: 1, top: 0, bottom: 0 }]} />
            <View style={[styles.gridLine, { left: '66.6%', width: 1, top: 0, bottom: 0 }]} />
            <View style={[styles.gridLine, { top: '33.3%', height: 1, left: 0, right: 0 }]} />
            <View style={[styles.gridLine, { top: '66.6%', height: 1, left: 0, right: 0 }]} />
          </View>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.topIcon}>✕</Text>
        </Pressable>
        <Text style={[type.h2, { color: '#fff' }]}>
          {VIEW_LABELS[view]} · {previous ? 'Match your previous photo' : 'First photo'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          onPress={() => setPosition((p) => (p === 'front' ? 'back' : 'front'))}
          hitSlop={12}
        >
          <Text style={styles.topIcon}>⟲</Text>
        </Pressable>
      </View>

      {/* Live guidance */}
      {!captured && hint && (
        <View style={[styles.hint, hint === ALIGNED_MESSAGE && styles.hintAligned]}>
          <Text style={[styles.hintText, hint === ALIGNED_MESSAGE && { color: colors.onAccent }]}>
            {hint}
          </Text>
        </View>
      )}

      {/* Bottom controls */}
      {!captured && (
        <View style={styles.bottom}>
          {previous && (
            <View style={styles.ghostRow}>
              <Text style={[type.small, { color: '#fff', width: 44 }]}>Ghost</Text>
              <Slider
                style={{ flex: 1 }}
                accessibilityLabel="Ghost opacity"
                value={ghostOpacity}
                minimumValue={0}
                maximumValue={0.9}
                onValueChange={setGhostOpacity}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor={colors.accent}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mirror ghost"
                onPress={() => setGhostMirrored((m) => !m)}
                hitSlop={10}
              >
                <Text style={[type.small, { color: ghostMirrored ? colors.accent : '#fff' }]}>Mirror</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={takePhoto}
            style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      )}

      {/* Confirm captured photo */}
      {captured && (
        <View style={styles.confirm}>
          <Image source={{ uri: captured.uri }} style={styles.confirmImage} resizeMode="contain" />
          {saving ? (
            <View style={styles.confirmRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[type.dim, { marginLeft: spacing(2) }]}>Aligning photo…</Text>
            </View>
          ) : (
            <View style={styles.confirmRow}>
              <Button title="Retake" variant="secondary" onPress={() => setCaptured(null)} style={{ flex: 1 }} />
              <Button title="Use photo" onPress={usePhoto} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

async function summarize(uri: string, mode: 'face' | 'body'): Promise<SubjectSummary | null> {
  const { width, height } = await getImageSize(uri);
  if (mode === 'face') {
    const face = await detectFace(uri, 'fast');
    if (!face) return null;
    return {
      cx: (face.imageLeftEye.x + face.imageRightEye.x) / 2 / width,
      cy: (face.imageLeftEye.y + face.imageRightEye.y) / 2 / height,
      size:
        Math.hypot(
          face.imageRightEye.x - face.imageLeftEye.x,
          face.imageRightEye.y - face.imageLeftEye.y
        ) / width,
      roll: face.roll,
      yaw: face.yaw,
    };
  }
  const pose = await detectPose(uri);
  if (!pose) return null;
  const hip = midpoint(pose.landmarks.leftHip, pose.landmarks.rightHip);
  const ankle = midpoint(pose.landmarks.leftAnkle, pose.landmarks.rightAnkle);
  const nose = pose.landmarks.nose;
  if (!hip || !ankle || !nose) return null;
  return {
    cx: hip.x / width,
    cy: hip.y / height,
    size: Math.abs(ankle.y - nose.y) / height,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  frameLayer: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.22)' },
  topBar: {
    position: 'absolute',
    top: 58,
    left: spacing(5),
    right: spacing(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIcon: { color: '#fff', fontSize: 22, fontWeight: '600' },
  hint: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  hintAligned: { backgroundColor: colors.accent },
  hintText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bottom: {
    position: 'absolute',
    bottom: 42,
    left: spacing(5),
    right: spacing(5),
    alignItems: 'center',
    gap: spacing(4),
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1),
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  confirm: {
    ...absoluteFill,
    backgroundColor: '#000',
    justifyContent: 'flex-end',
    paddingBottom: 42,
    paddingHorizontal: spacing(5),
  },
  confirmImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 130 },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
