'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import ConfirmDeleteModal from '@/components/products/ConfirmDeleteModal';
import { Skeleton, LoadingRegion } from '@/components/ui/Skeleton';
import { useMerchant } from '@/components/layout/MerchantContext';
import { PlusIcon } from '@/components/icons';
import {
  createMerchantCoupon,
  deleteMerchantCoupon,
  getMerchantCoupons,
  MerchantCoupon,
} from '@/lib/medusa';
import { formatAmount, formatDay } from '@/lib/discounts';

const QUICK_PERCENTS = [5, 10, 15, 20, 25, 30];
const GRID = '150px minmax(150px, 1fr) 110px minmax(200px, 1.2fr) 120px 110px';

const STATUS_STYLE: Record<MerchantCoupon['status'], { label: string; background: string; color: string }> = {
  active: { label: 'Active', background: '#E8F7EE', color: '#17803F' },
  scheduled: { label: 'Scheduled', background: '#EEF2FF', color: '#3730A3' },
  expired: { label: 'Expired', background: '#F3F4F6', color: '#4B5563' },
  used_up: { label: 'Used up', background: '#FEF3C7', color: '#92400E' },
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
const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  fontSize: '13px',
  color: '#4B5263',
};

function todayInput(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' });
}

// A short random code to start from, without look-alike characters
function suggestCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

function valueText(coupon: MerchantCoupon, currency: string): string {
  return coupon.kind === 'percent'
    ? `${coupon.value}% off`
    : `${formatAmount(coupon.value, coupon.currency_code || currency)} off`;
}

function limitsText(coupon: MerchantCoupon, currency: string): string {
  const parts: string[] = [];
  if (coupon.starts_at && coupon.ends_at) parts.push(`${formatDay(coupon.starts_at)} to ${formatDay(coupon.ends_at)}`);
  else if (coupon.ends_at) parts.push(`Until ${formatDay(coupon.ends_at)}`);
  else if (coupon.starts_at) parts.push(`From ${formatDay(coupon.starts_at)}`);
  if (coupon.min_order) parts.push(`Order of ${formatAmount(coupon.min_order, currency)}+`);
  if (coupon.per_customer) parts.push('Once per customer');
  return parts.length ? parts.join(' · ') : 'No limits';
}

