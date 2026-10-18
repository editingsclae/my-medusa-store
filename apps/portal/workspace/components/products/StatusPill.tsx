import React from 'react';
import { ProductStatus } from '../../lib/products';

interface StatusPillProps {
  status: ProductStatus;
}

export default function StatusPill({ status }: StatusPillProps) {
  let styles = '';
  switch (status) {
    case 'Active':
      styles = 'border-[#9BDDB4] bg-[#F2FBF6] text-[#1F9D55]';
      break;
    case 'Pending':
      styles = 'border-[#F7D9A3] bg-[#FFFAF0] text-[#F2A33A]';
      break;
    case 'Draft':
      styles = 'border-[#9CC3FA] bg-[#F1F7FF] text-[#3B82F6]';
      break;
  }

  return (
    <span
      className={`inline-flex items-center justify-center w-[74px] h-[28px] box-border border rounded-[14px] text-[14px] font-medium ${styles}`}
    >
      {status}
    </span>
  );
}
