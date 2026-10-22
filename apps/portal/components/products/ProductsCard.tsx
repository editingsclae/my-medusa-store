'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PRODUCTS_DATA, Product } from '../../lib/products';
import { getMerchantProducts, deleteMerchantProduct, MerchantProduct } from '../../lib/medusa';
import ProductRow from './ProductRow';
import Pagination from './Pagination';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { SearchIcon, SortIcon, UpDownSortIcon, TrashIcon } from '../icons';

interface ProductsCardProps {
  refreshKey?: number;
}

type DeleteTarget =
  | { type: 'single'; id: string; name: string }
  | { type: 'bulk'; ids: string[] }
  | null;

export default function ProductsCard({ refreshKey = 0 }: ProductsCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [liveProducts, setLiveProducts] = useState<MerchantProduct[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);



  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await getMerchantProducts({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        q: searchQuery.trim() || undefined,
      });
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
  }, [page, searchQuery, refreshKey]);

  // Adjust page if totalCount changed (e.g. after deletion)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

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
          category: p.categories?.[0]?.name || p.subtitle || 'Uncategorized',
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

  const allSelected =
    displayProducts.length > 0 && displayProducts.every((p) => selectedIds.includes(p.id));

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

  // Trigger confirmation modal for single product delete
  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ type: 'single', id, name });
  };

  // Trigger confirmation modal for bulk delete
  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget({ type: 'bulk', ids: [...selectedIds] });
  };

  // Confirm delete handler (works for both single and bulk)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      if (deleteTarget.type === 'single') {
        await deleteMerchantProduct(deleteTarget.id);
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      } else {
        await Promise.all(deleteTarget.ids.map((id) => deleteMerchantProduct(id)));
        setSelectedIds([]);
      }
      setDeleteTarget(null);
      await fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product(s)');
    } finally {
      setDeleting(false);
    }
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search products"
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: '15px',
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
              fontSize: '15px',
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

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            margin: '0 24px 16px 24px',
            padding: '12px 18px',
            background: '#F5F3FF',
            border: '1px solid #DDD6FE',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {selectedIds.length}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#4C1D95' }}>
              product{selectedIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                color: '#4B5563',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={handleBulkDeleteClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #FCA5A5',
                background: '#EF4444',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <TrashIcon style={{ width: '14px', height: '14px' }} />
              Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Table Wrapper */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '978px' }}>
          {/* Header Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '38px minmax(220px, 1fr) 173px 156px 153px 160px 148px',
              alignItems: 'center',
              height: '42px',
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
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>
                Loading catalog products...
              </div>
            ) : displayProducts.length > 0 ? (
              displayProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  checked={selectedIds.includes(product.id)}
                  onToggle={handleToggle}
                  onDelete={handleDeleteClick}
                />
              ))
            ) : (
              <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
                  No products in your catalog yet.
                </p>
                <Link
                  href="/products/new"
                  style={{
                    display: 'inline-block',
                    marginTop: '16px',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    border: 0,
                    background: 'var(--accent)',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  + Add Your First Product
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={liveProducts !== null ? totalCount : displayProducts.length}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Confirmation Modal for Single / Bulk Delete */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'bulk' ? `Delete ${deleteTarget.ids.length} Products` : 'Delete Product'}
        itemName={deleteTarget?.type === 'single' ? deleteTarget.name : undefined}
        itemCount={deleteTarget?.type === 'bulk' ? deleteTarget.ids.length : 1}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />


    </section>
  );
}
