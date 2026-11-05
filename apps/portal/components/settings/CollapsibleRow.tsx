'use client';

import React from 'react';

export type RowBadge = { text: string; tone: 'muted' | 'warn' | 'error' | 'ok' };

const BADGE_COLORS: Record<RowBadge['tone'], { bg: string; fg: string }> = {
  muted: { bg: '#F1F2F4', fg: '#4B5263' },
  warn: { bg: '#FFF4E5', fg: '#B54708' },
  error: { bg: '#FEF2F2', fg: '#B42318' },
  ok: { bg: '#F2FBF6', fg: '#17803F' },
};

type Props = {
  // Used to link the header with the body
  id: string;
  open: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  thumb?: React.ReactNode;
  badges?: RowBadge[];
  // Buttons that stay visible when the row is closed (move, show or hide...)
  actions?: React.ReactNode;
  tone?: 'normal' | 'muted' | 'error';
  // The editing area. A row without one is a plain line.
  children?: React.ReactNode;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: '0 0 auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// One item of a list, shown as a single line. Opening it shows the fields.
export function CollapsibleRow({ id, open, onToggle, title, subtitle, thumb, badges, actions, tone = 'normal', children }: Props) {
  const bodyId = `${id}-body`;
  const hasBody = children !== undefined && children !== null && children !== false;

  const text = (
    <>
      {thumb}
      <span style={{ flex: '1 1 auto', minWidth: 0, textAlign: 'left', display: 'grid', gap: '2px' }}>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#111827',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 400,
              color: '#6B7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
      {badges?.map((b) => (
        <span
          key={b.text}
          style={{
            flex: '0 0 auto',
            padding: '3px 10px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            background: BADGE_COLORS[b.tone].bg,
            color: BADGE_COLORS[b.tone].fg,
          }}
        >
          {b.text}
        </span>
      ))}
    </>
  );

  return (
    <li
      style={{
        border: `1px solid ${tone === 'error' ? '#F5B5B5' : open ? '#C9CDD6' : '#E6E8EC'}`,
        borderRadius: '18px',
        background: tone === 'muted' ? '#F7F8FA' : '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px 8px 8px', flexWrap: 'wrap' }}>
        {hasBody ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggle}
            style={{
              flex: '1 1 220px',
              minWidth: 0,
              minHeight: '52px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0 8px',
              border: 0,
              background: 'transparent',
              fontFamily: 'inherit',
              color: '#4B5263',
              cursor: 'pointer',
            }}
          >
            {text}
            <Chevron open={open} />
          </button>
        ) : (
          <div style={{ flex: '1 1 220px', minWidth: 0, minHeight: '52px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
            {text}
          </div>
        )}
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>{actions}</div>}
      </div>
      {hasBody && open && (
        <div id={bodyId} style={{ padding: '16px', borderTop: '1px solid #E6E8EC', display: 'grid', gap: '14px' }}>
          {children}
        </div>
      )}
    </li>
  );
}
