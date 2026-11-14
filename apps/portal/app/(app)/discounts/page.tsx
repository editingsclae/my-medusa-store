'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ConfirmDeleteModal from '@/components/products/ConfirmDeleteModal';
import Thumbnail from '@/components/products/Thumbnail';
import { Skeleton, LoadingRegion } from '@/components/ui/Skeleton';
import { useMerchant } from '@/components/layout/MerchantContext';
import { PlusIcon } from '@/components/icons';
import {
  createMerchantDiscount,
  deleteMerchantDiscount,
  getMerchantDiscounts,
  getMerchantProducts,
  MerchantDiscount,
  MerchantProduct,
} from '@/lib/medusa';
import { discountedPrice, formatAmount, periodText, priceRange } from '@/lib/discounts';

const QUICK_PERCENTS = [10, 15, 20, 25, 30, 50];

const STATUS_STYLE: Record<MerchantDiscount['status'], { label: string; background: string; color: string }> = {
  active: { label: 'Active', background: '#E8F7EE', color: '#17803F' },
  scheduled: { label: 'Scheduled', background: '#EEF2FF', color: '#3730A3' },
  ended: { label: 'Ended', background: '#F3F4F6', color: '#4B5563' },
};

const card: React.CSSProperties = {
  margin: '0 16px 17px 24px',
  background: '#FFFFFF',
  borderRadius: '24px',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const inputStyle: React.CSSProperties = {
  height: '44px',
  boxSizing: 'border-box',
  padding: '0 17px',
  border: '1px solid #E6E8EC',
  borderRadius: '22px',
  background: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: '16px',
  color: '#111827',
  outline: 'none',
};

const labelStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#111827' };
const hintStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: '13px', color: '#6B7280' };

function todayInput(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });
}

