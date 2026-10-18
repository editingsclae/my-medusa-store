'use client';

import React, { useState } from 'react';
import { PRODUCTS_DATA, Product } from '../../lib/products';
import ProductRow from './ProductRow';
import Pagination from './Pagination';
import { SearchIcon, SortIcon, ChevronDownIcon, UpDownSortIcon } from '../icons';

export default function ProductsCard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredProducts = PRODUCTS_DATA.filter((product) => {
    const q = searchQuery.toLowerCase();
    return product.name.toLowerCase().includes(q) || product.category.toLowerCase().includes(q);
  });

  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.includes(p.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <section
      style={{
        margin: '0 16px 17px 24px',
        background: '#FFFFFF',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '24px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '44px' }}>
          All Products
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              boxSizing: 'border-box',
              width: '264px',
              maxWidth: '100%',
              height: '44px',
              padding: '0 17px',
              border: '1px solid #E6E8EC',
              borderRadius: '22px',
              background: '#FFFFFF',
            }}
          >
            <SearchIcon style={{ flex: 'none', width: '18px', height: '18px', stroke: '#2A3040' }} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: '16px',
                color: '#111827',
              }}
            />
          </label>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              boxSizing: 'border-box',
              width: '130px',
              height: '44px',
              padding: '0 18px 0 17px',
              border: '1px solid #E6E8EC',
              borderRadius: '22px',
              background: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 500,
              color: '#4B5263',
              cursor: 'pointer',
            }}
          >
            <SortIcon />
            Sort by
            <ChevronDownIcon style={{ marginLeft: 'auto' }} />
          </button>
        </div>
      </div>

      {/* Table Wrapper */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '978px' }}>
          {/* Header Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '38px minmax(220px, 1fr) 173px 156px 153px 160px 128px',
              alignItems: 'center',
              height: '40px',
              boxSizing: 'border-box',
              padding: '0 24px 0 26px',
              background: '#F7F8FA',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1F2937',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                aria-label="Select all products"
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  width: '16px',
                  height: '16px',
                  margin: 0,
                  boxSizing: 'border-box',
                  border: allSelected ? '1.5px solid var(--accent)' : '1.5px solid #C9CED8',
                  borderRadius: '4px',
                  background: allSelected ? 'var(--accent)' : '#FFFFFF',
                  cursor: 'pointer',
                  backgroundImage: allSelected
                    ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.2 5.2L6.8 10.6L3.8 7.6' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`
                    : 'none',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Product <UpDownSortIcon />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Category <UpDownSortIcon />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Stock <UpDownSortIcon />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Price <UpDownSortIcon />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Status <UpDownSortIcon />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              Action <UpDownSortIcon />
            </span>
          </div>

          {/* Body Rows */}
          <div>
            {filteredProducts.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                checked={selectedIds.includes(product.id)}
                onToggle={handleToggle}
              />
            ))}
            {filteredProducts.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8A90A0', fontSize: '15px' }}>
                No products found matching your search.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Pagination */}
      <Pagination showingText={`Showing 2 to 9 of 128 entries`} />
    </section>
  );
}
