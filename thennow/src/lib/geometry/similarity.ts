/**
 * 2D similarity transform (uniform scale + rotation + translation):
 *
 *   q = s * R(rotation) * p + (tx, ty)
 *
 * Rotation is in radians. Transforms map photo pixel coordinates into the
 * project's reference canvas (see align/canonical.ts).
 */
export interface Point {
  x: number;
  y: number;
}

export interface SimilarityTransform {
  scale: number;
  rotation: number;
  tx: number;
  ty: number;
}

export const IDENTITY: SimilarityTransform = { scale: 1, rotation: 0, tx: 0, ty: 0 };

export function applyTransform(t: SimilarityTransform, p: Point): Point {
  const c = Math.cos(t.rotation) * t.scale;
  const s = Math.sin(t.rotation) * t.scale;
  return { x: c * p.x - s * p.y + t.tx, y: s * p.x + c * p.y + t.ty };
}

export function invertTransform(t: SimilarityTransform): SimilarityTransform {
  const scale = 1 / t.scale;
  const rotation = -t.rotation;
  const c = Math.cos(rotation) * scale;
  const s = Math.sin(rotation) * scale;
  return {
    scale,
    rotation,
    tx: -(c * t.tx - s * t.ty),
    ty: -(s * t.tx + c * t.ty),
  };
}

/**
 * Least-squares fit of a similarity transform mapping src[i] -> dst[i]
 * (closed-form Umeyama solution restricted to 2D, no reflection).
 */
export function solveSimilarity(
  src: Point[],
  dst: Point[]
): { transform: SimilarityTransform; rmse: number } | null {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return null;

  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    sx += src[i].x; sy += src[i].y;
    dx += dst[i].x; dy += dst[i].y;
  }
  sx /= n; sy /= n; dx /= n; dy /= n;

  let a = 0, b = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const px = src[i].x - sx, py = src[i].y - sy;
    const qx = dst[i].x - dx, qy = dst[i].y - dy;
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    den += px * px + py * py;
  }
  if (den < 1e-9) return null;

  const A = a / den;
  const B = b / den;
  const scale = Math.hypot(A, B);
  if (scale < 1e-9) return null;
  const rotation = Math.atan2(B, A);

  const c = Math.cos(rotation) * scale;
  const s = Math.sin(rotation) * scale;
  const transform: SimilarityTransform = {
    scale,
    rotation,
    tx: dx - (c * sx - s * sy),
    ty: dy - (s * sx + c * sy),
  };

  let err = 0;
  for (let i = 0; i < n; i++) {
    const q = applyTransform(transform, src[i]);
    err += (q.x - dst[i].x) ** 2 + (q.y - dst[i].y) ** 2;
  }
  return { transform, rmse: Math.sqrt(err / n) };
}

/** Center-crop ("cover") fit used as a fallback when landmarks are unavailable. */
export function coverTransform(
  imgW: number,
  imgH: number,
  outW: number,
  outH: number,
  zoom = 1
): SimilarityTransform {
  const scale = Math.max(outW / imgW, outH / imgH) * zoom;
  return {
    scale,
    rotation: 0,
    tx: (outW - imgW * scale) / 2,
    ty: (outH - imgH * scale) / 2,
  };
}

/**
 * How much of the output canvas is NOT covered by the transformed image.
 * Returns the worst-case overhang of the canvas corners outside the image,
 * as a fraction of the canvas diagonal (0 = fully covered).
 */
export function canvasUncovered(
  t: SimilarityTransform,
  imgW: number,
  imgH: number,
  outW: number,
  outH: number
): number {
  const inv = invertTransform(t);
  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: 0, y: outH },
    { x: outW, y: outH },
  ];
  let worst = 0;
  for (const corner of corners) {
    const p = applyTransform(inv, corner);
    const ox = Math.max(0 - p.x, p.x - imgW, 0);
    const oy = Math.max(0 - p.y, p.y - imgH, 0);
    // overhang measured in canvas pixels
    worst = Math.max(worst, Math.hypot(ox, oy) * t.scale);
  }
  return worst / Math.hypot(outW, outH);
}
