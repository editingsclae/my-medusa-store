import React from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

// One grey shimmering block. Size it like the thing it stands in for, so nothing
// moves when the real content arrives.
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className="sk"
      style={{ display: 'block', flex: 'none', width, height, borderRadius: radius, ...style }}
    />
  );
}

interface LoadingRegionProps {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

// Wraps a group of skeletons so a screen reader hears "Loading ..." once.
export function LoadingRegion({ label, children, style }: LoadingRegionProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={style}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// A white card in the portal's style, filled with skeletons while data loads.
export function SkeletonCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
