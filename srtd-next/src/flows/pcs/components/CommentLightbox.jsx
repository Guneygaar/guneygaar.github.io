import React from 'react';
import { Lightbox } from '../../../core/ui';

export function CommentLightbox({ urls, startIndex = 0, onClose }) {
  return (
    <Lightbox
      urls={urls}
      startIndex={startIndex}
      onClose={onClose}
    />
  );
}
