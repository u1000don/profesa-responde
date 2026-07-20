import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { AlignedPhoto } from './AlignedPhoto';
import { Chip } from './Chip';
import { colors, radius, spacing, type } from '../theme';
import { sortedPhotos } from '../store/projects';
import type { Project } from '../types';

interface Props {
  project: Project;
  onPress: () => void;
  onLongPress: () => void;
}

export function ProjectCard({ project, onPress, onLongPress }: Props) {
  const front = sortedPhotos(project, 'front');
  const cover =
    front[front.length - 1] ??
    (project.photos.length ? project.photos[project.photos.length - 1] : undefined);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.name}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.coverWrap}>
        {cover ? (
          <AlignedPhoto photo={cover} format={project.format} width={104} borderRadius={radius.sm} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>—</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={type.h2} numberOfLines={1}>
          {project.name}
        </Text>
        <Text style={[type.small, { marginTop: 2 }]}>
          {project.photos.length} photo{project.photos.length === 1 ? '' : 's'} · updated{' '}
          {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
        </Text>
        <View style={styles.chips}>
          <Chip label={project.mode === 'face' ? 'Face' : 'Full body'} tone="accent" />
          <Chip label={project.format} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(3),
    gap: spacing(3.5),
    alignItems: 'center',
  },
  coverWrap: { borderRadius: radius.sm, overflow: 'hidden' },
  placeholder: {
    width: 104,
    height: 130,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textFaint, fontSize: 24 },
  info: { flex: 1, gap: spacing(1) },
  chips: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(1) },
});
