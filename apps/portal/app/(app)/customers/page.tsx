'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { getMerchantCustomers, MerchantCustomer } from '@/lib/medusa';
import Pagination from '@/components/products/Pagination';
import CustomerDetailModal from '@/components/customers/CustomerDetailModal';
import { SearchIcon, SortIcon, EyeIcon, UpDownSortIcon } from '@/components/icons';

// Fallback preview customers
const PREVIEW_CUSTOMERS: MerchantCustomer[] = [
  {
    id: 'cus_preview_1',
    email: 'sarah.connor@example.com',
    first_name: 'Sarah',
    last_name: 'Connor',
    name: 'Sarah Connor',
    phone: '+216 98 123 456',
    has_account: true,
    account_status: 'Registered',
    created_at: '2026-10-15T14:22:00Z',
    addresses: [
      {
        first_name: 'Sarah',
        last_name: 'Connor',
        address_1: '12 Rue de la Liberté',
        city: 'Tunis',
        postal_code: '1001',
        country_code: 'tn',
        phone: '+216 98 123 456',
      },
    ],
    orders: [
      {
        id: 'ord_prev_1',
        display_id: 1042,
        status: 'completed',
        created_at: '2026-10-16T10:15:00Z',
        currency_code: 'TND',
        total: 110.0,
        items: [
          {
            id: 'item_1',
            title: 'Volant Golf 7',
            quantity: 2,
            unit_price: 55.0,
          },
        ],
      },
    ],
  },
  {
    id: 'cus_preview_2',
    email: 'ahmed.benali@gmail.com',
    first_name: 'Ahmed',
    last_name: 'Ben Ali',
    name: 'Ahmed Ben Ali',
    phone: '+216 55 987 654',
    has_account: false,
    account_status: 'Guest',
    created_at: '2026-10-17T09:40:00Z',
    addresses: [
      {
        first_name: 'Ahmed',
        last_name: 'Ben Ali',
        address_1: 'Avenue Habib Bourguiba, Résidence Étoile',
        city: 'Sousse',
        postal_code: '4000',
        country_code: 'tn',
        phone: '+216 55 987 654',
      },
    ],
    orders: [
      {
        id: 'ord_prev_2',
        display_id: 1043,
        status: 'pending',
        created_at: '2026-10-17T11:00:00Z',
        currency_code: 'TND',
        total: 55.0,
        items: [
          {
            id: 'item_2',
            title: 'Cache Volant Sport Carbone Hyundai',
            quantity: 1,
            unit_price: 55.0,
          },
        ],
      },
    ],
  },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<MerchantCustomer[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected customer for detail view
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedFallbackCustomer, setSelectedFallbackCustomer] = useState<MerchantCustomer | null>(null);

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
    } catch (err) {
      console.warn('Backend customers route pending, displaying preview customers');
      setCustomers(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search]);

  // Display items: either live customers or filtered mock
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

  const totalPages = Math.max(1, Math.ceil((customers !== null ? totalCount : displayCustomers.length) / pageSize));

  const handleRowClick = (customer: MerchantCustomer) => {
    setSelectedCustomerId(customer.id);
    setSelectedFallbackCustomer(customer);
  };

  return (
    <>
      <PageHeader title="Customers">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              boxSizing: 'border-box',
              width: '280px',
              maxWidth: '100%',
              height: '44px',
              padding: '0 16px',
              border: '1px solid #E6E8EC',
              borderRadius: '22px',
              background: '#FFFFFF',
            }}
          >
            <SearchIcon style={{ flex: 'none', width: '18px', height: '18px', stroke: '#2A3040' }} />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontSize: '15px',
                color: '#111827',
              }}
            />
          </label>
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
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            All Customers ({customers !== null ? totalCount : displayCustomers.length})
          </h2>
          <button
            type="button"
            onClick={fetchCustomers}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 16px',
              border: '1px solid #E6E8EC',
              borderRadius: '20px',
              background: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <SortIcon />
            Refresh
          </button>
        </div>

        {/* Table Wrapper */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '920px' }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(240px, 1.4fr) 160px 180px 140px',
                alignItems: 'center',
                height: '42px',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Name <UpDownSortIcon />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Email <UpDownSortIcon />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Account <UpDownSortIcon />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Created <UpDownSortIcon />
              </span>
              <span style={{ textAlign: 'right' }}>Action</span>
            </div>

            {/* Table Rows */}
            <div>
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>
                  Loading customers...
                </div>
              ) : displayCustomers.length > 0 ? (
                displayCustomers.map((cust) => {
                  const initials = cust.name
                    ? cust.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'CU';

                  const isRegistered = cust.has_account || cust.account_status === 'Registered';

                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleRowClick(cust)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(240px, 1.4fr) 160px 180px 140px',
                        alignItems: 'center',
                        height: '64px',
                        padding: '0 24px',
                        borderBottom: '1px solid #EDEFF3',
                        fontSize: '15px',
                        color: '#111827',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                    >
                      {/* Name with initials avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: isRegistered
                              ? 'linear-gradient(135deg, var(--accent) 0%, #A78BFA 100%)'
                              : '#E5E7EB',
                            color: isRegistered ? '#FFFFFF' : '#4B5563',
                            fontSize: '13px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cust.name || 'Guest Customer'}
                        </span>
                      </div>

                      {/* Email */}
                      <span style={{ color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cust.email}
                      </span>

                      {/* Account status badge */}
                      <div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            background: isRegistered ? '#ECFDF5' : '#F3F4F6',
                            color: isRegistered ? '#059669' : '#6B7280',
                            border: isRegistered ? '1px solid #A7F3D0' : '1px solid #E5E7EB',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: isRegistered ? '#10B981' : '#9CA3AF',
                            }}
                          />
                          {isRegistered ? 'Registered' : 'Guest'}
                        </span>
                      </div>

                      {/* Created date */}
                      <span style={{ color: '#6B7280', fontSize: '14px' }}>
                        {cust.created_at
                          ? new Date(cust.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </span>

                      {/* Action */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(cust);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            border: '1px solid #E3E6EB',
                            background: '#FFFFFF',
                            color: 'var(--accent)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <EyeIcon style={{ width: '15px', height: '15px' }} />
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>No customers found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={customers !== null ? totalCount : displayCustomers.length}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
        />
      </section>

      {/* Customer Details Modal (Orders & Addresses) */}
      <CustomerDetailModal
        isOpen={selectedCustomerId !== null}
        customerId={selectedCustomerId}
        fallbackCustomer={selectedFallbackCustomer}
        onClose={() => {
          setSelectedCustomerId(null);
          setSelectedFallbackCustomer(null);
        }}
      />
    </>
  );
}
