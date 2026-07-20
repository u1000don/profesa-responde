import FaceDetection from '@react-native-ml-kit/face-detection';
import type { Point } from '../geometry/similarity';

/**
 * On-device face landmark detection via Google ML Kit.
 *
 * Landmarks are used exclusively for positioning and alignment — never for
 * identity recognition. All processing happens on the device.
 */
export interface FaceReading {
  /** Eye that appears further LEFT in the image (not the subject's anatomical left). */
  imageLeftEye: Point;
  imageRightEye: Point;
  noseBase?: Point;
  mouthBottom?: Point;
  box: { left: number; top: number; width: number; height: number };
  /** Head roll (tilt) in degrees, if reported. */
  roll?: number;
  /** Head yaw (left/right turn) in degrees, if reported. */
  yaw?: number;
}

type MaybePos = { position?: { x: number; y: number } } | undefined;

function pos(l: MaybePos): Point | undefined {
  if (l?.position && typeof l.position.x === 'number') {
    return { x: l.position.x, y: l.position.y };
  }
  return undefined;
}

export async function detectFace(
  uri: string,
  performanceMode: 'fast' | 'accurate' = 'accurate'
): Promise<FaceReading | null> {
  let faces: any[];
  try {
    faces = await FaceDetection.detect(uri, {
      performanceMode,
      landmarkMode: 'all',
      contourMode: 'none',
      classificationMode: 'none',
    });
  } catch {
    return null;
  }
  if (!faces?.length) return null;

  // Largest face wins — the subject is the focus of a progress photo.
  const face = faces.reduce((best, f) =>
    (f.frame?.width ?? 0) * (f.frame?.height ?? 0) >
    (best.frame?.width ?? 0) * (best.frame?.height ?? 0)
      ? f
      : best
  );

  const landmarks = face.landmarks ?? {};
  const eyeA = pos(landmarks.leftEye);
  const eyeB = pos(landmarks.rightEye);
  if (!eyeA || !eyeB) return null;

  const [imageLeftEye, imageRightEye] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];

  return {
    imageLeftEye,
    imageRightEye,
    noseBase: pos(landmarks.noseBase),
    mouthBottom: pos(landmarks.mouthBottom),
    box: {
      left: face.frame?.left ?? 0,
      top: face.frame?.top ?? 0,
      width: face.frame?.width ?? 0,
      height: face.frame?.height ?? 0,
    },
    roll: typeof face.rotationZ === 'number' ? face.rotationZ : undefined,
    yaw: typeof face.rotationY === 'number' ? face.rotationY : undefined,
  };
}
