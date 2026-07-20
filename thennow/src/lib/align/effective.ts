import { coverTransform, type SimilarityTransform } from '../geometry/similarity';
import { referenceSize } from './canonical';
import type { PhotoEntry, VideoFormat } from '../../types';

/**
 * The transform actually used for a photo: the user's manual adjustment wins,
 * then the automatic landmark alignment, then a centered cover-crop.
 */
export function effectiveTransform(photo: PhotoEntry, format: VideoFormat): SimilarityTransform {
  if (photo.manual) return photo.manual;
  if (photo.auto) return photo.auto.transform;
  const { width, height } = referenceSize(format);
  return coverTransform(photo.width, photo.height, width, height);
}
