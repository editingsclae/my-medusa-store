import React from 'react';
import { ThumbnailType } from '../../lib/products';

interface ThumbnailProps {
  type?: ThumbnailType;
  src?: string | null;
}

export default function Thumbnail({ type = 'shirt', src }: ThumbnailProps) {
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
  switch (type) {
    case 'shirt':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M12 6 15 5Q18 9 21 5L24 6 30 11 27 16 25 15V31H11V15L9 16 6 11Z" fill="#C3CBA2" stroke="#A9B286" strokeWidth="1" />
          <path d="M15 5 18 13 21 5" fill="none" stroke="#A9B286" strokeWidth="1" />
        </svg>
      );
    case 'sneaker':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M4 24Q4 19 9 18L13 20Q18 21 24 22Q32 23 32 27V29H4Z" fill="#F6F6F4" stroke="#A4A9B0" strokeWidth="1" />
          <rect x="4" y="27" width="28" height="3" rx="1.5" fill="#C8CCD2" />
          <path d="M9 18 11 24M14 20 16 25" stroke="#7C8794" strokeWidth="1" fill="none" />
        </svg>
      );
    case 'tee':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M12 7Q18 11 24 7L30 11 27 16 25 15V30H11V15L9 16 6 11Z" fill="#566678" stroke="#445467" strokeWidth="1" />
        </svg>
      );
    case 'top':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M10 6H14L18 14 22 6H26L28 12 26 17V30H10V17L8 12Z" fill="#B7CC45" stroke="#9DB237" strokeWidth="1" />
        </svg>
      );
    case 'sweat':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M12 6 15 5Q18 9 21 5L24 6 30 11 29 19 26 18V31H10V18L7 19 6 11Z" fill="#151B2B" stroke="#0B0F1A" strokeWidth="1" />
          <path d="M10 28H26" stroke="#2A3248" strokeWidth="1.5" />
        </svg>
      );
    case 'tank':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M13 5H15Q18 11 21 5H23L24 14 25 30H11L12 14Z" fill="#0E1118" />
        </svg>
      );
    case 'bag':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M13 14Q13 6 18 6T23 14" fill="none" stroke="#B7A98A" strokeWidth="1.6" />
          <path d="M9 14H27L28 31H8Z" fill="#E9DFC9" stroke="#CBBE9F" strokeWidth="1" />
        </svg>
      );
    case 'vest':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M12 5 18 15 24 5 27 9 26 31H10L9 9Z" fill="#F4F1EB" stroke="#D6D1C7" strokeWidth="1" />
          <path d="M18 15V31" stroke="#D6D1C7" strokeWidth="1" />
        </svg>
      );
    case 'blazer':
      return (
        <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M13 5 18 14 23 5 29 9 28 17 27 31H9L8 17 7 9Z" fill="#BCD3EA" stroke="#9DB9D6" strokeWidth="1" />
          <path d="M18 14V31" stroke="#9DB9D6" strokeWidth="1" />
        </svg>
      );
    default:
      return null;
  }
}
