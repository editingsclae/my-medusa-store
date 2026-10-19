'use client';

import React from 'react';

interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  showingText?: string;
}

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 10,
  onPageChange,
  showingText,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), safeTotalPages);

  // Compute showing text
  const from = totalCount === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalCount);
  const displayText =
    showingText ??
    (totalCount === 0
      ? 'Showing 0 of 0 entries'
      : `Showing ${from} to ${to} of ${totalCount} entries`);

  // Build page numbers with smart ellipsis
  const pages: (number | string)[] = [];
  if (safeTotalPages <= 7) {
    for (let i = 1; i <= safeTotalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (current > 3) {
      pages.push('ellipsis-start');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(safeTotalPages - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < safeTotalPages - 2) {
      pages.push('ellipsis-end');
    }
    pages.push(safeTotalPages);
  }

  const handlePageClick = (page: number) => {
    if (page !== current && page >= 1 && page <= safeTotalPages) {
      onPageChange?.(page);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '24px 24px',
        borderTop: '1px solid #F3F4F6',
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 500, color: '#4B5563' }}>
        {displayText}
      </span>

      <nav aria-label="Pagination" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        {/* Prev Button */}
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => handlePageClick(current - 1)}
          aria-label="Previous page"
          style={{
            height: '38px',
            boxSizing: 'border-box',
            padding: '0 16px',
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 500,
            color: current <= 1 ? '#9CA3AF' : '#111827',
            cursor: current <= 1 ? 'not-allowed' : 'pointer',
            opacity: current <= 1 ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          Prev
        </button>

        {/* Page Buttons */}
        {pages.map((p, idx) => {
          if (typeof p === 'string') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9CA3AF',
                  fontSize: '14px',
                  userSelect: 'none',
                }}
              >
                ...
              </span>
            );
          }

          const isActive = p === current;
          return (
            <button
              key={p}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Page ${p}`}
              onClick={() => handlePageClick(p)}
              style={{
                width: '38px',
                height: '38px',
                boxSizing: 'border-box',
                padding: 0,
                border: isActive ? '1px solid var(--accent)' : '1px solid #E3E6EB',
                borderRadius: '10px',
                background: isActive ? 'var(--accent)' : '#FFFFFF',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FFFFFF' : '#111827',
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          disabled={current >= safeTotalPages}
          onClick={() => handlePageClick(current + 1)}
          aria-label="Next page"
          style={{
            height: '38px',
            boxSizing: 'border-box',
            padding: '0 16px',
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 500,
            color: current >= safeTotalPages ? '#9CA3AF' : '#111827',
            cursor: current >= safeTotalPages ? 'not-allowed' : 'pointer',
            opacity: current >= safeTotalPages ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
