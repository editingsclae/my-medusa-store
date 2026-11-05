'use client';

import React from 'react';

export type SettingsTab<T extends string> = {
  id: T;
  label: string;
  // A short count shown next to the label, for example "2 / 3"
  badge?: string;
};

type Props<T extends string> = {
  // Used to link each tab with its panel
  idPrefix: string;
  label: string;
  tabs: Array<SettingsTab<T>>;
  active: T;
  onChange: (id: T) => void;
};

export function panelProps(idPrefix: string, id: string) {
  return {
    role: 'tabpanel' as const,
    id: `${idPrefix}-panel-${id}`,
    'aria-labelledby': `${idPrefix}-tab-${id}`,
  };
}

// A row of tabs that shows one section of a settings page at a time. It scrolls
// sideways on a narrow screen instead of wrapping onto several lines.
export function SettingsTabs<T extends string>({ idPrefix, label, tabs, active, onChange }: Props<T>) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`${idPrefix}-tab-${tabs[next].id}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      style={{
        display: 'flex',
        gap: '4px',
        padding: '0 12px',
        borderBottom: '1px solid #E6E8EC',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            style={{
              height: '52px',
              padding: '0 14px',
              border: 0,
              borderBottom: `3px solid ${selected ? 'var(--accent)' : 'transparent'}`,
              marginBottom: '-1px',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: '15px',
              fontWeight: selected ? 700 : 500,
              color: selected ? '#111827' : '#6B7280',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              flex: '0 0 auto',
            }}
          >
            {tab.label}
            {tab.badge && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: '#F1F2F4',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B5263',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
