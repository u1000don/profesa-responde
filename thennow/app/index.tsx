import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ActionSheet } from '../src/components/ActionSheet';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { ProjectCard } from '../src/components/ProjectCard';
import { PromptSheet } from '../src/components/PromptSheet';
import { Screen } from '../src/components/Screen';
import { useProjects } from '../src/store/projects';
import { colors, spacing, type } from '../src/theme';
import type { Project } from '../src/types';

export default function Home() {
  const projects = useProjects((s) => s.projects);
  const deleteProject = useProjects((s) => s.deleteProject);
  const renameProject = useProjects((s) => s.renameProject);
  const [menuFor, setMenuFor] = useState<Project | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);

  const confirmDelete = (project: Project) => {
    Alert.alert(
      'Delete this ThenNow?',
      `“${project.name}” and its photos will be removed from the app. Photos in your camera roll are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteProject(project.id) },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={type.title}>ThenNow</Text>
          <Text style={[type.dim, { marginTop: 2 }]}>See progress come to life.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Privacy"
          onPress={() => router.push('/privacy')}
          hitSlop={12}
        >
          <Text style={[type.small, { color: colors.textFaint }]}>Privacy</Text>
        </Pressable>
      </View>

      {projects.length === 0 ? (
        <EmptyState
          title="My ThenNow"
          message="Capture or import photos over time, and ThenNow will align them into one smooth progress video."
        >
          <Button title="Create a ThenNow" onPress={() => router.push('/project/new')} />
        </EmptyState>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: spacing(3), paddingBottom: spacing(24), paddingTop: spacing(2) }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={[type.small, { marginBottom: spacing(1) }]}>MY THENNOW</Text>}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => router.push(`/project/${item.id}`)}
              onLongPress={() => setMenuFor(item)}
            />
          )}
        />
      )}

      {projects.length > 0 && (
        <View style={styles.footer}>
          <Button title="Create a ThenNow" onPress={() => router.push('/project/new')} />
        </View>
      )}

      <ActionSheet
        visible={menuFor != null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={[
          {
            label: 'Rename',
            onPress: () => {
              if (menuFor) setRenaming(menuFor);
            },
          },
          {
            label: 'Delete project',
            destructive: true,
            onPress: () => {
              if (menuFor) confirmDelete(menuFor);
            },
          },
        ]}
      />

      <PromptSheet
        visible={renaming != null}
        title="Rename project"
        initialValue={renaming?.name ?? ''}
        placeholder="My ThenNow"
        onClose={() => setRenaming(null)}
        onConfirm={(name) => {
          if (renaming && name.trim()) renameProject(renaming.id, name);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: spacing(3),
    paddingBottom: spacing(4),
  },
  footer: {
    position: 'absolute',
    left: spacing(5),
    right: spacing(5),
    bottom: spacing(6),
  },
});
