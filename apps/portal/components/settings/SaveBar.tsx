'use client';

import React from 'react';
import { pillButton } from './styles';

type Props = {
  dirty: boolean;
  saving: boolean;
  // Something that must finish before saving, for example "Uploading an image..."
  busyText?: string | null;
  message: { kind: 'ok' | 'error'; text: string } | null;
  onSave: () => void;
};

// Stays at the bottom of the screen so Save is always in reach, however long the
// page is. The answer to Save is shown here too, next to the button.
export function SaveBar({ dirty, saving, busyText = null, message, onSave }: Props) {
  const disabled = saving || Boolean(busyText) || !dirty;
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        margin: '8px 16px 0 24px',
        padding: '12px 16px',
        background: '#FFFFFF',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -2px 12px rgba(17,24,39,0.08)',
        display: 'grid',
        gap: '10px',
      }}
    >
      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          style={{
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 500,
            border: `1px solid ${message.kind === 'ok' ? '#9BDDB4' : '#F5B5B5'}`,
            background: message.kind === 'ok' ? '#F2FBF6' : '#FEF2F2',
            color: message.kind === 'ok' ? '#17803F' : '#B42318',
          }}
        >
          {message.text}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
        <span
          style={{ flex: '1 1 160px', fontSize: '14px', fontWeight: 500, color: dirty || busyText ? '#B54708' : '#6B7280' }}
        >
          {busyText ? busyText : dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onSave}
          style={{
            ...pillButton,
            border: 0,
            background: 'var(--accent)',
            color: '#FFFFFF',
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
