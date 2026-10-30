'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/settings/delivery', label: 'Delivery' },
  { href: '/settings/appearance', label: 'Appearance' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '28px 16px 0 24px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>Settings</h1>
        <nav aria-label="Settings pages" style={{ display: 'flex', gap: '8px', margin: '16px 0 20px' }}>
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  height: '40px',
                  boxSizing: 'border-box',
                  padding: '0 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: active ? '1px solid var(--accent)' : '1px solid #D1D5DB',
                  background: active ? 'var(--accent)' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#374151',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
