'use client';

import React, { useState, useEffect } from 'react';
import { getMerchantCustomers, getMerchantCustomer, MerchantCustomer, MerchantOrder } from '@/lib/medusa';
import { SearchIcon } from '@/components/icons';

// ─── Fallback preview data ───────────────────────────────────────────────────
const PREVIEW_CUSTOMERS: MerchantCustomer[] = [
  {
    id: 'cus_preview_1',
    email: 'olivia.martin@example.com',
    first_name: 'Olivia',
    last_name: 'Martin',
    name: 'Olivia Martin',
    phone: '+1 503 555 0101',
    has_account: true,
    account_status: 'Registered',
    created_at: '2025-03-04T10:00:00Z',
    addresses: [
      { first_name: 'Olivia', last_name: 'Martin', address_1: '48 Maple Street, Apt 5', city: 'Portland', postal_code: '97205', country_code: 'us', phone: '+1 503 555 0101' },
    ],
    orders: [
      { id: 'ord_1a', display_id: 10248, status: 'processing', created_at: '2026-10-12T10:00:00Z', currency_code: 'USD', total: 408, items: [{ id: 'i1', title: 'Chair', quantity: 1, unit_price: 245 }, { id: 'i2', title: 'Lamp', quantity: 1, unit_price: 163 }] },
      { id: 'ord_1b', display_id: 10192, status: 'completed', created_at: '2026-09-02T10:00:00Z', currency_code: 'USD', total: 264, items: [{ id: 'i3', title: 'Desk', quantity: 1, unit_price: 264 }] },
    ],
  },
  {
    id: 'cus_preview_2',
    email: 'liam.johnson@example.com',
    first_name: 'Liam',
    last_name: 'Johnson',
    name: 'Liam Johnson',
    phone: '+1 416 555 0122',
    has_account: true,
    account_status: 'Registered',
    created_at: '2025-04-19T10:00:00Z',
    addresses: [
      { first_name: 'Liam', last_name: 'Johnson', address_1: '1204 Queen Street West', city: 'Toronto', postal_code: 'M6K 1L2', country_code: 'ca', phone: '+1 416 555 0122' },
    ],
    orders: [
      { id: 'ord_2a', display_id: 10241, status: 'shipped', created_at: '2026-10-09T10:00:00Z', currency_code: 'USD', total: 364, items: [{ id: 'i4', title: 'Monitor', quantity: 1, unit_price: 364 }] },
    ],
  },
  {
    id: 'cus_preview_3',
    email: 'emma.dubois@example.com',
    first_name: 'Emma',
    last_name: 'Dubois',
    name: 'Emma Dubois',
    phone: '',
    has_account: false,
    account_status: 'Guest',
    created_at: '2025-08-02T10:00:00Z',
    addresses: [
      { first_name: 'Emma', last_name: 'Dubois', address_1: '12 Rue de la République', city: 'Lyon', postal_code: '69002', country_code: 'fr', phone: '' },
    ],
    orders: [
      { id: 'ord_3a', display_id: 10229, status: 'completed', created_at: '2026-10-03T10:00:00Z', currency_code: 'USD', total: 398, items: [{ id: 'i5', title: 'Keyboard', quantity: 1, unit_price: 264 }, { id: 'i6', title: 'Mouse', quantity: 1, unit_price: 134 }] },
    ],
  },
  {
    id: 'cus_preview_4',
    email: 'noah.williams@example.com',
    first_name: 'Noah',
    last_name: 'Williams',
    name: 'Noah Williams',
    phone: '+1 512 555 0177',
    has_account: true,
    account_status: 'Registered',
    created_at: '2025-09-27T10:00:00Z',
    addresses: [
      { first_name: 'Noah', last_name: 'Williams', address_1: '905 Red River Street', city: 'Austin', postal_code: '78701', country_code: 'us', phone: '+1 512 555 0177' },
    ],
    orders: [
      { id: 'ord_4a', display_id: 10253, status: 'processing', created_at: '2026-10-15T10:00:00Z', currency_code: 'USD', total: 422, items: [{ id: 'i7', title: 'Speaker', quantity: 1, unit_price: 422 }] },
    ],
  },
  {
    id: 'cus_preview_5',
    email: 'amira.bensalah@example.com',
    first_name: 'Amira',
    last_name: 'Ben Salah',
    name: 'Amira Ben Salah',
    phone: '+216 71 555 0190',
    has_account: true,
    account_status: 'Registered',
    created_at: '2026-02-23T10:00:00Z',
    addresses: [
      { first_name: 'Amira', last_name: 'Ben Salah', address_1: '21 Avenue Habib Bourguiba', city: 'Tunis', postal_code: '1000', country_code: 'tn', phone: '+216 71 555 0190' },
    ],
    orders: [
      { id: 'ord_5a', display_id: 10250, status: 'shipped', created_at: '2026-10-13T10:00:00Z', currency_code: 'TND', total: 599, items: [{ id: 'i8', title: 'Gaming Chair', quantity: 1, unit_price: 364 }, { id: 'i9', title: 'Headset', quantity: 1, unit_price: 235 }] },
    ],
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
function OrderStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let border = '#E5E7EB', bg = '#F3F4F6', color = '#4B5563';
  let label = status.charAt(0).toUpperCase() + status.slice(1);

  if (s === 'completed' || s === 'delivered') {
    border = '#9BDDB4'; bg = '#F2FBF6'; color = '#17803F'; label = 'Delivered';
  } else if (s === 'shipped') {
    border = '#9CC3FA'; bg = '#F1F7FF'; color = '#2563EB'; label = 'Shipped';
  } else if (s === 'pending' || s === 'processing') {
    border = '#F7D9A3'; bg = '#FFFAF0'; color = '#B45309'; label = 'Processing';
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: '28px', boxSizing: 'border-box', padding: '0 14px',
      borderRadius: '14px', fontSize: '14px', fontWeight: 500,
      border: `1px solid ${border}`, background: bg, color,
    }}>
      {label}
    </span>
  );
}

