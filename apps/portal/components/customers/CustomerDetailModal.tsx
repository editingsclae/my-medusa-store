'use client';

import React, { useEffect, useState } from 'react';
import { getMerchantCustomer, MerchantCustomer, MerchantOrder } from '@/lib/medusa';
import { MailIcon, ShoppingCartIcon, TruckIcon } from '@/components/icons';

interface CustomerDetailModalProps {
  isOpen: boolean;
  customerId: string | null;
  fallbackCustomer?: MerchantCustomer | null;
  onClose: () => void;
}

export default function CustomerDetailModal({
  isOpen,
  customerId,
  fallbackCustomer,
  onClose,
}: CustomerDetailModalProps) {
  const [customer, setCustomer] = useState<MerchantCustomer | null>(null);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'addresses'>('overview');

  useEffect(() => {
    if (!isOpen || !customerId) {
      setCustomer(null);
      setOrders([]);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await getMerchantCustomer(customerId);
        setCustomer(res.customer);
        setOrders(res.orders || []);
      } catch (err) {
        console.warn('Failed to load full customer detail, using fallback', err);
        if (fallbackCustomer) {
          setCustomer(fallbackCustomer);
          setOrders(fallbackCustomer.orders || []);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, customerId, fallbackCustomer]);

  if (!isOpen) return null;

  const currentCustomer = customer || fallbackCustomer;
  const initials = currentCustomer?.name
    ? currentCustomer.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CU';

  const addresses = currentCustomer?.addresses || [];

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
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: '32px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingBottom: '20px',
            borderBottom: '1px solid #EDEFF3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent) 0%, #A78BFA 100%)',
                color: '#FFFFFF',
                fontSize: '20px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                  {currentCustomer?.name || 'Customer Details'}
                </h2>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: currentCustomer?.has_account ? '#ECFDF5' : '#F3F4F6',
                    color: currentCustomer?.has_account ? '#059669' : '#6B7280',
                  }}
                >
                  {currentCustomer?.has_account ? 'Registered' : 'Guest'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
                {currentCustomer?.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 0,
              fontSize: '24px',
              color: '#9CA3AF',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            margin: '20px 0',
            borderBottom: '1px solid #EDEFF3',
            paddingBottom: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 0,
              background: activeTab === 'overview' ? 'var(--accent)' : '#F3F4F6',
              color: activeTab === 'overview' ? '#FFFFFF' : '#4B5563',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 0,
              background: activeTab === 'orders' ? 'var(--accent)' : '#F3F4F6',
              color: activeTab === 'orders' ? '#FFFFFF' : '#4B5563',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('addresses')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 0,
              background: activeTab === 'addresses' ? 'var(--accent)' : '#F3F4F6',
              color: activeTab === 'addresses' ? '#FFFFFF' : '#4B5563',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Addresses ({addresses.length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>
            Loading customer details...
          </div>
        ) : (
          <div>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      padding: '16px',
                      background: '#F9FAFB',
                      borderRadius: '16px',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      Total Orders
                    </span>
                    <strong style={{ fontSize: '20px', color: '#111827' }}>
                      {orders.length}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      background: '#F9FAFB',
                      borderRadius: '16px',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      Total Spend
                    </span>
                    <strong style={{ fontSize: '20px', color: '#111827' }}>
                      {orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}{' '}
                      {orders[0]?.currency_code?.toUpperCase() || 'TND'}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      background: '#F9FAFB',
                      borderRadius: '16px',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      Customer Since
                    </span>
                    <strong style={{ fontSize: '16px', color: '#111827' }}>
                      {currentCustomer?.created_at
                        ? new Date(currentCustomer.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </strong>
                  </div>
                </div>

                {/* Primary Address preview in Overview */}
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                    Primary Address
                  </h4>
                  {addresses.length > 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: '14px',
                        border: '1px solid #E5E7EB',
                        background: '#FFFFFF',
                      }}
                    >
                      <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#111827' }}>
                        {[addresses[0].first_name, addresses[0].last_name].filter(Boolean).join(' ') ||
                          currentCustomer?.name}
                      </p>
                      <p style={{ margin: '0 0 4px 0', color: '#4B5563', fontSize: '14px' }}>
                        {addresses[0].address_1} {addresses[0].address_2}
                      </p>
                      <p style={{ margin: '0 0 4px 0', color: '#4B5563', fontSize: '14px' }}>
                        {[addresses[0].city, addresses[0].postal_code, addresses[0].country_code?.toUpperCase()]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {addresses[0].phone && (
                        <p style={{ margin: 0, color: '#6B7280', fontSize: '13px' }}>
                          Phone: {addresses[0].phone}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '14px', color: '#9CA3AF' }}>
                      No address saved for this customer yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: '1px solid #E5E7EB',
                        background: '#F9FAFB',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ShoppingCartIcon style={{ width: '18px', height: '18px', color: 'var(--accent)' }} />
                          <strong style={{ fontSize: '15px', color: '#111827' }}>
                            Order #{order.display_id || order.id.slice(0, 8)}
                          </strong>
                          <span style={{ fontSize: '13px', color: '#6B7280' }}>
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: '#ECFDF5',
                              color: '#059669',
                            }}
                          >
                            {order.status}
                          </span>
                          <strong style={{ fontSize: '15px', color: '#111827' }}>
                            {Number(order.total || 0).toFixed(2)} {order.currency_code?.toUpperCase()}
                          </strong>
                        </div>
                      </div>

                      {/* Items */}
                      {order.items && order.items.length > 0 && (
                        <div
                          style={{
                            paddingTop: '10px',
                            borderTop: '1px solid #EDEFF3',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '13px',
                                color: '#374151',
                              }}
                            >
                              <span>
                                {item.quantity}x {item.title}
                              </span>
                              <span style={{ fontWeight: 500 }}>
                                {(item.unit_price * item.quantity).toFixed(2)} {order.currency_code?.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
                    <ShoppingCartIcon style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', color: '#D1D5DB' }} />
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>No orders placed yet</p>
                  </div>
                )}
              </div>
            )}

            {/* ADDRESSES TAB */}
            {activeTab === 'addresses' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {addresses.length > 0 ? (
                  addresses.map((addr, idx) => (
                    <div
                      key={addr.id || idx}
                      style={{
                        padding: '18px',
                        borderRadius: '16px',
                        border: '1px solid #E5E7EB',
                        background: '#FFFFFF',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TruckIcon style={{ width: '18px', height: '18px', color: 'var(--accent)' }} />
                        <strong style={{ fontSize: '15px', color: '#111827' }}>
                          Address {idx + 1}
                        </strong>
                      </div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>
                        {[addr.first_name, addr.last_name].filter(Boolean).join(' ') || currentCustomer?.name}
                      </p>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#4B5563' }}>
                        {addr.address_1} {addr.address_2}
                      </p>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#4B5563' }}>
                        {[addr.city, addr.province, addr.postal_code, addr.country_code?.toUpperCase()]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {addr.phone && (
                        <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                          Phone: {addr.phone}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
                    <TruckIcon style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', color: '#D1D5DB' }} />
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
                      No saved addresses found for this customer.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0 24px',
              height: '42px',
              borderRadius: '21px',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
