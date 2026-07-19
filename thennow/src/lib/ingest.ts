import * as ImagePicker from 'expo-image-picker';
import { autoAlign } from './align/autoAlign';
import { parseExifDate } from './dates';
import { importPhotoFile } from './storage/photos';
import { useProjects } from '../store/projects';
import type { PhotoEntry, ViewAngle } from '../types';

/**
 * Shared photo ingestion: copy the image into app-private storage (originals
 * are never modified), record its date, then run on-device auto-alignment.
 */
export async function addPhotoToProject(
  projectId: string,
  view: ViewAngle,
  sourceUri: string,
  capturedAt: string
): Promise<PhotoEntry | null> {
  const { projects, addPhoto, setAuto } = useProjects.getState();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;

  const file = await importPhotoFile(projectId, sourceUri);
  const entry = addPhoto(projectId, {
    uri: file.uri,
    width: file.width,
    height: file.height,
    view,
    capturedAt,
  });

  try {
    const auto = await autoAlign({
      uri: file.uri,
      width: file.width,
      height: file.height,
      mode: project.mode,
      format: project.format,
    });
    setAuto(projectId, entry.id, auto);
  } catch {
    // Photo stays 'pending'; the user can align it manually.
  }
  return entry;
}

/** Re-run automatic alignment for an existing photo (e.g. after replacing its image). */
export async function realignPhoto(projectId: string, photoId: string): Promise<void> {
  const { projects, setAuto } = useProjects.getState();
  const project = projects.find((p) => p.id === projectId);
  const photo = project?.photos.find((ph) => ph.id === photoId);
  if (!project || !photo) return;
  const auto = await autoAlign({
    uri: photo.uri,
    width: photo.width,
    height: photo.height,
    mode: project.mode,
    format: project.format,
  });
  setAuto(projectId, photoId, auto);
}

/**
 * Let the user pick photos from their library and add them to the project.
 * Dates come from EXIF when available. Returns how many photos were added.
 */
export async function importPhotosFromLibrary(
  projectId: string,
  view: ViewAngle,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 1,
    exif: true,
  });
  if (result.canceled) return 0;

  let done = 0;
  for (const asset of result.assets) {
    const exif = (asset.exif ?? {}) as Record<string, unknown>;
    const capturedAt =
      parseExifDate(exif.DateTimeOriginal) ??
      parseExifDate(exif.DateTimeDigitized) ??
      parseExifDate(exif.DateTime) ??
      new Date().toISOString();
    await addPhotoToProject(projectId, view, asset.uri, capturedAt);
    done++;
    onProgress?.(done, result.assets.length);
  }
  return done;
}

/** Pick a single photo to replace an existing entry's image. */
export async function pickReplacementImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled || !result.assets.length) return null;
  return result.assets[0].uri;
}
