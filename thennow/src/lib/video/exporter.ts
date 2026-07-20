import { encodeVideo, type EncoderFrame } from '../../../modules/thennow-encoder';
import { referenceSize } from '../align/canonical';
import { freshCacheDir } from '../storage/photos';
import { sortedPhotos } from '../../store/projects';
import { renderAlignedStill, renderCrossfadeFrames } from './renderStills';
import type { Project, ViewAngle } from '../../types';

export interface ExportProgress {
  stage: 'photos' | 'transitions' | 'encoding';
  done: number;
  total: number;
}

export interface ExportResult {
  uri: string;
  durationMs: number;
  warnings: string[];
}

const TRANSITION_FPS = 30;
const MIN_HOLD_MS = 120;

/**
 * Full export pipeline: render every photo into the canonical frame at export
 * resolution, render crossfade frames between neighbors, then hand the timed
 * frame sequence to the native encoder. Everything runs on the device.
 */
export async function exportVideo(
  project: Project,
  view: ViewAngle,
  onProgress: (p: ExportProgress) => void
): Promise<ExportResult> {
  const photos = sortedPhotos(project, view);
  if (photos.length < 2) {
    throw new Error('Add at least two photos to export a progress video.');
  }

  const { settings, format } = project;
  const { width, height } = referenceSize(format);
  const warnings: string[] = [];
  const dir = await freshCacheDir('export');

  // 1. Aligned stills.
  const stillPaths: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    onProgress({ stage: 'photos', done: i, total: photos.length });
    const outPath = `${dir}still-${String(i).padStart(4, '0')}.jpg`;
    await renderAlignedStill({ photo: photos[i], format, showDate: settings.showDates, outPath });
    stillPaths.push(outPath);
  }
  onProgress({ stage: 'photos', done: photos.length, total: photos.length });

  // 2. Timed frame sequence with optional crossfades.
  const crossfade = settings.transition === 'crossfade' && settings.crossfadeMs > 0;
  const fadeMs = crossfade ? settings.crossfadeMs : 0;
  const fadeFrameCount = crossfade ? Math.max(2, Math.round((fadeMs / 1000) * TRANSITION_FPS)) : 0;

  const frames: EncoderFrame[] = [];
  for (let i = 0; i < photos.length; i++) {
    let hold = settings.photoDurationMs;
    if (i === 0) hold += settings.holdFirstMs;
    if (i === photos.length - 1) hold += settings.holdLastMs;
    // Each side of a crossfade eats into the neighboring holds.
    const fadesTouching = (i > 0 ? fadeMs / 2 : 0) + (i < photos.length - 1 ? fadeMs / 2 : 0);
    hold = Math.max(MIN_HOLD_MS, hold - fadesTouching);
    frames.push({ path: stillPaths[i], durationMs: hold });

    if (crossfade && i < photos.length - 1) {
      onProgress({ stage: 'transitions', done: i, total: photos.length - 1 });
      const fadeFrames = await renderCrossfadeFrames({
        fromPath: stillPaths[i],
        toPath: stillPaths[i + 1],
        frameCount: fadeFrameCount,
        format,
        outDir: dir,
        prefix: `fade-${String(i).padStart(4, '0')}`,
      });
      const frameMs = fadeMs / fadeFrames.length;
      for (const path of fadeFrames) {
        frames.push({ path, durationMs: frameMs });
      }
    }
  }

  // 3. Encode.
  onProgress({ stage: 'encoding', done: 0, total: frames.length });
  const outputPath = `${dir}ThenNow-${Date.now()}.mp4`;
  const result = await encodeVideo(
    {
      width,
      height,
      frames,
      outputPath,
      audioPath: settings.musicUri,
    },
    (e) => onProgress({ stage: 'encoding', done: e.framesDone, total: e.framesTotal })
  );

  if (settings.musicUri && !result.audioIncluded) {
    warnings.push('The selected music could not be included (unsupported format). Try an AAC/M4A file.');
  }

  const uri = result.path.startsWith('file://') ? result.path : `file://${result.path}`;
  return { uri, durationMs: result.durationMs, warnings };
}
