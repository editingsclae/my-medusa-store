import React from 'react';
import { Product } from '../../lib/products';
import Thumbnail from './Thumbnail';
import StatusPill from './StatusPill';
import { EditIcon, TrashIcon, MoreVerticalIcon } from '../icons';

interface ProductRowProps {
  product: Product;
  checked: boolean;
  onToggle: (id: string) => void;
}

export default function ProductRow({ product, checked, onToggle }: ProductRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '38px minmax(220px, 1fr) 173px 156px 153px 160px 128px',
        alignItems: 'center',
        height: '64px',
        boxSizing: 'border-box',
        padding: '0 24px 0 26px',
        borderBottom: '1px solid #EDEFF3',
        fontSize: '16px',
        fontWeight: 500,
        color: '#111827',
      }}
    >
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

      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#F3F4F6',
            overflow: 'hidden',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Thumbnail type={product.thumb} />
        </span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.name}
        </span>
      </span>

      <span>{product.category}</span>
      <span>{product.stock}</span>
      <span>{product.price}</span>

      <span style={{ display: 'flex', alignItems: 'center' }}>
        <StatusPill status={product.status} />
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          type="button"
          aria-label={`Edit ${product.name}`}
          style={{
            width: '32px',
            height: '32px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          aria-label={`Delete ${product.name}`}
          style={{
            width: '32px',
            height: '32px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <TrashIcon />
        </button>
        <button
          type="button"
          aria-label={`More actions for ${product.name}`}
          style={{
            width: '32px',
            height: '32px',
            boxSizing: 'border-box',
            padding: 0,
            border: '1px solid #E3E6EB',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <MoreVerticalIcon />
        </button>
      </span>
    </div>
  );
}
