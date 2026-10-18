import React from 'react';

interface SparklineProps {
  series: number[];
  ariaLabel: string;
}

export default function Sparkline({ series, ariaLabel }: SparklineProps) {
  const width = 96;
  const height = 36;
  const padding = 5;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min === 0 ? 1 : max - min;

  const usableWidth = width - 2 * padding;
  const usableHeight = height - 2 * padding;

  const points = series.map((val, i) => {
    const x = padding + (i / (series.length - 1)) * usableWidth;
    const y = padding + usableHeight - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}` : `${acc} L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }, '');

  const lastPt = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', flex: 'none' }}
    >
      <path
        d={pathD}
        fill="none"
        stroke="#C9CED8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastPt && (
        <>
          <circle cx={lastPt.x} cy={lastPt.y} r="6" fill="#FFFFFF" />
          <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="var(--accent)" />
        </>
      )}
    </svg>
  );
}