export default function CouponsPage() {
  const { profile } = useMerchant();
  const currency = profile?.currency_code || '';

  const [coupons, setCoupons] = useState<MerchantCoupon[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState<number | ''>(10);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [minOrder, setMinOrder] = useState<number | ''>('');
  const [perCustomer, setPerCustomer] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toRemove, setToRemove] = useState<MerchantCoupon | null>(null);
  const [removing, setRemoving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await getMerchantCoupons();
      setCoupons(res.coupons || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your coupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const codeClean = code.trim().toUpperCase();
  const codeValid = /^[A-Z0-9_-]{3,30}$/.test(codeClean);
  const valueValid =
    typeof value === 'number' &&
    (kind === 'percent' ? Number.isInteger(value) && value >= 1 && value <= 90 : value > 0);

  const resetForm = () => {
    setShowForm(false);
    setCode('');
    setKind('percent');
    setValue(10);
    setStartsAt('');
    setEndsAt('');
    setMaxUses('');
    setMinOrder('');
    setPerCustomer(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!codeValid) {
      setError('The code must be 3 to 30 characters: letters, numbers, - or _.');
      return;
    }
    if (!valueValid || typeof value !== 'number') {
      setError(kind === 'percent' ? 'Enter a whole percentage from 1 to 90.' : 'Enter the amount to take off.');
      return;
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      setError('The end date must be after the start date.');
      return;
    }

    setSaving(true);
    try {
      await createMerchantCoupon({
        code: codeClean,
        kind,
        value,
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
        max_uses: typeof maxUses === 'number' ? maxUses : undefined,
        min_order: typeof minOrder === 'number' ? minOrder : undefined,
        per_customer: perCustomer || undefined,
      });
      setNotice(`The coupon ${codeClean} is ready. Shoppers type it in their cart.`);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the coupon.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteMerchantCoupon(toRemove.id);
      setNotice(`The coupon ${toRemove.code} was removed. Orders that already used it keep their discount.`);
      setToRemove(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the coupon.');
      setToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  const pill = (active: boolean): React.CSSProperties => ({
    height: '40px',
    padding: '0 18px',
    borderRadius: '20px',
    border: active ? '1px solid var(--accent)' : '1px solid #E6E8EC',
    background: active ? 'var(--accent)' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#374151',
    fontFamily: 'inherit',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  });

  const submitDisabled = saving || !codeValid || !valueValid;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <PageHeader title="Coupons">
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setCode((c) => c || suggestCode());
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
            New coupon
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
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>New coupon</h2>
            <p style={{ ...hintStyle, fontSize: '14px' }}>
              Shoppers type the code in their cart to get the discount on the whole order. It works only in your store.
            </p>
          </div>

          <div>
            <div style={labelStyle}>Code</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                aria-label="Coupon code"
                maxLength={30}
                placeholder="WELCOME10"
                style={{ ...inputStyle, width: '240px', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              />
              <button type="button" onClick={() => setCode(suggestCode())} style={{ ...pill(false), height: '44px' }}>
                Suggest a code
              </button>
            </div>
            {code && !codeValid && (
              <p style={{ ...hintStyle, color: '#B42318' }}>3 to 30 characters: letters, numbers, - or _.</p>
            )}
            <p style={hintStyle}>Capital letters or small letters both work when a shopper types it.</p>
          </div>

          <div>
            <div style={labelStyle}>How much off the order</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                aria-pressed={kind === 'percent'}
                onClick={() => {
                  setKind('percent');
                  setValue(10);
                }}
                style={pill(kind === 'percent')}
              >
                Percentage
              </button>
              <button
                type="button"
                aria-pressed={kind === 'fixed'}
                onClick={() => {
                  setKind('fixed');
                  setValue('');
                }}
                style={pill(kind === 'fixed')}
              >
                Fixed amount {currency ? `(${currency.toUpperCase()})` : ''}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              {kind === 'percent' &&
                QUICK_PERCENTS.map((p) => (
                  <button key={p} type="button" onClick={() => setValue(p)} aria-pressed={value === p} style={pill(value === p)}>
                    {p}%
                  </button>
                ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4B5263' }}>
                {kind === 'percent' ? 'or' : 'Amount'}
                <input
                  type="number"
                  min={kind === 'percent' ? 1 : 0.001}
                  max={kind === 'percent' ? 90 : undefined}
                  step={kind === 'percent' ? 1 : 0.001}
                  value={value}
                  onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                  aria-label={kind === 'percent' ? 'Discount percentage' : 'Amount off'}
                  style={{ ...inputStyle, width: '120px', height: '40px', borderRadius: '20px' }}
                />
                {kind === 'percent' ? '%' : currency.toUpperCase()}
              </label>
            </div>
            {!valueValid && (
              <p style={{ ...hintStyle, color: '#B42318' }}>
                {kind === 'percent' ? 'Use a whole number from 1 to 90.' : 'Enter an amount above 0.'}
              </p>
            )}
          </div>

          <div>
            <div style={labelStyle}>Limits (all optional)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
              <label style={fieldLabel}>
                Starts
                <input type="date" value={startsAt} min={todayInput()} onChange={(e) => setStartsAt(e.target.value)} style={inputStyle} />
              </label>
              <label style={fieldLabel}>
                Ends
                <input type="date" value={endsAt} min={startsAt || todayInput()} onChange={(e) => setEndsAt(e.target.value)} style={inputStyle} />
              </label>
              <label style={fieldLabel}>
                Total uses
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={maxUses}
                  placeholder="No limit"
                  onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ ...inputStyle, width: '140px' }}
                />
              </label>
              <label style={fieldLabel}>
                Minimum order {currency ? `(${currency.toUpperCase()})` : ''}
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={minOrder}
                  placeholder="None"
                  onChange={(e) => setMinOrder(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ ...inputStyle, width: '160px' }}
                />
              </label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', fontSize: '14px', color: '#1F2937' }}>
              <input type="checkbox" checked={perCustomer} onChange={(e) => setPerCustomer(e.target.checked)} />
              One use per customer
            </label>
            <p style={hintStyle}>
              One use per customer needs the shopper to be signed in. The minimum order is checked when the order is
              placed, on the price of the items before the discount.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={resetForm} disabled={saving} style={{ ...pill(false), height: '44px', padding: '0 22px', fontSize: '16px' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              style={{
                height: '44px',
                padding: '0 22px',
                borderRadius: '22px',
                border: 0,
                background: submitDisabled ? '#9CA3AF' : 'var(--accent)',
                fontFamily: 'inherit',
                fontSize: '16px',
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: submitDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creating...' : 'Create coupon'}
            </button>
          </div>
        </form>
      )}

      <section style={{ ...card, marginTop: showForm ? '17px' : 0 }}>
        <div style={{ padding: '24px 24px 8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Your coupons</h2>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#4B5263' }}>
            A coupon takes money off the whole order, on top of any product discount. Removing a coupon stops it at once.
          </p>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <div style={{ minWidth: '820px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                alignItems: 'center',
                height: '40px',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              <span>Code</span>
              <span>Discount</span>
              <span>Used</span>
              <span>Limits</span>
              <span>Status</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {loading && coupons === null ? (
              <LoadingRegion label="Loading coupons">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', minHeight: '64px', padding: '8px 24px', borderBottom: '1px solid #EDEFF3' }}
                  >
                    <Skeleton width={90} height={20} />
                    <Skeleton width="60%" height={16} />
                    <Skeleton width={40} height={16} />
                    <Skeleton width="70%" height={16} />
                    <Skeleton width={70} height={24} radius={12} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Skeleton width={70} height={32} radius={16} />
                    </div>
                  </div>
                ))}
              </LoadingRegion>
            ) : loadError && coupons === null ? (
              <div role="alert" style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>The coupons could not be loaded.</p>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#B42318' }}>{loadError}</p>
                <button
                  type="button"
                  onClick={load}
                  style={{ marginTop: '16px', height: '40px', padding: '0 22px', border: 0, borderRadius: '20px', background: 'var(--accent)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Try again
                </button>
              </div>
            ) : (coupons?.length ?? 0) === 0 ? (
              <div
                role="status"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '96px', fontSize: '16px', fontWeight: 500, color: '#4B5263' }}
              >
                No coupons yet. Create your first one with New coupon.
              </div>
            ) : (
              <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
                {coupons!.map((coupon) => {
                  const status = STATUS_STYLE[coupon.status];
                  return (
                    <div
                      key={coupon.id}
                      style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', minHeight: '64px', padding: '8px 24px', borderBottom: '1px solid #EDEFF3', fontSize: '15px', color: '#111827' }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '0.04em', overflowWrap: 'anywhere' }}>{coupon.code}</span>
                      <span style={{ fontWeight: 600 }}>{valueText(coupon, currency)}</span>
                      <span style={{ fontSize: '14px', color: '#4B5263' }}>
                        {coupon.used}
                        {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ''}
                      </span>
                      <span style={{ fontSize: '14px', color: '#4B5263' }}>{limitsText(coupon, currency)}</span>
                      <span>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, background: status.background, color: status.color }}>
                          {status.label}
                        </span>
                      </span>
                      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setToRemove(coupon)}
                          style={{ height: '34px', padding: '0 16px', borderRadius: '17px', border: '1px solid #F5B5B5', background: '#FFFFFF', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, color: '#B42318', cursor: 'pointer' }}
                        >
                          Remove
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
        title="Remove coupon"
        itemName={toRemove ? toRemove.code : ''}
        loading={removing}
        message="Shoppers can no longer use this code. Orders that already used it keep their discount."
        confirmLabel="Remove coupon"
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
      />
    </div>
  );
}
