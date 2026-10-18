import React from 'react';
import { PENDING_STAGES_DATA } from '@/lib/dashboard-data';
import { ArrowRightIcon } from '@/components/icons';

export default function PendingFulfillment() {
  const total = 37;

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
          37 orders waiting, by stage
        </p>
      </div>

      {/* Stages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {PENDING_STAGES_DATA.map((stage) => {
          const widthPct = ((stage.count / total) * 100).toFixed(2);
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

      {/* Footer Link */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        <a
          href="#"
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
        </a>
      </div>
    </div>
  );
}
