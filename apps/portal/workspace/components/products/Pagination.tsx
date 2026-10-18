import React from 'react';

interface PaginationProps {
  showingText: string;
}

export default function Pagination({ showingText }: PaginationProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '32px 24px 24px 24px',
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 500, color: '#3F4654' }}>
        {showingText}
      </span>
      <nav aria-label="Pagination" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          style={{
            height: '40px',
            boxSizing: 'border-box',
            padding: '0 16px',
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            cursor: 'pointer',
          }}
        >
          Prev
        </button>
        <button
          type="button"
          style={{
            width: '40px',
            height: '40px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            cursor: 'pointer',
          }}
        >
          1
        </button>
        <button
          type="button"
          aria-current="page"
          style={{
            width: '40px',
            height: '40px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid var(--accent)',
            borderRadius: '10px',
            background: 'var(--accent)',
            fontSize: '16px',
            fontWeight: 500,
            color: '#FFFFFF',
            cursor: 'pointer',
          }}
        >
          2
        </button>
        <button
          type="button"
          aria-label="More pages"
          style={{
            width: '40px',
            height: '40px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            cursor: 'pointer',
          }}
        >
          ...
        </button>
        <button
          type="button"
          style={{
            width: '40px',
            height: '40px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            cursor: 'pointer',
          }}
        >
          8
        </button>
        <button
          type="button"
          style={{
            width: '40px',
            height: '40px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            cursor: 'pointer',
          }}
        >
          9
        </button>
        <button
          type="button"
          style={{
            height: '40px',
            boxSizing: 'border-box',
            padding: '0 16px',
            border: '1px solid #E3E6EB',
            borderRadius: '10px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#111827',
            cursor: 'pointer',
          }}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
