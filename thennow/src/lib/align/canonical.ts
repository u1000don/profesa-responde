import type { Point } from '../geometry/similarity';
import type { VideoFormat } from '../../types';

/**
 * Canonical target positions: where the person's landmarks should land on the
 * output canvas so every photo lines up. All screens and the exporter work in
 * these reference pixel coordinates and scale uniformly for display/export.
 */
export function referenceSize(format: VideoFormat): { width: number; height: number } {
  switch (format) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
      return { width: 1920, height: 1080 };
  }
}

export interface FaceTargets {
  leftEye: Point; // left in the image
  rightEye: Point;
  mouthBottom: Point;
  noseBase: Point;
}

export function faceTargets(format: VideoFormat): FaceTargets {
  const { width: w, height: h } = referenceSize(format);
  // Inter-eye distance controls how large the face appears in the frame.
  const d = 0.21 * Math.min(w, h);
  const eyeY = h * (format === '9:16' ? 0.42 : format === '1:1' ? 0.44 : 0.46);
  const cx = w / 2;
  return {
    leftEye: { x: cx - d / 2, y: eyeY },
    rightEye: { x: cx + d / 2, y: eyeY },
    noseBase: { x: cx, y: eyeY + 0.65 * d },
    mouthBottom: { x: cx, y: eyeY + 1.3 * d },
  };
}

export interface BodyTargets {
  nose: Point;
  midShoulder: Point;
  midHip: Point;
  midAnkle: Point;
}

export function bodyTargets(format: VideoFormat): BodyTargets {
  const { width: w, height: h } = referenceSize(format);
  // Vertical band the body should occupy (head near the top, feet near the bottom).
  const top = format === '16:9' ? 0.16 : 0.12;
  const bottom = format === '16:9' ? 0.9 : 0.92;
  const cx = w / 2;
  const span = bottom - top;
  return {
    nose: { x: cx, y: h * top },
    midShoulder: { x: cx, y: h * (top + span * 0.15) },
    midHip: { x: cx, y: h * (top + span * 0.5) },
    midAnkle: { x: cx, y: h * bottom },
  };
}
