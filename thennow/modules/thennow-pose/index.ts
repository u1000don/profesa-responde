import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * JS interface for the local ML Kit pose detection module.
 *
 * The module is optional at runtime: in environments without the native code
 * (e.g. Expo Go) detection simply returns null and photos fall back to
 * manual alignment.
 */
export type PoseLandmarkName =
  | 'nose'
  | 'leftEye'
  | 'rightEye'
  | 'leftEar'
  | 'rightEar'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle';

export interface RawPoseLandmark {
  x: number;
  y: number;
  likelihood: number;
}

export interface RawPoseResult {
  width: number;
  height: number;
  landmarks: Partial<Record<PoseLandmarkName, RawPoseLandmark>>;
}

interface ThenNowPoseModule {
  detectPose(uri: string): Promise<RawPoseResult | null>;
}

const nativeModule = requireOptionalNativeModule<ThenNowPoseModule>('ThenNowPose');

export function isPoseDetectionAvailable(): boolean {
  return nativeModule != null;
}

export async function detectPoseNative(uri: string): Promise<RawPoseResult | null> {
  if (!nativeModule) return null;
  try {
    return await nativeModule.detectPose(uri);
  } catch {
    return null;
  }
}
