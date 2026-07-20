import React from 'react';
import type { ViewStyle } from 'react-native';
import { Canvas, Fill, Group, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { referenceSize } from '../lib/align/canonical';
import { effectiveTransform } from '../lib/align/effective';
import type { PhotoEntry, VideoFormat } from '../types';

interface Props {
  photo: PhotoEntry;
  format: VideoFormat;
  width: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Renders a photo exactly as it will appear in the final video: transformed
 * into the project's canonical frame and cropped to the video format.
 */
export function AlignedPhoto({ photo, format, width, borderRadius = 0, style }: Props) {
  const ref = referenceSize(format);
  const height = (width * ref.height) / ref.width;
  const k = width / ref.width;
  const image = useImage(photo.uri);
  const t = effectiveTransform(photo, format);

  return (
    <Canvas
      style={[{ width, height, borderRadius, overflow: 'hidden', backgroundColor: '#000' }, style]}
    >
      <Fill color="black" />
      {image && (
        <Group
          transform={[
            { translateX: t.tx * k },
            { translateY: t.ty * k },
            { rotate: t.rotation },
            { scale: t.scale * k },
          ]}
        >
          <SkiaImage
            image={image}
            x={0}
            y={0}
            width={image.width()}
            height={image.height()}
            fit="none"
          />
        </Group>
      )}
    </Canvas>
  );
}
