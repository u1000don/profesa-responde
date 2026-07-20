import {
  canvasUncovered,
  coverTransform,
  solveSimilarity,
  type Point,
} from '../geometry/similarity';
import { bodyTargets, faceTargets, referenceSize } from './canonical';
import { detectFace } from '../landmarks/face';
import { detectPose, midpoint } from '../landmarks/pose';
import type { AlignmentInfo, ProjectMode, SubjectSummary, VideoFormat } from '../../types';

export interface AutoAlignInput {
  uri: string;
  width: number;
  height: number;
  mode: ProjectMode;
  format: VideoFormat;
}

/** Above this fraction of the canvas diagonal, missing image coverage gets flagged. */
const UNCOVERED_LIMIT = 0.04;

/**
 * Detect landmarks in a photo and compute the similarity transform that puts
 * the person in the canonical position for the project format. Runs entirely
 * on the device. Falls back to a centered cover-crop (flagged) when detection
 * is not possible.
 */
export async function autoAlign(input: AutoAlignInput): Promise<AlignmentInfo> {
  const { width: outW, height: outH } = referenceSize(input.format);
  const reasons: string[] = [];

  const fallback = (reason: string): AlignmentInfo => ({
    transform: coverTransform(input.width, input.height, outW, outH),
    confidence: 0,
    flagged: true,
    reasons: [...reasons, reason],
  });

  let src: Point[] = [];
  let dst: Point[] = [];
  let summary: SubjectSummary | undefined;
  let spanForError = 1;

  if (input.mode === 'face') {
    const face = await detectFace(input.uri);
    if (!face) return fallback('No face detected');
    const targets = faceTargets(input.format);
    src = [face.imageLeftEye, face.imageRightEye];
    dst = [targets.leftEye, targets.rightEye];
    if (face.mouthBottom) {
      src.push(face.mouthBottom);
      dst.push(targets.mouthBottom);
    } else if (face.noseBase) {
      src.push(face.noseBase);
      dst.push(targets.noseBase);
    }
    const interEye = Math.hypot(
      face.imageRightEye.x - face.imageLeftEye.x,
      face.imageRightEye.y - face.imageLeftEye.y
    );
    spanForError = Math.hypot(targets.rightEye.x - targets.leftEye.x, 0);
    summary = {
      cx: (face.imageLeftEye.x + face.imageRightEye.x) / 2 / input.width,
      cy: (face.imageLeftEye.y + face.imageRightEye.y) / 2 / input.height,
      size: interEye / input.width,
      roll: face.roll,
      yaw: face.yaw,
    };
    if (interEye < input.width * 0.03) reasons.push('Face is very small in this photo');
  } else {
    const pose = await detectPose(input.uri);
    if (!pose) return fallback('No body pose detected');
    const lm = pose.landmarks;
    const targets = bodyTargets(input.format);
    const midShoulder = midpoint(lm.leftShoulder, lm.rightShoulder);
    const midHip = midpoint(lm.leftHip, lm.rightHip);
    const midAnkle = midpoint(lm.leftAnkle, lm.rightAnkle);
    const pairs: Array<[Point | undefined, Point]> = [
      [lm.nose, targets.nose],
      [midShoulder, targets.midShoulder],
      [midHip, targets.midHip],
      [midAnkle, targets.midAnkle],
    ];
    for (const [p, q] of pairs) {
      if (p) {
        src.push(p);
        dst.push(q);
      }
    }
    if (src.length < 3) return fallback('Not enough of the body is visible');
    spanForError = targets.midAnkle.y - targets.nose.y;
    if (lm.nose && midAnkle && midHip) {
      summary = {
        cx: midHip.x / input.width,
        cy: midHip.y / input.height,
        size: Math.abs(midAnkle.y - lm.nose.y) / input.height,
      };
    }
  }

  const solved = solveSimilarity(src, dst);
  if (!solved) return fallback('Could not compute alignment');

  // Residual error relative to the person's size in the frame.
  const relError = solved.rmse / (spanForError * 0.5);
  const confidence = Math.max(0, Math.min(1, 1 - relError));
  if (confidence < 0.5) reasons.push('Pose or angle differs too much from the target framing');

  const uncovered = canvasUncovered(solved.transform, input.width, input.height, outW, outH);
  if (uncovered > UNCOVERED_LIMIT) {
    reasons.push('Photo does not fill the frame after alignment');
  }

  return {
    transform: solved.transform,
    confidence,
    flagged: reasons.length > 0,
    reasons,
    summary,
  };
}
