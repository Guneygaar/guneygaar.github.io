// Plan-flow Lightbox. Thin alias over the shared core/ui Lightbox
// primitive to satisfy the spec's prop names (images / initialIndex)
// without duplicating the battle-tested primitive.
//
// Props:
//   images       : string[]  URLs. Required.
//   initialIndex : number    default 0
//   onClose      : () => void required

import React from 'react';
import { Lightbox as CoreLightbox } from '../../../core/ui/Lightbox.jsx';

export function Lightbox({ images, initialIndex = 0, onClose }) {
  return (
    <CoreLightbox
      urls={images}
      startIndex={initialIndex}
      onClose={onClose}
    />
  );
}
