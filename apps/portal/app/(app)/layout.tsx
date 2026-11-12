import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { MerchantProvider } from '@/components/layout/MerchantContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MerchantProvider>
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#F6F7F9',
        fontFamily: 'Urbanist, sans-serif',
        color: '#111827',
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <TopBar />
        {children}
      </main>
    </div>
    </MerchantProvider>
  );
}
