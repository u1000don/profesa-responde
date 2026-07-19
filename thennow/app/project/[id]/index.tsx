import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionSheet } from '../../../src/components/ActionSheet';
import { AlignedPhoto } from '../../../src/components/AlignedPhoto';
import { Button } from '../../../src/components/Button';
import { DateSheet } from '../../../src/components/DateSheet';
import { EmptyState } from '../../../src/components/EmptyState';
import { PromptSheet } from '../../../src/components/PromptSheet';
import { Screen } from '../../../src/components/Screen';
import { SegmentedControl } from '../../../src/components/SegmentedControl';
import { importPhotoFile } from '../../../src/lib/storage/photos';
import { importPhotosFromLibrary, pickReplacementImage, realignPhoto } from '../../../src/lib/ingest';
import { formatDayShort } from '../../../src/lib/dates';
import { sortedPhotos, useProject, useProjects } from '../../../src/store/projects';
import { colors, radius, spacing, type } from '../../../src/theme';
import { VIEW_ANGLES, VIEW_LABELS, type PhotoEntry, type ViewAngle } from '../../../src/types';

export default function ProjectTimeline() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  const { width: windowWidth } = useWindowDimensions();
  const [view, setView] = useState<ViewAngle>('front');
  const [menuFor, setMenuFor] = useState<PhotoEntry | null>(null);
  const [datingFor, setDatingFor] = useState<PhotoEntry | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [importing, setImporting] = useState(false);

  const photos = useMemo(
    () => (project ? sortedPhotos(project, view) : []),
    [project, view]
  );

  if (!project) {
    return (
      <Screen>
        <EmptyState title="Project not found" message="This ThenNow no longer exists.">
          <Button title="Back to My ThenNow" onPress={() => router.replace('/')} />
        </EmptyState>
      </Screen>
    );
  }

  const columns = 3;
  const gap = spacing(2);
  const thumbWidth = (windowWidth - spacing(5) * 2 - gap * (columns - 1)) / columns;

  const doImport = async () => {
    setImporting(true);
    try {
      await importPhotosFromLibrary(project.id, view);
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? 'Could not import photos.');
    } finally {
      setImporting(false);
    }
  };

  const replaceImage = async (photo: PhotoEntry) => {
    const uri = await pickReplacementImage();
    if (!uri) return;
    const file = await importPhotoFile(project.id, uri);
    useProjects.getState().replacePhotoImage(project.id, photo.id, file);
    realignPhoto(project.id, photo.id).catch(() => {});
  };

  const removePhoto = (photo: PhotoEntry) => {
    Alert.alert('Remove photo?', 'The photo is removed from this project only.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => useProjects.getState().removePhoto(project.id, photo.id),
      },
    ]);
  };

  const otherViews = VIEW_ANGLES.filter((v) => v !== view);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => setRenaming(true)} accessibilityRole="button">
          <Text style={type.h1} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={type.small}>
            {project.mode === 'face' ? 'Face Progress' : 'Full-Body Progress'} · {project.format}
          </Text>
        </Pressable>
      </View>

      <SegmentedControl
        options={VIEW_ANGLES.map((v) => ({ key: v, label: VIEW_LABELS[v] }))}
        value={view}
        onChange={setView}
      />

      {photos.length === 0 ? (
        <EmptyState
          title={`No ${VIEW_LABELS[view].toLowerCase()} photos yet`}
          message="Take your first photo, or import photos from different dates. ThenNow will order and align them automatically."
        />
      ) : (
        <FlatList
          key={view}
          data={photos}
          numColumns={columns}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap: spacing(4), paddingTop: spacing(4), paddingBottom: spacing(30) }}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Photo from ${formatDayShort(item.capturedAt)}`}
              onPress={() => router.push(`/project/${project.id}/adjust/${item.id}`)}
              onLongPress={() => setMenuFor(item)}
              style={{ width: thumbWidth }}
            >
              <View>
                <AlignedPhoto photo={item} format={project.format} width={thumbWidth} borderRadius={radius.sm} />
                <View style={styles.indexBadge}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                {item.status === 'flagged' && (
                  <View style={styles.flagBadge}>
                    <Text style={styles.flagText}>!</Text>
                  </View>
                )}
                {item.status === 'pending' && (
                  <View style={[styles.flagBadge, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.flagText, { color: colors.textDim }]}>…</Text>
                  </View>
                )}
              </View>
              <Text style={[type.small, { marginTop: spacing(1), textAlign: 'center' }]}>
                {formatDayShort(item.capturedAt)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Button
            title="⊕ Import"
            variant="secondary"
            loading={importing}
            onPress={doImport}
            style={styles.flex}
          />
          <Button
            title="◉ Camera"
            variant="secondary"
            onPress={() => router.push(`/project/${project.id}/capture?view=${view}`)}
            style={styles.flex}
          />
        </View>
        <Button
          title="Preview video"
          disabled={photos.length < 2}
          onPress={() => router.push(`/project/${project.id}/preview?view=${view}`)}
        />
      </View>

      <ActionSheet
        visible={menuFor != null}
        title={menuFor ? `Photo · ${formatDayShort(menuFor.capturedAt)}` : undefined}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Adjust alignment', onPress: () => router.push(`/project/${project.id}/adjust/${menuFor.id}`) },
                { label: 'Change date', onPress: () => setDatingFor(menuFor) },
                { label: 'Move earlier', onPress: () => useProjects.getState().movePhoto(project.id, menuFor.id, -1) },
                { label: 'Move later', onPress: () => useProjects.getState().movePhoto(project.id, menuFor.id, 1) },
                { label: 'Duplicate', onPress: () => useProjects.getState().duplicatePhoto(project.id, menuFor.id) },
                { label: 'Replace photo', onPress: () => replaceImage(menuFor) },
                ...otherViews.map((v) => ({
                  label: `Move to ${VIEW_LABELS[v]} view`,
                  onPress: () => useProjects.getState().setPhotoView(project.id, menuFor.id, v),
                })),
                { label: 'Remove from project', destructive: true, onPress: () => removePhoto(menuFor) },
              ]
            : []
        }
      />

      <DateSheet
        visible={datingFor != null}
        date={datingFor ? new Date(datingFor.capturedAt) : new Date()}
        onClose={() => setDatingFor(null)}
        onConfirm={(date) => {
          if (datingFor) useProjects.getState().setPhotoDate(project.id, datingFor.id, date.toISOString());
          setDatingFor(null);
        }}
      />

      <PromptSheet
        visible={renaming}
        title="Rename project"
        initialValue={project.name}
        onClose={() => setRenaming(false)}
        onConfirm={(name) => name.trim() && useProjects.getState().renameProject(project.id, name)}
      />
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
  indexBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  indexText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  flagBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: { color: '#3A2A00', fontSize: 12, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: spacing(5),
    right: spacing(5),
    bottom: spacing(6),
    gap: spacing(2.5),
  },
  footerRow: { flexDirection: 'row', gap: spacing(2.5) },
  flex: { flex: 1 },
});
