import React from 'react';
import Link from 'next/link';
import { PlusIcon } from '../icons';

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
        <Link
          href="/products/new"
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
            textDecoration: 'none',
          }}
        >
          <PlusIcon />
          Add Product
        </Link>
      </div>
    </div>
  );
}
