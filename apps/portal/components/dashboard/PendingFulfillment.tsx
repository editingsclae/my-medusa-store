'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';

interface PendingFulfillmentProps {
  pendingCount?: number;
  fulfilledCount?: number;
}

export default function PendingFulfillment({
  pendingCount = 0,
  fulfilledCount = 0,
}: PendingFulfillmentProps) {
  const total = pendingCount + fulfilledCount;

  const stages = [
    { label: 'Awaiting shipping', count: pendingCount },
    { label: 'Fulfilled & shipped', count: fulfilledCount },
  ];

  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 'min(320px, 100%)',
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
          Pending fulfillment
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
          {pendingCount === 1 ? '1 order waiting' : `${pendingCount} orders waiting, by stage`}
        </p>
      </div>

      {/* Stages or Clean Empty State */}
      {total === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#6B7280' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
            All caught up!
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#9CA3AF' }}>
            No incoming orders currently require fulfillment.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {stages.map((stage) => {
            const widthPct = total > 0 ? ((stage.count / total) * 100).toFixed(2) : '0';
            return (
              <div key={stage.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    lineHeight: '24px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      color: '#111827',
                    }}
                  >
                    {stage.label}
                  </span>
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#111827',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {stage.count}
                  </span>
                </div>
                <div
                  style={{
                    height: '8px',
                    marginTop: '8px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: 'color-mix(in srgb, var(--accent) 12%, white)',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${widthPct}%`,
                      borderRadius: '0 4px 4px 0',
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Link */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <Link
          href="/orders"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'color-mix(in srgb, var(--accent) 82%, black)',
            textDecoration: 'none',
          }}
        >
          View orders
          <ArrowRightIcon />
        </Link>
      </div>
    </div>
  );
}
