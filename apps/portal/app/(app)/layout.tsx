import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        minHeight: '100vh',
        background: '#F6F7F9',
        fontFamily: 'Urbanist, sans-serif',
        color: '#111827',
      }}
    >
      <Sidebar />
      <main style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        {children}
      </main>
    </div>
  );
}
