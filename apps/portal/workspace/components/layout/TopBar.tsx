import React from 'react';
import { SearchIcon, BellIcon, ChevronDownIcon } from '../icons';

export default function TopBar() {
  return (
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        boxSizing: 'border-box',
        padding: '14px 18px 20px 24px',
        background: '#FFFFFF',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          boxSizing: 'border-box',
          width: '388px',
          maxWidth: '100%',
          height: '48px',
          padding: '0 15px',
          border: '1px solid #E6E8EC',
          borderRadius: '24px',
          background: '#FFFFFF',
        }}
      >
        <SearchIcon style={{ flex: 'none', width: '20px', height: '20px', stroke: '#2A3040' }} />
        <input
          type="text"
          placeholder="Search anything..."
          aria-label="Search anything"
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: '16px',
            color: '#111827',
          }}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <button
          type="button"
          aria-label="Account menu for Esther Howard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxSizing: 'border-box',
            height: '48px',
            padding: '0 16px 0 3px',
            border: '1px solid #E6E8EC',
            borderRadius: '24px',
            background: '#FFFFFF',
            textAlign: 'left',
            cursor: 'pointer',
            color: '#111827',
          }}
        >
          <span style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flex: 'none', display: 'block' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="Esther Howard" style={{ display: 'block' }}>
              <rect width="40" height="40" fill="#F4B63F" />
              <path d="M6 40C6 31 12 27.5 20 27.5S34 31 34 40Z" fill="#2E8B7A" />
              <rect x="17.5" y="21" width="5" height="8" fill="#8A4B2E" />
              <ellipse cx="20" cy="16" rx="7" ry="8" fill="#9A5834" />
              <path d="M12 16C11 8 16 5.5 20.5 5.5S29.5 9 28 16C26 12 21 11 12 16Z" fill="#1B1210" />
            </svg>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '96px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: '18px' }}>Esther Howard</span>
            <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '16px', color: '#8A90A0' }}>@estherhoward</span>
          </span>
          <ChevronDownIcon style={{ marginLeft: '8px', stroke: '#4B5263', strokeWidth: 2 }} />
        </button>

        <div style={{ width: '1px', height: '32px', background: '#E6E8EC' }} />

        <button
          type="button"
          aria-label="Notifications, 3 unread"
          style={{
            position: 'relative',
            width: '48px',
            height: '48px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E6E8EC',
            borderRadius: '50%',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#1F2937',
          }}
        >
          <BellIcon />
          <span
            style={{
              position: 'absolute',
              top: '1px',
              right: '1px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: '9px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            3
          </span>
        </button>
      </div>
    </header>
  );
}
