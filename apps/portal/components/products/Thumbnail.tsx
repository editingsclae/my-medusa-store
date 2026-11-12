import React from 'react';
import { ThumbnailType } from '../../lib/products';

interface ThumbnailProps {
  type?: ThumbnailType;
  src?: string | null;
}

export default function Thumbnail({ src }: ThumbnailProps) {
  if (src) {
    return (
      <img
        src={src}
        alt="Product thumbnail"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '8px',
        }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        background: '#EDEFF3',
        borderRadius: '8px',
      }}
    />
  );
}
