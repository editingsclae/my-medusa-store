import React from 'react';
import { DownloadIcon, PlusIcon } from '../icons';

export default function PageHeader() {
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
        Products
      </h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '17px' }}>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxSizing: 'border-box',
            height: '44px',
            padding: '0 20px 0 16px',
            border: '1px solid #E6E8EC',
            borderRadius: '22px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          <DownloadIcon />
          Import
        </button>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            boxSizing: 'border-box',
            height: '44px',
            padding: '0 16px 0 18px',
            border: 0,
            borderRadius: '22px',
            background: 'var(--accent)',
            fontSize: '16px',
            fontWeight: 500,
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          <PlusIcon />
          Add Product
        </button>
      </div>
    </div>
  );
}
