'use client';

import React from 'react';
import { TrashIcon } from '@/components/icons';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  itemCount?: number;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteModal({
  isOpen,
  title,
  itemName,
  itemCount = 1,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  const isBulk = itemCount > 1;
  const modalTitle = title ?? (isBulk ? `Delete ${itemCount} Products` : 'Delete Product');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(6, 10, 25, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={loading ? undefined : onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '440px',
          padding: '28px',
          boxSizing: 'border-box',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trash Icon Badge */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <TrashIcon style={{ width: '26px', height: '26px' }} />
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 700,
            color: '#111827',
          }}
        >
          {modalTitle}
        </h3>

        {/* Message */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#4B5563',
            lineHeight: '22px',
          }}
        >
          {isBulk ? (
            <>
              Are you sure you want to permanently delete these <strong>{itemCount}</strong> products? This action cannot be undone.
            </>
          ) : itemName ? (
            <>
              Are you sure you want to delete <strong>&ldquo;{itemName}&rdquo;</strong>? This item will be permanently removed from your catalog.
            </>
          ) : (
            'Are you sure you want to permanently delete this product? This action cannot be undone.'
          )}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            style={{
              flex: 1,
              height: '44px',
              borderRadius: '22px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 500,
              color: '#374151',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              flex: 1,
              height: '44px',
              borderRadius: '22px',
              border: 0,
              background: loading ? '#9CA3AF' : '#DC2626',
              fontSize: '15px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {loading ? 'Deleting...' : isBulk ? `Delete (${itemCount})` : 'Delete Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
