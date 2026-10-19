'use client';

import React, { useEffect, useState } from 'react';
import { SearchIcon, ChevronDownIcon, LogoutIcon } from '../icons';
import { getMerchantMe, MerchantProfile, removeStoredToken } from '@/lib/medusa';

export default function TopBar() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    getMerchantMe()
      .then(setProfile)
      .catch(() => {});
  }, []);

  const merchantTitle = profile?.sales_channel?.name || profile?.user?.first_name || 'Merchant Store';
  const merchantEmail = profile?.user?.email || 'Logged In';

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
          placeholder="Search store catalog..."
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative' }}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Account menu"
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
          <span style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: '#FFFFFF', fontWeight: 600 }}>
            {merchantTitle.charAt(0).toUpperCase()}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '96px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: '18px' }}>{merchantTitle}</span>
            <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: '16px', color: '#8A90A0' }}>{merchantEmail}</span>
          </span>
          <ChevronDownIcon style={{ marginLeft: '8px', stroke: '#4B5263', strokeWidth: 2 }} />
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '56px',
              right: '68px',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              border: '1px solid #E5E7EB',
              padding: '8px',
              minWidth: '180px',
              zIndex: 100,
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Signed in as</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', wordBreak: 'break-all' }}>
                {merchantEmail}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                removeStoredToken();
                window.location.href = '/login';
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 12px',
                border: 0,
                background: 'transparent',
                color: '#EF4444',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: '8px',
              }}
            >
              <LogoutIcon />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
