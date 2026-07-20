import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * JS interface for the local MP4 encoder module.
 *
 * Turns a timed sequence of still frames (already rendered and aligned by the
 * Skia pipeline) into an H.264 MP4, using MediaCodec/MediaMuxer on Android and
 * AVAssetWriter on iOS. Optionally muxes in an audio track.
 */
export interface EncoderFrame {
  /** Absolute file path or file:// URI of a frame image sized exactly width x height. */
  path: string;
  /** How long this frame stays on screen. */
  durationMs: number;
}

export interface EncodeOptions {
  width: number;
  height: number;
  frames: EncoderFrame[];
  /** Absolute output path for the .mp4 file. */
  outputPath: string;
  /** Optional music track. AAC (m4a/mp4) works everywhere; other codecs may be skipped. */
  audioPath?: string;
  bitRate?: number;
}

export interface EncodeResult {
  path: string;
  audioIncluded: boolean;
  durationMs: number;
}

export interface EncodeProgressEvent {
  framesDone: number;
  framesTotal: number;
}

interface ThenNowEncoderModule {
  encode(options: EncodeOptions): Promise<EncodeResult>;
  addListener?(event: 'onProgress', listener: (e: EncodeProgressEvent) => void): { remove(): void };
}

const nativeModule = requireOptionalNativeModule<ThenNowEncoderModule>('ThenNowEncoder');

export function isEncoderAvailable(): boolean {
  return nativeModule != null;
}

export async function encodeVideo(
  options: EncodeOptions,
  onProgress?: (e: EncodeProgressEvent) => void
): Promise<EncodeResult> {
  if (!nativeModule) {
    throw new Error(
      'Video encoder unavailable. ThenNow needs a development or production build (not Expo Go).'
    );
  }
  let subscription: { remove(): void } | undefined;
  if (onProgress && typeof nativeModule.addListener === 'function') {
    subscription = nativeModule.addListener('onProgress', onProgress);
  }
  try {
    return await nativeModule.encode(options);
  } finally {
    subscription?.remove();
  }
}
