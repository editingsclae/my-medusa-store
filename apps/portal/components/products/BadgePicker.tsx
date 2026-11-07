'use client';

import React from 'react';
import { BADGE_PRESETS, MAX_BADGE, isPreset, tidyBadge } from '@/lib/badge';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const chip = (on: boolean): React.CSSProperties => ({
  height: '36px',
  boxSizing: 'border-box',
  padding: '0 16px',
  borderRadius: '18px',
  border: on ? '1.5px solid #111827' : '1px solid #D1D5DB',
  background: on ? '#111827' : '#FFFFFF',
  color: on ? '#FFFFFF' : '#374151',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
});

// A small label on the product's picture in the store ("New", "Sale"...). The merchant
// picks one of the usual ones or types a short text; no badge is the default.
export default function BadgePicker({ value, onChange }: Props) {
  const none = value === '';
  return (
    <section
      style={{
        boxSizing: 'border-box',
        padding: '24px',
        background: '#FFFFFF',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
      aria-label="Badge"
      data-testid="badge-picker"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Badge</h2>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
          A small label on the product&apos;s picture in your store.
        </p>
      </div>

      <div role="group" aria-label="Badge choices" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button type="button" style={chip(none)} aria-pressed={none} onClick={() => onChange('')}>
          None
        </button>
        {BADGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            style={chip(value === preset)}
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      <div>
        <label
          htmlFor="p-badge"
          style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, lineHeight: '20px', color: '#1F2937' }}
        >
          Or write your own
        </label>
        <input
          id="p-badge"
          value={isPreset(value) ? '' : value}
          maxLength={MAX_BADGE}
          placeholder="For example: -20%"
          onChange={(e) => onChange(tidyBadge(e.target.value))}
          style={{
            width: '100%',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 17px',
            border: '1px solid #E6E8EC',
            borderRadius: '24px',
            background: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: '16px',
            color: '#111827',
            outline: 'none',
          }}
        />
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6B7280', textAlign: 'right' }}>
          {value.length} / {MAX_BADGE}
        </p>
      </div>

      {value !== '' && (
        <p style={{ margin: 0, fontSize: '14px', color: '#4B5263', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Shown as
          <span
            data-testid="badge-preview"
            style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', background: '#111827', color: '#FFFFFF', fontSize: '12px', fontWeight: 700 }}
          >
            {value.trim()}
          </span>
        </p>
      )}
    </section>
  );
}
