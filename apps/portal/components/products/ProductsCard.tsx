'use client';

import React, { useState, useEffect } from 'react';
import { PRODUCTS_DATA, Product } from '../../lib/products';
import { getMerchantProducts, deleteMerchantProduct, MerchantProduct } from '../../lib/medusa';
import ProductRow from './ProductRow';
import Pagination from './Pagination';
import { SearchIcon, SortIcon, ChevronDownIcon, UpDownSortIcon, PlusIcon } from '../icons';

interface ProductsCardProps {
  refreshKey?: number;
  onOpenAddModal?: () => void;
}

export default function ProductsCard({ refreshKey = 0, onOpenAddModal }: ProductsCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [liveProducts, setLiveProducts] = useState<MerchantProduct[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await getMerchantProducts({ q: searchQuery.trim() || undefined });
      setLiveProducts(res.products || []);
      setTotalCount(res.count ?? res.products?.length ?? 0);
    } catch (err) {
      console.warn('Backend not reached or session pending, showing catalog preview');
      setLiveProducts(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, refreshKey]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMerchantProduct(id);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    }
  };

  // Convert live products or use fallback mock
  const displayProducts: Product[] = liveProducts !== null
    ? liveProducts.map((p) => {
        const variant = p.variants?.[0];
        const priceObj = variant?.prices?.[0];
        const formattedPrice = priceObj
          ? `${Number(priceObj.amount).toFixed(2)} ${priceObj.currency_code.toUpperCase()}`
          : 'N/A';
        const stockQty = variant?.inventory_quantity !== undefined ? String(variant.inventory_quantity) : '0';

        return {
          id: p.id,
          name: p.title,
          category: p.subtitle || 'Product',
          stock: stockQty,
          price: formattedPrice,
          status: p.status === 'published' ? 'Active' : 'Draft',
          thumb: 'shirt',
          thumbnailUrl: p.thumbnail || p.images?.[0]?.url || null,
        };
      })
    : PRODUCTS_DATA.filter((product) => {
        const q = searchQuery.toLowerCase();
        return product.name.toLowerCase().includes(q) || product.category.toLowerCase().includes(q);
      });

  const allSelected = displayProducts.length > 0 && displayProducts.every((p) => selectedIds.includes(p.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayProducts.map((p) => p.id));
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
          All Products ({liveProducts !== null ? totalCount : PRODUCTS_DATA.length})
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
              placeholder="Search products..."
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
            onClick={fetchProducts}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              boxSizing: 'border-box',
              height: '44px',
              padding: '0 16px',
              border: '1px solid #E6E8EC',
              borderRadius: '22px',
              background: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: '16px',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <SortIcon />
            Refresh
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
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A90A0' }}>
                Loading catalog products...
              </div>
            ) : displayProducts.length > 0 ? (
              displayProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  checked={selectedIds.includes(product.id)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
                  No products in your catalog yet.
                </p>
                {onOpenAddModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModal}
                    style={{
                      marginTop: '16px',
                      padding: '8px 20px',
                      borderRadius: '20px',
                      border: 0,
                      background: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Your First Product
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Pagination */}
      <Pagination showingText={`Showing ${displayProducts.length} of ${liveProducts !== null ? totalCount : displayProducts.length} entries`} />
    </section>
  );
}
