import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { colors, spacing, type } from '../src/theme';

const POINTS: { title: string; body: string }[] = [
  {
    title: 'Private by default',
    body: 'Your projects live only on this device. Nothing is uploaded unless you choose to share it.',
  },
  {
    title: 'On-device processing',
    body: 'Face and body landmarks are detected on your phone. Your photos are not sent to a server for alignment.',
  },
  {
    title: 'No identity recognition',
    body: 'Face detection is used only to position and align photos — never to identify you or anyone else.',
  },
  {
    title: 'Never used for AI training',
    body: 'Your photos are never used to train AI models.',
  },
  {
    title: 'Originals preserved',
    body: 'ThenNow works on its own copies. The photos in your camera roll are never modified or deleted.',
  },
  {
    title: 'Permission first',
    body: 'The camera and photo library are only accessed after you grant permission, and only for the actions you take.',
  },
];

export default function Privacy() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={type.h1}>Your privacy</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing(10), gap: spacing(4) }}>
        {POINTS.map((p) => (
          <View key={p.title} style={styles.card}>
            <Text style={type.h2}>{p.title}</Text>
            <Text style={[type.dim, { marginTop: spacing(1), lineHeight: 20 }]}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing(4),
  },
});
