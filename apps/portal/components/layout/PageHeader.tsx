import React from 'react';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '28px 16px 20px 24px',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>
        {title}
      </h1>
      {children && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '17px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
