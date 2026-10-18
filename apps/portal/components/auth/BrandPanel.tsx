import React from 'react';
import { ProductsIcon, OrdersIcon, CustomersIcon } from '@/components/icons';

export default function BrandPanel() {
  return (
    <aside
      style={{
        flex: '1 1 42%',
        minWidth: 'min(420px, 100%)',
        background: '#060A19',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '13px',
          height: '82px',
          boxSizing: 'border-box',
          padding: '0 56px',
          borderBottom: '1px solid #1B2135',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="Delisas logo" style={{ flex: 'none' }}>
          <circle cx="20" cy="20" r="20" fill="#1F1B4D" />
          <path d="M26.5 14 A9 9 0 1 0 26.5 26" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="27.5" cy="27.5" r="3.5" fill="var(--accent)" />
        </svg>
        <span style={{ fontSize: '24px', fontWeight: 600, lineHeight: 1 }}>Delisas</span>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '40px',
          padding: '48px 56px 64px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '40px',
              fontWeight: 600,
              lineHeight: '48px',
              maxWidth: '480px',
            }}
          >
            Manage your store with ease.
          </h2>
          <p
            style={{
              margin: '16px 0 0 0',
              fontSize: '18px',
              fontWeight: 500,
              lineHeight: '28px',
              color: '#B4B9C7',
              maxWidth: '440px',
            }}
          >
            Sign in to keep track of your products, orders and customers from one clean dashboard.
          </p>
        </div>

        {/* Feature list - hidden below 1000px via dl-extra CSS class */}
        <div
          className="dl-extra"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Feature 1: Products */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: '1px solid #2B3245',
                background: '#0B1020',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                color: '#FFFFFF',
              }}
            >
              <ProductsIcon />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: '20px' }}>Products</span>
              <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#B4B9C7' }}>
                Add, edit and organize your catalog.
              </span>
            </div>
          </div>

          {/* Feature 2: Orders */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: '1px solid #2B3245',
                background: '#0B1020',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                color: '#FFFFFF',
              }}
            >
              <OrdersIcon />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: '20px' }}>Orders</span>
              <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#B4B9C7' }}>
                Follow every order from cart to delivery.
              </span>
            </div>
          </div>

          {/* Feature 3: Customers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: '1px solid #2B3245',
                background: '#0B1020',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                color: '#FFFFFF',
              }}
            >
              <CustomersIcon />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: '20px' }}>Customers</span>
              <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#B4B9C7' }}>
                Keep every customer detail in one place.
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
