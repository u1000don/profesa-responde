import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { makeId } from '../id';

/**
 * Every photo added to a project is copied into the app's private storage —
 * the user's original in the camera roll is never touched or modified.
 */
const projectDir = (projectId: string) =>
  `${FileSystem.documentDirectory}projects/${projectId}/photos/`;

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err)
    );
  });
}

export async function importPhotoFile(
  projectId: string,
  sourceUri: string
): Promise<{ uri: string; width: number; height: number }> {
  const dir = projectDir(projectId);
  await ensureDir(dir);
  // Re-encode so the EXIF orientation flag is baked into the pixels — the
  // landmark detector, Skia renderer and layout code must all agree on
  // which way is up.
  const context = ImageManipulator.manipulate(sourceUri);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });
  const dest = `${dir}${makeId()}.jpg`;
  await FileSystem.copyAsync({ from: saved.uri, to: dest });
  await FileSystem.deleteAsync(saved.uri, { idempotent: true }).catch(() => {});
  return { uri: dest, width: saved.width, height: saved.height };
}

export async function deleteProjectFiles(projectId: string) {
  const dir = `${FileSystem.documentDirectory}projects/${projectId}`;
  await FileSystem.deleteAsync(dir, { idempotent: true });
}

export async function deletePhotoFile(uri: string) {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/** Scratch space for rendered frames and exports; cleared per use. */
export async function freshCacheDir(name: string): Promise<string> {
  const dir = `${FileSystem.cacheDirectory}${name}/`;
  await FileSystem.deleteAsync(dir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

export async function copyIntoProject(projectId: string, sourceUri: string): Promise<string> {
  const dir = projectDir(projectId);
  await ensureDir(dir);
  const ext = sourceUri.split('.').pop()?.toLowerCase();
  const dest = `${dir}${makeId()}.${ext && ext.length <= 4 ? ext : 'bin'}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