// ─── Account badge ────────────────────────────────────────────────────────────
function AccountBadge({ registered }: { registered: boolean }) {
  return registered ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: '28px', boxSizing: 'border-box', padding: '0 14px',
      border: '1px solid #9BDDB4', borderRadius: '14px',
      background: '#F2FBF6', color: '#17803F', fontSize: '14px', fontWeight: 500,
    }}>Registered</span>
  ) : (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: '28px', boxSizing: 'border-box', padding: '0 14px',
      border: '1px solid #D5D9E0', borderRadius: '14px',
      background: '#F3F4F6', color: '#4B5563', fontSize: '14px', fontWeight: 500,
    }}>Guest</span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'CU';
  return (
    <span aria-hidden="true" style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
      background: 'color-mix(in srgb, var(--accent) 14%, white)',
      color: 'color-mix(in srgb, var(--accent) 82%, black)',
      fontSize: `${Math.round(size * 0.34)}px`, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </span>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" /><path d="m11 18-6-6 6-6" />
    </svg>
  );
}

function SortByIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
      <path d="M11 12h4" /><path d="M11 16h7" /><path d="M11 20h10" />
    </svg>
  );
}

function UpDownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
      <path d="m21 16-4 4-4-4" /><path d="M17 20V4" />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers] = useState<MerchantCustomer[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Detail state
  const [selectedCustomer, setSelectedCustomer] = useState<MerchantCustomer | null>(null);
  const [detailOrders, setDetailOrders] = useState<MerchantOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await getMerchantCustomers({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        q: search.trim() || undefined,
      });
      setCustomers(res.customers || []);
      setTotalCount(res.count ?? res.customers?.length ?? 0);
    } catch {
      setCustomers(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search]);

  const displayCustomers: MerchantCustomer[] =
    customers !== null
      ? customers
      : PREVIEW_CUSTOMERS.filter((c) => {
          const q = search.toLowerCase();
          return (
            (c.name || '').toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
          );
        });

  const listTotal = customers !== null ? totalCount : PREVIEW_CUSTOMERS.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));

  const handleRowClick = async (cust: MerchantCustomer) => {
    setSelectedCustomer(cust);
    setDetailOrders(cust.orders || []);
    setDetailLoading(true);
    try {
      const res = await getMerchantCustomer(cust.id);
      setSelectedCustomer(res.customer);
      setDetailOrders(res.orders || []);
    } catch {
      // keep fallback data
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedCustomer(null);
    setDetailOrders([]);
  };

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (selectedCustomer) {
    const cust = selectedCustomer;
    const isRegistered = cust.has_account || cust.account_status === 'Registered';
    const firstName = cust.first_name || (cust.name || '').split(' ')[0] || 'Customer';
    const totalSpent = detailOrders.reduce((s, o) => s + (o.total || 0), 0);
    const currencyCode = detailOrders[0]?.currency_code?.toUpperCase() || 'TND';
    const addresses = cust.addresses || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Heading */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
          padding: '28px 16px 20px 24px',
        }}>
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to customers"
            style={{
              width: '36px', height: '36px', boxSizing: 'border-box', padding: 0,
              border: '1px solid #E6E8EC', borderRadius: '50%', background: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2A3040', cursor: 'pointer',
            }}
          >
            <BackArrow />
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>
            Customer details
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 16px 17px 24px' }}>

          {/* Profile card */}
          <section style={{
            boxSizing: 'border-box', padding: '24px', background: '#FFFFFF',
            borderRadius: '24px', display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between', gap: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              <Avatar name={cust.name || ''} size={64} />
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                  {cust.name || 'Customer'}
                </h2>
                <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                  {cust.email}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <AccountBadge registered={isRegistered} />
                </div>
              </div>
            </div>

            <dl style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
              <div>
                <dt style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Customer since</dt>
                <dd style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 600, lineHeight: '24px' }}>
                  {cust.created_at
                    ? new Date(cust.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'N/A'}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Orders</dt>
                <dd style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 600, lineHeight: '24px' }}>
                  {detailOrders.length}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Total spent</dt>
                <dd style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 600, lineHeight: '24px' }}>
                  {totalSpent.toFixed(2)} {currencyCode}
                </dd>
              </div>
            </dl>
          </section>

          {/* Orders card */}
          <section style={{ background: '#FFFFFF', borderRadius: '24px', paddingBottom: '8px', minWidth: 0 }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Orders</h2>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                Everything {firstName} has ordered.
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '680px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) 180px 110px 150px 120px',
                  alignItems: 'center', height: '40px', boxSizing: 'border-box',
                  padding: '0 24px', background: '#F7F8FA',
                  fontSize: '14px', fontWeight: 500, color: '#1F2937',
                }}>
                  <span>Order</span><span>Date</span><span>Items</span>
                  <span>Status</span><span style={{ textAlign: 'right' }}>Total</span>
                </div>
                {detailLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#8A90A0' }}>Loading orders...</div>
                ) : detailOrders.length > 0 ? (
                  detailOrders.map((order) => (
                    <div key={order.id} style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(120px, 1fr) 180px 110px 150px 120px',
                      alignItems: 'center', height: '64px', boxSizing: 'border-box',
                      padding: '0 24px', borderBottom: '1px solid #EDEFF3',
                      fontSize: '16px', fontWeight: 500, color: '#111827',
                    }}>
                      <span style={{ fontWeight: 600 }}>#{order.display_id || order.id.slice(0, 8)}</span>
                      <span>{new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span>{!order.items || order.items.length === 0 ? '—' : order.items.length === 1 ? '1 item' : `${order.items.length} items`}</span>
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <OrderStatusBadge status={order.status} />
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 600 }}>
                        {Number(order.total || 0).toFixed(2)} {order.currency_code?.toUpperCase()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#8A90A0' }}>No orders placed yet.</div>
                )}
              </div>
            </div>
          </section>

          {/* Addresses card */}
          <section style={{ background: '#FFFFFF', borderRadius: '24px', paddingBottom: '8px', minWidth: 0 }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Addresses</h2>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                Shipping and billing addresses on file.
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '820px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '190px minmax(220px, 1.6fr) minmax(120px, 1fr) 120px minmax(130px, 1fr)',
                  alignItems: 'center', height: '40px', boxSizing: 'border-box',
                  padding: '0 24px', background: '#F7F8FA',
                  fontSize: '14px', fontWeight: 500, color: '#1F2937',
                }}>
                  <span>Type</span><span>Address</span><span>City</span>
                  <span>Postal code</span><span>Country</span>
                </div>
                {addresses.length > 0 ? (
                  addresses.map((addr, idx) => (
                    <div key={(addr as { id?: string }).id || idx} style={{
                      display: 'grid',
                      gridTemplateColumns: '190px minmax(220px, 1.6fr) minmax(120px, 1fr) 120px minmax(130px, 1fr)',
                      alignItems: 'center', height: '64px', boxSizing: 'border-box',
                      padding: '0 24px', borderBottom: '1px solid #EDEFF3',
                      fontSize: '16px', fontWeight: 500, color: '#111827',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{idx === 0 ? 'Shipping' : 'Billing'}</span>
                        {idx === 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', height: '22px',
                            boxSizing: 'border-box', padding: '0 8px', borderRadius: '11px',
                            background: 'color-mix(in srgb, var(--accent) 12%, white)',
                            color: 'color-mix(in srgb, var(--accent) 82%, black)',
                            fontSize: '12px', fontWeight: 600,
                          }}>Default</span>
                        )}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                        {[addr.address_1, addr.address_2].filter(Boolean).join(' ')}
                      </span>
                      <span>{addr.city || '—'}</span>
                      <span>{addr.postal_code || '—'}</span>
                      <span>{addr.country_code?.toUpperCase() || '—'}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#8A90A0' }}>No addresses saved.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, listTotal);
  const footerText = search.trim()
    ? `Showing ${displayCustomers.length} result${displayCustomers.length !== 1 ? 's' : ''}`
    : listTotal > 0 ? `Showing ${start}–${end} of ${listTotal} entries` : 'No entries';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Page heading */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', padding: '28px 16px 20px 24px', minHeight: '44px',
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>Customers</h1>
      </div>

      <section style={{
        margin: '0 16px 17px 24px', background: '#FFFFFF', borderRadius: '24px',
        display: 'flex', flexDirection: 'column', minWidth: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', padding: '24px',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '44px' }}>All Customers</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '9px', boxSizing: 'border-box',
              width: '264px', maxWidth: '100%', height: '44px', padding: '0 17px',
              border: '1px solid #E6E8EC', borderRadius: '22px', background: '#FFFFFF',
            }}>
              <SearchIcon style={{ flex: 'none', width: '18px', height: '18px', stroke: '#2A3040' }} />
              <input
                type="text"
                placeholder="Search"
                aria-label="Search customers by name or email"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  flex: 1, minWidth: 0, border: 0, outline: 'none',
                  background: 'transparent', fontFamily: 'inherit',
                  fontSize: '16px', color: '#111827',
                }}
              />
            </label>
            <button
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: '9px', boxSizing: 'border-box',
                width: '130px', height: '44px', padding: '0 18px 0 17px',
                border: '1px solid #E6E8EC', borderRadius: '22px', background: '#FFFFFF',
                fontSize: '16px', fontWeight: 500, color: '#4B5263', cursor: 'pointer',
              }}
            >
              <SortByIcon />
              Sort by
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '780px' }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(260px, 1.5fr) minmax(160px, 1fr) 170px 170px 32px',
              alignItems: 'center', height: '40px', boxSizing: 'border-box',
              padding: '0 24px', background: '#F7F8FA',
              fontSize: '14px', fontWeight: 500, color: '#1F2937',
            }}>
              {(['Email', 'Name', 'Account', 'Created date'] as const).map((label) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {label} <UpDownIcon />
                </span>
              ))}
              <span />
            </div>

            {/* Rows */}
            <div>
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading customers...</div>
              ) : displayCustomers.length > 0 ? (
                displayCustomers.map((cust) => {
                  const isRegistered = cust.has_account || cust.account_status === 'Registered';
                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleRowClick(cust)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(260px, 1.5fr) minmax(160px, 1fr) 170px 170px 32px',
                        alignItems: 'center', height: '64px', boxSizing: 'border-box',
                        padding: '0 24px', borderBottom: '1px solid #EDEFF3',
                        fontSize: '16px', fontWeight: 500, color: '#111827',
                        cursor: 'pointer', transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {/* Email */}
                      <span style={{ minWidth: 0, paddingRight: '12px' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRowClick(cust); }}
                          aria-label={`View details for ${cust.name || cust.email}`}
                          style={{
                            display: 'block', maxWidth: '100%', padding: 0, border: 0,
                            background: 'transparent', fontFamily: 'inherit',
                            fontSize: '16px', fontWeight: 500, color: '#111827',
                            textAlign: 'left', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
                          }}
                        >
                          {cust.email}
                        </button>
                      </span>

                      {/* Name */}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                        {cust.name || 'Guest Customer'}
                      </span>

                      {/* Account badge */}
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <AccountBadge registered={isRegistered} />
                      </span>

                      {/* Created date */}
                      <span>
                        {cust.created_at
                          ? new Date(cust.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                          : 'N/A'}
                      </span>

                      {/* Chevron */}
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#6B7280' }}>
                        <ChevronRight />
                      </span>
                    </div>
                  );
                })
              ) : (
                <div role="status" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '96px', fontSize: '16px', fontWeight: 500, color: '#4B5263',
                }}>
                  No customers match your search.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination footer */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '16px', padding: '32px 24px 24px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#3F4654' }}>{footerText}</span>
          <nav aria-label="Pagination" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                height: '40px', boxSizing: 'border-box', padding: '0 16px',
                border: '1px solid #E3E6EB', borderRadius: '10px', background: '#FFFFFF',
                fontSize: '16px', fontWeight: 500, color: '#111827',
                cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1,
              }}
            >Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => setPage(p)}
                style={{
                  width: '40px', height: '40px', boxSizing: 'border-box', padding: 0,
                  border: `1px solid ${p === page ? 'var(--accent)' : '#E3E6EB'}`,
                  borderRadius: '10px',
                  background: p === page ? 'var(--accent)' : '#FFFFFF',
                  fontSize: '16px', fontWeight: 500,
                  color: p === page ? '#FFFFFF' : '#111827', cursor: 'pointer',
                }}
              >{p}</button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                height: '40px', boxSizing: 'border-box', padding: '0 16px',
                border: '1px solid #E3E6EB', borderRadius: '10px', background: '#FFFFFF',
                fontSize: '16px', fontWeight: 500, color: '#111827',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1,
              }}
            >Next</button>
          </nav>
        </div>
      </section>
    </div>
  );
}
