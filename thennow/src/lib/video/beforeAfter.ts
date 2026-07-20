import { ImageFormat, matchFont, Skia } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { referenceSize } from '../align/canonical';
import { formatDay } from '../dates';
import { freshCacheDir } from '../storage/photos';
import { sortedPhotos } from '../../store/projects';
import { loadSkImage, renderAlignedStill } from './renderStills';
import type { Project, ViewAngle } from '../../types';

/**
 * Compose the first and last aligned photos side by side into a single
 * "Then / Now" image for sharing.
 */
export async function renderBeforeAfter(project: Project, view: ViewAngle): Promise<string> {
  const photos = sortedPhotos(project, view);
  if (photos.length < 2) {
    throw new Error('Add at least two photos to create a before & after image.');
  }
  const first = photos[0];
  const last = photos[photos.length - 1];
  const { width, height } = referenceSize(project.format);
  const dir = await freshCacheDir('before-after');

  const firstPath = await renderAlignedStill({
    photo: first,
    format: project.format,
    showDate: false,
    outPath: `${dir}then.jpg`,
  });
  const lastPath = await renderAlignedStill({
    photo: last,
    format: project.format,
    showDate: false,
    outPath: `${dir}now.jpg`,
  });

  const gap = Math.round(width * 0.01);
  const outW = width * 2 + gap;
  const surface = Skia.Surface.MakeOffscreen(outW, height);
  if (!surface) throw new Error('Could not create rendering surface');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('black'));

  const paint = Skia.Paint();
  canvas.drawImage(await loadSkImage(firstPath), 0, 0, paint);
  canvas.drawImage(await loadSkImage(lastPath), width + gap, 0, paint);

  const font = matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
    fontSize: Math.round(height * 0.034),
    fontWeight: '700',
  });

  const drawLabel = (label: string, date: string, offsetX: number) => {
    const text = `${label} · ${date}`;
    const textWidth = font.measureText(text).width;
    const padX = height * 0.018;
    const padY = height * 0.012;
    const boxH = font.getSize() + padY * 2;
    const x = offsetX + width * 0.045;
    const y = height * 0.95 - boxH;
    const bg = Skia.Paint();
    bg.setColor(Skia.Color('rgba(0,0,0,0.55)'));
    canvas.drawRRect(
      Skia.RRectXY(Skia.XYWHRect(x, y, textWidth + padX * 2, boxH), boxH / 3, boxH / 3),
      bg
    );
    const fg = Skia.Paint();
    fg.setColor(Skia.Color('white'));
    canvas.drawText(text, x + padX, y + padY + font.getSize() * 0.82, fg, font);
  };

  drawLabel('Then', formatDay(first.capturedAt), 0);
  drawLabel('Now', formatDay(last.capturedAt), width + gap);

  const outPath = `${dir}ThenNow-before-after.jpg`;
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 92);
  await FileSystem.writeAsStringAsync(outPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outPath;
}
