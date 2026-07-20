import type { ProjectMode, SubjectSummary } from '../../types';

/**
 * Compare the person's position in the live camera frame against the previous
 * photo and produce one simple instruction. Pure function — detection happens
 * elsewhere. Returns null when the subject is well aligned.
 */
export function computeGuidance(
  mode: ProjectMode,
  reference: SubjectSummary,
  current: SubjectSummary,
  /** True when the preview is mirrored (front camera). */
  mirrored: boolean
): string | null {
  const sizeRatio = current.size / Math.max(reference.size, 1e-6);
  if (sizeRatio < 0.86) return mode === 'face' ? 'Move closer' : 'Step closer';
  if (sizeRatio > 1.16) return mode === 'face' ? 'Move back' : 'Step back';

  const dx = current.cx - reference.cx;
  const dy = current.cy - reference.cy;
  const threshold = 0.06;

  if (Math.abs(dx) > threshold) {
    // Subject too far right in the image -> they should shift left (flip if mirrored).
    const shiftLeft = mirrored ? dx < 0 : dx > 0;
    return shiftLeft ? 'Step left' : 'Step right';
  }
  if (dy > threshold) return 'Raise the camera';
  if (dy < -threshold) return 'Lower the camera';

  if (mode === 'face') {
    const rollDiff = (current.roll ?? 0) - (reference.roll ?? 0);
    if (Math.abs(rollDiff) > 8) return 'Tilt your head level';
    const yawDiff = (current.yaw ?? 0) - (reference.yaw ?? 0);
    if (yawDiff > 12) return 'Turn slightly right';
    if (yawDiff < -12) return 'Turn slightly left';
  }

  return null;
}

export const ALIGNED_MESSAGE = 'Hold steady — aligned';
