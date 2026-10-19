'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../../lib/products';
import Thumbnail from './Thumbnail';
import StatusPill from './StatusPill';
import { EditIcon, TrashIcon, MoreVerticalIcon } from '../icons';

interface ProductRowProps {
  product: Product;
  checked: boolean;
  onToggle: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
  onEdit?: (id: string) => void;
}

export default function ProductRow({
  product,
  checked,
  onToggle,
  onDelete,
  onEdit,
}: ProductRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '38px minmax(220px, 1fr) 173px 156px 153px 160px 148px',
        alignItems: 'center',
        height: '64px',
        boxSizing: 'border-box',
        padding: '0 24px 0 26px',
        borderBottom: '1px solid #EDEFF3',
        fontSize: '16px',
        fontWeight: 500,
        color: '#111827',
        background: checked ? '#F9FAFB' : '#FFFFFF',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Checkbox */}
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(product.id)}
          aria-label={`Select ${product.name}`}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            width: '16px',
            height: '16px',
            margin: 0,
            boxSizing: 'border-box',
            border: checked ? '1.5px solid var(--accent)' : '1.5px solid #C9CED8',
            borderRadius: '4px',
            background: checked ? 'var(--accent)' : '#FFFFFF',
            cursor: 'pointer',
            backgroundImage: checked
              ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.2 5.2L6.8 10.6L3.8 7.6' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`
              : 'none',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      </span>

      {/* Product Title & Thumbnail */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '12px' }}>
        <span
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            background: '#F3F4F6',
            overflow: 'hidden',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #E5E7EB',
          }}
        >
          <Thumbnail type={product.thumb} src={product.thumbnailUrl} />
        </span>
        <span
          title={product.name}
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: 500,
          }}
        >
          {product.name}
        </span>
      </span>

      {/* Category */}
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#4B5563' }}>
        {product.category}
      </span>

      {/* Stock */}
      <span style={{ color: '#111827' }}>{product.stock}</span>

      {/* Price */}
      <span style={{ fontWeight: 600, color: '#111827' }}>{product.price}</span>

      {/* Status */}
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <StatusPill status={product.status} />
      </span>

      {/* Actions */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={menuRef}>
        {/* Edit Button */}
        <button
          type="button"
          aria-label={`Edit ${product.name}`}
          title="Edit / Modify Product"
          onClick={() => onEdit?.(product.id)}
          style={{
            width: '32px',
            height: '32px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: '#4B5563',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <EditIcon style={{ width: '15px', height: '15px' }} />
        </button>

        {/* Delete Button */}
        <button
          type="button"
          aria-label={`Delete ${product.name}`}
          title="Delete Product"
          onClick={() => onDelete?.(product.id, product.name)}
          style={{
            width: '32px',
            height: '32px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <TrashIcon style={{ width: '15px', height: '15px' }} />
        </button>

        {/* More Actions Menu Button */}
        <button
          type="button"
          aria-label={`More actions for ${product.name}`}
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: '32px',
            height: '32px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '8px',
            background: menuOpen ? '#F3F4F6' : '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <MoreVerticalIcon />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '40px',
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              padding: '6px',
              zIndex: 100,
              minWidth: '140px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit?.(product.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 0,
                background: 'transparent',
                color: '#374151',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <EditIcon style={{ width: '14px', height: '14px' }} />
              Modify Product
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete?.(product.id, product.name);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 0,
                background: 'transparent',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <TrashIcon style={{ width: '14px', height: '14px' }} />
              Delete Product
            </button>
          </div>
        )}
      </span>
    </div>
  );
}
