import React from 'react';
import { ProductStatus } from '../../lib/products';

interface StatusPillProps {
  status: ProductStatus;
}

export default function StatusPill({ status }: StatusPillProps) {
  let border = '';
  let background = '';
  let color = '';

  switch (status) {
    case 'Active':
      border = '1px solid #9BDDB4';
      background = '#F2FBF6';
      color = '#1F9D55';
      break;
    case 'Pending':
      border = '1px solid #F7D9A3';
      background = '#FFFAF0';
      color = '#F2A33A';
      break;
    case 'Draft':
      border = '1px solid #9CC3FA';
      background = '#F1F7FF';
      color = '#3B82F6';
      break;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '74px',
        height: '28px',
        boxSizing: 'border-box',
        border,
        borderRadius: '14px',
        background,
        color,
        fontSize: '14px',
        fontWeight: 500,
      }}
    >
      {status}
    </span>
  );
}
