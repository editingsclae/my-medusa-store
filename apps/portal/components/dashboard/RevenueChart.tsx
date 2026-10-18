'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DailyRevenue } from '@/lib/dashboard-data';

interface RevenueChartProps {
  data: DailyRevenue[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart coordinates calculation
  const chartWidth = 700;
  const chartHeight = 250;
  const plotLeft = 44;
  const plotRight = 688;
  const plotTop = 12;
  const plotBottom = 212;
  const plotWidth = plotRight - plotLeft; // 644
  const plotHeight = plotBottom - plotTop; // 200

  const maxVal = useMemo(() => Math.max(...data.map((d) => d.revenue)), [data]);
  const yMax = useMemo(() => Math.ceil(maxVal / 2000) * 2000, [maxVal]);

  const points = useMemo(() => {
    return data.map((d, i) => {
      const x = plotLeft + i * (plotWidth / (data.length - 1));
      const y = plotBottom - (d.revenue / yMax) * plotHeight;
      return { x, y, data: d, index: i };
    });
  }, [data, yMax, plotWidth, plotHeight]);

  const lineD = useMemo(() => {
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}` : `${acc} L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${lineD} L ${last.x.toFixed(2)} ${plotBottom} L ${first.x.toFixed(2)} ${plotBottom} Z`;
  }, [lineD, points, plotBottom]);

  // Y-axis grid step steps: 0, 2000, 4000, ... yMax
  const ySteps = useMemo(() => {
    const steps: number[] = [];
    for (let s = 0; s <= yMax; s += 2000) {
      steps.push(s);
    }
    return steps;
  }, [yMax]);

  // Selected or hovered point
  const activePt = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length ? points[hoverIndex] : null;
  const lastPt = points[points.length - 1];

  // Handle pointer hover across the chart
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relX = (clientX / rect.width) * chartWidth;

    // Find nearest point
    let nearestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].x - relX);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = i;
      }
    }
    setHoverIndex(nearestIdx);
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHoverIndex((prev) => (prev === null ? points.length - 2 : Math.max(0, prev - 1)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHoverIndex((prev) => (prev === null ? points.length - 1 : Math.min(points.length - 1, prev + 1)));
    }
  };

  return (
    <div
      style={{
        flex: '2 1 0',
        minWidth: 'min(540px, 100%)',
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              lineHeight: '28px',
              color: '#111827',
            }}
          >
            Revenue overview
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: '20px',
              color: '#4B5263',
            }}
          >
            Daily revenue, last 30 days
          </p>
        </div>

        {/* Toggle Chart / Table */}
        <div
          style={{
            height: '40px',
            boxSizing: 'border-box',
            padding: '3px',
            gap: '2px',
            border: '1px solid #E6E8EC',
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            background: '#FFFFFF',
          }}
        >
          <button
            type="button"
            aria-pressed={viewMode === 'chart'}
            onClick={() => setViewMode('chart')}
            style={{
              height: '32px',
              padding: '0 14px',
              borderRadius: '16px',
              border: 0,
              fontSize: '14px',
              fontWeight: 500,
              background: viewMode === 'chart' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'chart' ? '#FFFFFF' : '#374151',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            Chart
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            style={{
              height: '32px',
              padding: '0 14px',
              borderRadius: '16px',
              border: 0,
              fontSize: '14px',
              fontWeight: 500,
              background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'table' ? '#FFFFFF' : '#374151',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            Table
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'chart' ? (
        <div
          ref={containerRef}
          tabIndex={0}
          role="img"
          aria-label="Daily revenue for the last 30 days, rising from about $3,500 to about $5,000 a day. Use left and right arrow keys to navigate days."
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (hoverIndex === null) setHoverIndex(points.length - 1);
          }}
          onBlur={() => setHoverIndex(null)}
          className="dl-chart"
          style={{
            position: 'relative',
            width: '100%',
            userSelect: 'none',
            cursor: 'crosshair',
          }}
        >
          {/* Absolutely-positioned Y-gridlines and Y-labels */}
          {ySteps.map((step) => {
            const topPct = ((plotBottom - (step / yMax) * plotHeight) / chartHeight) * 100;
            const labelText = step === 0 ? '$0' : `$${step / 1000}K`;
            return (
              <React.Fragment key={step}>
                {/* Hairline Grid */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${topPct}%`,
                    left: '6.286%',
                    right: '1.714%',
                    height: '1px',
                    background: '#EDEFF3',
                    pointerEvents: 'none',
                  }}
                />
                {/* Y-Label */}
                <span
                  style={{
                    position: 'absolute',
                    top: `${topPct}%`,
                    left: 0,
                    width: '5.2%',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#6B7280',
                    fontVariantNumeric: 'tabular-nums',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  {labelText}
                </span>
              </React.Fragment>
            );
          })}

          {/* X Labels at days 0, 7, 14, 21, 29 */}
          {[0, 7, 14, 21, 29].map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            const leftPct = (pt.x / chartWidth) * 100;
            let transform = 'translateX(-50%)';
            if (idx === 0) transform = 'none';
            if (idx === 29) transform = 'translateX(-100%)';

            return (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  top: '88.8%',
                  left: `${leftPct}%`,
                  transform,
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#6B7280',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {pt.data.dateShort}
              </span>
            );
          })}

          {/* SVG Canvas */}
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            aria-hidden="true"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
            }}
          >
            {/* Area */}
            <path d={areaD} fill="var(--accent)" fillOpacity="0.1" />

            {/* Line */}
            <path
              d={lineD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* End Point Dot */}
            {lastPt && (
              <>
                <circle cx={lastPt.x} cy={lastPt.y} r="6" fill="#FFFFFF" />
                <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="var(--accent)" />
              </>
            )}

            {/* Hover Dot */}
            {activePt && (
              <>
                <circle cx={activePt.x} cy={activePt.y} r="6" fill="#FFFFFF" />
                <circle cx={activePt.x} cy={activePt.y} r="4" fill="var(--accent)" />
              </>
            )}
          </svg>

          {/* End value label (hidden while hovering) */}
          {lastPt && hoverIndex === null && (
            <span
              style={{
                position: 'absolute',
                left: `${(lastPt.x / chartWidth) * 100}%`,
                top: `${(lastPt.y / chartHeight) * 100}%`,
                transform: 'translate(calc(-100% - 10px), calc(-100% - 6px))',
                fontSize: '12px',
                fontWeight: 600,
                color: '#111827',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {lastPt.data.revenueFormatted}
            </span>
          )}

          {/* Hover Crosshair & Tooltip */}
          {activePt && (
            <>
              {/* Vertical Crosshair Line */}
              <div
                style={{
                  position: 'absolute',
                  top: `${(plotTop / chartHeight) * 100}%`,
                  height: `${(plotHeight / chartHeight) * 100}%`,
                  left: `${(activePt.x / chartWidth) * 100}%`,
                  width: '1px',
                  background: '#C9CED8',
                  pointerEvents: 'none',
                }}
              />

              {/* Tooltip */}
              <div
                style={{
                  position: 'absolute',
                  left: `clamp(13%, ${(activePt.x / chartWidth) * 100}%, 87%)`,
                  top: `${(activePt.y / chartHeight) * 100}%`,
                  transform: 'translate(-50%, calc(-100% - 14px))',
                  background: '#FFFFFF',
                  border: '1px solid #E6E8EC',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  minWidth: '132px',
                  boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
                  {activePt.data.dateFull}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '2px',
                      background: 'var(--accent)',
                      borderRadius: '1px',
                      flex: 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                  >
                    {activePt.data.revenueFormatted}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
                    Revenue
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Table View */
        <div
          role="table"
          aria-label="Daily revenue table"
          style={{
            height: '250px',
            overflow: 'auto',
            border: '1px solid #EDEFF3',
            borderRadius: '12px',
          }}
        >
          {/* Sticky Header */}
          <div
            role="row"
            style={{
              position: 'sticky',
              top: 0,
              height: '40px',
              background: '#F7F8FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2937',
              borderBottom: '1px solid #EDEFF3',
              zIndex: 1,
            }}
          >
            <span role="columnheader">Date</span>
            <span role="columnheader" style={{ textAlign: 'right' }}>Revenue</span>
          </div>

          {/* Rows */}
          {data.map((row) => (
            <div
              key={row.dayIndex}
              role="row"
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                borderBottom: '1px solid #EDEFF3',
                fontSize: '14px',
                fontWeight: 500,
                color: '#111827',
              }}
            >
              <span role="cell">{row.dateFull}</span>
              <span
                role="cell"
                style={{
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.revenueFormatted}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
