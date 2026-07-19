import type { SimilarityTransform } from './lib/geometry/similarity';

export type ProjectMode = 'face' | 'body';
export type VideoFormat = '9:16' | '1:1' | '16:9';
export type ViewAngle = 'front' | 'side' | 'back';
export type TransitionStyle = 'cut' | 'crossfade';

/**
 * Normalized summary of where the person sits in a photo (all values 0..1,
 * relative to image dimensions). Used to compare a live camera frame against
 * the previous photo and produce guidance like "move closer".
 */
export interface SubjectSummary {
  cx: number;
  cy: number;
  /** Face mode: inter-eye distance / image width. Body mode: nose-to-ankle span / image height. */
  size: number;
  /** Head roll in degrees, when available (face mode only). */
  roll?: number;
  /** Head yaw in degrees, when available (face mode only). */
  yaw?: number;
}

export interface AlignmentInfo {
  /** Maps photo pixel coordinates into the reference canvas for the project format. */
  transform: SimilarityTransform;
  /** 0..1 — how well the landmarks fit the canonical positions. */
  confidence: number;
  flagged: boolean;
  reasons: string[];
  /** Normalized subject position, kept as the reference for guided capture. */
  summary?: SubjectSummary;
}

export type PhotoStatus = 'pending' | 'aligned' | 'flagged' | 'manual';

export interface PhotoEntry {
  id: string;
  /** App-private copy of the image. The user's original is never modified. */
  uri: string;
  width: number;
  height: number;
  view: ViewAngle;
  /** ISO timestamp shown in the timeline; editable by the user. */
  capturedAt: string;
  addedAt: string;
  /** Timeline position. Defaults to the capture date epoch; edited by reordering. */
  sortKey: number;
  auto?: AlignmentInfo;
  /** When set, overrides the automatic transform. */
  manual?: SimilarityTransform;
  status: PhotoStatus;
}

export interface ProjectSettings {
  photoDurationMs: number;
  transition: TransitionStyle;
  crossfadeMs: number;
  holdFirstMs: number;
  holdLastMs: number;
  showDates: boolean;
  musicUri?: string;
  musicName?: string;
}

export interface Project {
  id: string;
  name: string;
  mode: ProjectMode;
  format: VideoFormat;
  createdAt: string;
  updatedAt: string;
  photos: PhotoEntry[];
  settings: ProjectSettings;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  photoDurationMs: 600,
  transition: 'crossfade',
  crossfadeMs: 350,
  holdFirstMs: 1000,
  holdLastMs: 1500,
  showDates: true,
};

export const VIEW_ANGLES: ViewAngle[] = ['front', 'side', 'back'];

export const VIEW_LABELS: Record<ViewAngle, string> = {
  front: 'Front',
  side: 'Side',
  back: 'Back',
};