export default function DiscountsPage() {
  const { profile } = useMerchant();
  const currency = profile?.currency_code || '';

  const [discounts, setDiscounts] = useState<MerchantDiscount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [percent, setPercent] = useState<number | ''>(20);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toRemove, setToRemove] = useState<MerchantDiscount | null>(null);
  const [removing, setRemoving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await getMerchantDiscounts();
      setDiscounts(res.discounts || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your discounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The product list for the picker follows the search box
  useEffect(() => {
    if (!showForm) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const res = await getMerchantProducts({ limit: 100, q: search.trim() || undefined });
        if (alive) setProducts(res.products || []);
      } catch (err) {
        if (alive) setProductsError(err instanceof Error ? err.message : 'Could not load your products.');
      } finally {
        if (alive) setProductsLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [showForm, search]);

  const percentValid = typeof percent === 'number' && Number.isInteger(percent) && percent >= 1 && percent <= 90;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleIds = useMemo(() => products.map((p) => p.id), [products]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setPercent(20);
    setStartsAt('');
    setEndsAt('');
    setSelected(new Set());
    setSearch('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!percentValid || typeof percent !== 'number') {
      setError('Enter a whole percentage from 1 to 90.');
      return;
    }
    if (selected.size === 0) {
      setError('Choose at least one product.');
      return;
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setError('The end date must be after the start date.');
      return;
    }

    setSaving(true);
    try {
      await createMerchantDiscount({
        percent,
        product_ids: [...selected],
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
      });
      setNotice(`${percent}% off is set on ${selected.size} ${selected.size === 1 ? 'product' : 'products'}.`);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the discount.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteMerchantDiscount(toRemove.id);
      setNotice(`The ${toRemove.percent}% discount was removed. Its products are back to their normal price.`);
      setToRemove(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the discount.');
      setToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <PageHeader title="Discounts">
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError(null);
              setNotice(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              height: '44px',
              padding: '0 16px 0 18px',
              border: 0,
              borderRadius: '22px',
              background: 'var(--accent)',
              fontFamily: 'inherit',
              fontSize: '16px',
              fontWeight: 500,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <PlusIcon />
            New discount
          </button>
        )}
      </PageHeader>

      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          style={{
            margin: '0 16px 16px 24px',
            padding: '10px 16px',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: 500,
            border: `1px solid ${error ? '#F5B5B5' : '#9BDDB4'}`,
            background: error ? '#FEF2F2' : '#F2FBF6',
            color: error ? '#B42318' : '#17803F',
          }}
        >
          {error || notice}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} style={{ ...card, padding: '24px', gap: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>New discount</h2>
            <p style={{ ...hintStyle, fontSize: '14px' }}>
              Shoppers see the normal price crossed out next to the lower price on the products you choose.
            </p>
          </div>

          <div>
            <div style={labelStyle}>How much off</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              {QUICK_PERCENTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPercent(value)}
                  aria-pressed={percent === value}
                  style={{
                    height: '40px',
                    padding: '0 18px',
                    borderRadius: '20px',
                    border: percent === value ? '1px solid var(--accent)' : '1px solid #E6E8EC',
                    background: percent === value ? 'var(--accent)' : '#FFFFFF',
                    color: percent === value ? '#FFFFFF' : '#374151',
                    fontFamily: 'inherit',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {value}%
                </button>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4B5263' }}>
                or
                <input
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value === '' ? '' : Number(e.target.value))}
                  aria-label="Discount percentage"
                  style={{ ...inputStyle, width: '96px', height: '40px', borderRadius: '20px' }}
                />
                %
              </label>
            </div>
            {!percentValid && <p style={{ ...hintStyle, color: '#B42318' }}>Use a whole number from 1 to 90.</p>}
          </div>

          <div>
            <div style={labelStyle}>When</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#4B5263' }}>
                Starts (optional)
                <input
                  type="date"
                  value={startsAt}
                  min={todayInput()}
                  onChange={(e) => setStartsAt(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#4B5263' }}>
                Ends (optional)
                <input
                  type="date"
                  value={endsAt}
                  min={startsAt || todayInput()}
                  onChange={(e) => setEndsAt(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
            <p style={hintStyle}>Leave the start empty to begin now, and the end empty to run until you remove it.</p>
          </div>

          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={labelStyle}>
                Products <span style={{ fontWeight: 500, color: '#6B7280' }}>({selected.size} chosen)</span>
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your products"
                aria-label="Search your products"
                style={{ ...inputStyle, width: '280px', maxWidth: '100%' }}
              />
            </div>

            <div style={{ marginTop: '12px', border: '1px solid #EDEFF3', borderRadius: '16px', overflow: 'hidden' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  background: '#F7F8FA',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#1F2937',
                }}
              >
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={visibleIds.length === 0} />
                Select all shown
              </label>

              <div style={{ maxHeight: '380px', overflowY: 'auto', opacity: productsLoading ? 0.6 : 1 }}>
                {productsError ? (
                  <div role="alert" style={{ padding: '24px', textAlign: 'center', color: '#B42318', fontSize: '14px' }}>
                    {productsError}
                  </div>
                ) : products.length === 0 && !productsLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
                    {search.trim() ? 'No product matches your search.' : 'You have no products yet.'}
                  </div>
                ) : (
                  products.map((product) => {
                    const range = currency ? priceRange(product, currency) : null;
                    const saleMin = range && percentValid ? discountedPrice(range.min, percent as number) : null;
                    const from = range && range.min !== range.max;
                    return (
                      <label
                        key={product.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 16px',
                          borderTop: '1px solid #EDEFF3',
                          cursor: 'pointer',
                        }}
                      >
                        <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggle(product.id)} />
                        <span style={{ width: '40px', height: '40px', flex: 'none' }}>
                          <Thumbnail src={product.thumbnail} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 500, color: '#111827' }}>
                          {product.title}
                        </span>
                        <span style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: '#4B5263' }}>
                          {range ? (
                            <>
                              {from ? 'from ' : ''}
                              {saleMin !== null && (
                                <span style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: '8px' }}>
                                  {formatAmount(range.min, currency)}
                                </span>
                              )}
                              <strong style={{ color: '#111827' }}>
                                {formatAmount(saleMin ?? range.min, currency)}
                              </strong>
                            </>
                          ) : currency ? (
                            <span style={{ color: '#B42318' }}>No price</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              style={{
                height: '44px',
                padding: '0 22px',
                borderRadius: '22px',
                border: '1px solid #E6E8EC',
                background: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !percentValid || selected.size === 0}
              style={{
                height: '44px',
                padding: '0 22px',
                borderRadius: '22px',
                border: 0,
                background: saving || !percentValid || selected.size === 0 ? '#9CA3AF' : 'var(--accent)',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: saving || !percentValid || selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {saving
                ? 'Creating...'
                : percentValid && selected.size > 0
                  ? `Apply ${percent}% off to ${selected.size} ${selected.size === 1 ? 'product' : 'products'}`
                  : 'Apply discount'}
            </button>
          </div>
        </form>
      )}

      <section style={{ ...card, marginTop: showForm ? '17px' : 0 }}>
        <div style={{ padding: '24px 24px 8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Your discounts</h2>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#4B5263' }}>
            A product can have one discount at a time. Removing a discount puts the normal price back at once.
          </p>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <div style={{ minWidth: '640px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px minmax(200px, 1.4fr) minmax(180px, 1fr) 120px 110px',
                alignItems: 'center',
                height: '40px',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              <span>Discount</span>
              <span>Products</span>
              <span>Period</span>
              <span>Status</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {loading && discounts === null ? (
              <LoadingRegion label="Loading discounts">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px minmax(200px, 1.4fr) minmax(180px, 1fr) 120px 110px',
                      alignItems: 'center',
                      minHeight: '64px',
                      padding: '8px 24px',
                      borderBottom: '1px solid #EDEFF3',
                    }}
                  >
                    <Skeleton width={56} height={24} radius={12} />
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="70%" height={16} />
                    <Skeleton width={70} height={24} radius={12} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Skeleton width={70} height={32} radius={16} />
                    </div>
                  </div>
                ))}
              </LoadingRegion>
            ) : loadError && discounts === null ? (
              <div role="alert" style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>The discounts could not be loaded.</p>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#B42318' }}>{loadError}</p>
                <button
                  type="button"
                  onClick={load}
                  style={{
                    marginTop: '16px',
                    height: '40px',
                    padding: '0 22px',
                    border: 0,
                    borderRadius: '20px',
                    background: 'var(--accent)',
                    color: '#FFFFFF',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (discounts?.length ?? 0) === 0 ? (
              <div
                role="status"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '96px', fontSize: '16px', fontWeight: 500, color: '#4B5263' }}
              >
                No discounts yet. Create your first one with New discount.
              </div>
            ) : (
              <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
                {discounts!.map((discount) => {
                  const status = STATUS_STYLE[discount.status];
                  const shown = discount.products.slice(0, 3);
                  return (
                    <div
                      key={discount.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px minmax(200px, 1.4fr) minmax(180px, 1fr) 120px 110px',
                        alignItems: 'center',
                        minHeight: '64px',
                        padding: '8px 24px',
                        borderBottom: '1px solid #EDEFF3',
                        fontSize: '15px',
                        color: '#111827',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '18px' }}>{discount.percent}% off</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ display: 'flex' }}>
                          {shown.map((product, i) => (
                            <span
                              key={product.id}
                              style={{ width: '32px', height: '32px', marginLeft: i === 0 ? 0 : '-8px', border: '2px solid #FFFFFF', borderRadius: '10px', overflow: 'hidden', background: '#EDEFF3' }}
                            >
                              <Thumbnail src={product.thumbnail} />
                            </span>
                          ))}
                        </span>
                        <span style={{ fontSize: '14px', color: '#4B5263', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {discount.products.length === 0
                            ? 'Products removed'
                            : discount.products.length === 1
                              ? shown[0].title
                              : `${discount.products.length} products`}
                        </span>
                      </span>
                      <span style={{ fontSize: '14px', color: '#4B5263' }}>{periodText(discount.starts_at, discount.ends_at)}</span>
                      <span>
                        <span
                          style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, background: status.background, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </span>
                      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setToRemove(discount)}
                          style={{
                            height: '34px',
                            padding: '0 16px',
                            borderRadius: '17px',
                            border: '1px solid #F5B5B5',
                            background: '#FFFFFF',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#B42318',
                            cursor: 'pointer',
                          }}
                        >
                          {discount.status === 'ended' ? 'Remove' : 'Stop'}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDeleteModal
        isOpen={toRemove !== null}
        title={toRemove?.status === 'ended' ? 'Remove discount' : 'Stop discount'}
        itemName={toRemove ? `${toRemove.percent}% off` : ''}
        loading={removing}
        message={
          toRemove?.status === 'ended'
            ? 'This discount has ended. Removing it only clears it from this list.'
            : 'The products go back to their normal price right away.'
        }
        confirmLabel={toRemove?.status === 'ended' ? 'Remove' : 'Stop discount'}
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
      />
    </div>
  );
}
