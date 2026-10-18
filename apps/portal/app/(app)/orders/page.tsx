'use client';

import React, { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { getMerchantOrders, fulfillMerchantOrder, MerchantOrder } from '@/lib/medusa';
import { SearchIcon } from '@/components/icons';

export default function OrdersPage() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MerchantOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [fulfilling, setFulfilling] = useState(false);
  const [fulfillmentError, setFulfillmentError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await getMerchantOrders();
      setOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setFulfilling(true);
    setFulfillmentError(null);
    try {
      await fulfillMerchantOrder(selectedOrder.id, {
        tracking_number: trackingNumber.trim() || undefined,
        tracking_url: trackingUrl.trim() || undefined,
      });
      setSelectedOrder(null);
      setTrackingNumber('');
      setTrackingUrl('');
      loadOrders();
    } catch (err: any) {
      setFulfillmentError(err.message || 'Fulfillment failed');
    } finally {
      setFulfilling(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const displayId = String(o.display_id || o.id).toLowerCase();
    const customer = `${o.customer?.first_name || ''} ${o.customer?.last_name || ''} ${o.customer?.email || ''}`.toLowerCase();
    return displayId.includes(q) || customer.includes(q);
  });

  return (
    <>
      <PageHeader title="Orders">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 14px',
              height: '44px',
              borderRadius: '22px',
              background: '#FFFFFF',
              border: '1px solid #E6E8EC',
            }}
          >
            <SearchIcon />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 0,
                outline: 0,
                fontSize: '14px',
                background: 'transparent',
              }}
            />
          </div>
        </div>
      </PageHeader>

      <section
        style={{
          margin: '0 16px 17px 24px',
          background: '#FFFFFF',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px',
            borderBottom: '1px solid #EDEFF3',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            Store Orders ({orders.length})
          </h2>
          <button
            type="button"
            onClick={loadOrders}
            style={{
              padding: '8px 16px',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              background: '#F9FAFB',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 180px 1fr 140px 150px 140px',
            alignItems: 'center',
            height: '48px',
            padding: '0 24px',
            background: '#F9FAFB',
            borderBottom: '1px solid #EDEFF3',
            fontSize: '13px',
            fontWeight: 600,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <span>Order</span>
          <span>Date</span>
          <span>Customer & Items</span>
          <span>Total</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>No orders found</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#9CA3AF' }}>
              When customers purchase items from your storefront, they will appear here.
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const hasFulfillment = order.fulfillments && order.fulfillments.length > 0;
            const itemsSummary = (order.items || [])
              .map((i) => `${i.title} (${i.quantity})`)
              .join(', ');

            return (
              <div
                key={order.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 180px 1fr 140px 150px 140px',
                  alignItems: 'center',
                  minHeight: '64px',
                  padding: '12px 24px',
                  borderBottom: '1px solid #EDEFF3',
                  fontSize: '14px',
                  color: '#111827',
                }}
              >
                <span style={{ fontWeight: 600 }}>#{order.display_id || order.id.slice(-6)}</span>
                <span style={{ color: '#6B7280' }}>
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {order.customer?.first_name} {order.customer?.last_name} ({order.customer?.email})
                  </div>
                  <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                    {itemsSummary || 'No line items'}
                  </div>
                </div>
                <span style={{ fontWeight: 600 }}>
                  {Number(order.total).toFixed(2)} {order.currency_code?.toUpperCase()}
                </span>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: hasFulfillment ? '#DEF7EC' : '#FEF08A',
                      color: hasFulfillment ? '#03543F' : '#854D0E',
                    }}
                  >
                    {hasFulfillment ? 'Fulfilled' : 'Unfulfilled'}
                  </span>
                </div>
                <div>
                  {!hasFulfillment ? (
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '16px',
                        border: 0,
                        background: 'var(--accent)',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Fulfill
                    </button>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#10B981', fontWeight: 500 }}>
                      ✓ Shipped
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Fulfill Modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(6, 10, 25, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '480px',
              padding: '32px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#111827' }}>
              Fulfill Order #{selectedOrder.display_id || selectedOrder.id.slice(-6)}
            </h3>
            <p style={{ margin: '6px 0 20px 0', fontSize: '14px', color: '#6B7280' }}>
              Confirm shipment and optionally attach tracking details for the customer.
            </p>

            {fulfillmentError && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  fontSize: '14px',
                  marginBottom: '16px',
                }}
              >
                {fulfillmentError}
              </div>
            )}

            <form onSubmit={handleFulfill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. 1Z9999999999999999"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid #D1D5DB',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                  Tracking URL
                </label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://track.carrier.com/..."
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid #D1D5DB',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  style={{
                    padding: '0 20px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '15px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fulfilling}
                  style={{
                    padding: '0 24px',
                    height: '44px',
                    borderRadius: '22px',
                    border: 0,
                    background: fulfilling ? '#9CA3AF' : 'var(--accent)',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 500,
                    cursor: fulfilling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {fulfilling ? 'Fulfilling...' : 'Mark as Shipped'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
