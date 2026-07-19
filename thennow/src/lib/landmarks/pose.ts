import type { Point } from '../geometry/similarity';
import { detectPoseNative, type PoseLandmarkName } from '../../../modules/thennow-pose';

/**
 * On-device body pose detection via Google ML Kit (local native module).
 * Used only to position and align the body across photos.
 */
export interface PoseReading {
  landmarks: Partial<Record<PoseLandmarkName, Point & { likelihood: number }>>;
}

const MIN_LIKELIHOOD = 0.55;

export async function detectPose(uri: string): Promise<PoseReading | null> {
  const raw = await detectPoseNative(uri);
  if (!raw || !raw.landmarks) return null;
  const landmarks: PoseReading['landmarks'] = {};
  let usable = 0;
  for (const [name, lm] of Object.entries(raw.landmarks)) {
    if (lm && lm.likelihood >= MIN_LIKELIHOOD) {
      landmarks[name as PoseLandmarkName] = lm;
      usable++;
    }
  }
  return usable >= 4 ? { landmarks } : null;
}

export function midpoint(a?: Point, b?: Point): Point | undefined {
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return a ?? b;
}
