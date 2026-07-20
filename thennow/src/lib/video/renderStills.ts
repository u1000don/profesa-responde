import { ImageFormat, matchFont, Skia, type SkCanvas, type SkImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { referenceSize } from '../align/canonical';
import { effectiveTransform } from '../align/effective';
import { formatDay } from '../dates';
import type { PhotoEntry, VideoFormat } from '../../types';

const RAD_TO_DEG = 180 / Math.PI;

export async function loadSkImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(`Could not decode image ${uri}`);
  return image;
}

function dateFont(canvasHeight: number) {
  const fontFamily = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
  return matchFont({
    fontFamily,
    fontSize: Math.round(canvasHeight * 0.028),
    fontWeight: '600',
  });
}

function drawDateLabel(canvas: SkCanvas, text: string, w: number, h: number) {
  const font = dateFont(h);
  const textWidth = font.measureText(text).width;
  const padX = h * 0.016;
  const padY = h * 0.012;
  const boxH = font.getSize() + padY * 2;
  const x = w * 0.045;
  const y = h * 0.955 - boxH;

  const bg = Skia.Paint();
  bg.setColor(Skia.Color('rgba(0,0,0,0.55)'));
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(x, y, textWidth + padX * 2, boxH), boxH / 3, boxH / 3),
    bg
  );

  const fg = Skia.Paint();
  fg.setColor(Skia.Color('white'));
  canvas.drawText(text, x + padX, y + padY + font.getSize() * 0.82, fg, font);
}

function drawAligned(
  canvas: SkCanvas,
  image: SkImage,
  photo: PhotoEntry,
  format: VideoFormat,
  scaleToOutput: number
) {
  const t = effectiveTransform(photo, format);
  const paint = Skia.Paint();
  canvas.save();
  canvas.scale(scaleToOutput, scaleToOutput);
  canvas.translate(t.tx, t.ty);
  canvas.rotate(t.rotation * RAD_TO_DEG, 0, 0);
  canvas.scale(t.scale, t.scale);
  canvas.drawImage(image, 0, 0, paint);
  canvas.restore();
}

async function writeSurfaceToFile(
  surface: ReturnType<typeof Skia.Surface.MakeOffscreen>,
  outPath: string
) {
  if (!surface) throw new Error('Could not create rendering surface');
  const snapshot = surface.makeImageSnapshot();
  const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
  await FileSystem.writeAsStringAsync(outPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Render a single photo, aligned into the project's canonical frame, as a
 * JPEG at full export resolution. Optionally stamps the capture date.
 */
export async function renderAlignedStill(options: {
  photo: PhotoEntry;
  format: VideoFormat;
  showDate: boolean;
  outPath: string;
}): Promise<string> {
  const { photo, format, showDate, outPath } = options;
  const { width, height } = referenceSize(format);
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('Could not create rendering surface');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('black'));

  const image = await loadSkImage(photo.uri);
  drawAligned(canvas, image, photo, format, 1);
  if (showDate) {
    drawDateLabel(canvas, formatDay(photo.capturedAt), width, height);
  }

  await writeSurfaceToFile(surface, outPath);
  return outPath;
}

/**
 * Render intermediate frames blending two already-rendered stills, used for
 * crossfade transitions. Returns the frame paths in order.
 */
export async function renderCrossfadeFrames(options: {
  fromPath: string;
  toPath: string;
  frameCount: number;
  format: VideoFormat;
  outDir: string;
  prefix: string;
}): Promise<string[]> {
  const { fromPath, toPath, frameCount, format, outDir, prefix } = options;
  const { width, height } = referenceSize(format);
  const from = await loadSkImage(fromPath);
  const to = await loadSkImage(toPath);

  const paths: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const alpha = (i + 1) / (frameCount + 1);
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) throw new Error('Could not create rendering surface');
    const canvas = surface.getCanvas();
    canvas.drawColor(Skia.Color('black'));

    const basePaint = Skia.Paint();
    canvas.drawImage(from, 0, 0, basePaint);
    const fadePaint = Skia.Paint();
    fadePaint.setAlphaf(alpha);
    canvas.drawImage(to, 0, 0, fadePaint);

    const outPath = `${outDir}${prefix}-${String(i).padStart(3, '0')}.jpg`;
    await writeSurfaceToFile(surface, outPath);
    paths.push(outPath);
  }
  return paths;
}
