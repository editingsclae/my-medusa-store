import React from 'react';
import Link from 'next/link';
import {
  LogoChevronsIcon,
  DashboardIcon,
  ProductsIcon,
  CustomersIcon,
  CategoryIcon,
  OrdersIcon,
  CouponsIcon,
  MessageIcon,
  SettingsIcon,
  LogoutIcon,
} from '../icons';

export default function Sidebar() {
  return (
    <aside
      className="dl-side"
      style={{
        flex: '0 0 244px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: '#060A19',
        color: '#FFFFFF',
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
          padding: '0 20px',
          borderBottom: '1px solid #1B2135',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="Delisas logo" style={{ flex: 'none' }}>
          <circle cx="20" cy="20" r="20" fill="#1F1B4D" />
          <path d="M26.5 14 A9 9 0 1 0 26.5 26" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="27.5" cy="27.5" r="3.5" fill="var(--accent)" />
        </svg>
        <span style={{ fontSize: '24px', fontWeight: 600, lineHeight: 1 }}>Delisas</span>
        <LogoChevronsIcon />
      </div>

      {/* Nav */}
      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px 0 20px' }}>
        <Link
          href="#dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
            <DashboardIcon />
          </span>
          Dashboard
        </Link>

        <Link
          href="/products"
          aria-current="page"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: 'var(--accent)',
            color: '#FFFFFF',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '36px',
              height: '36px',
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
              color: '#FFFFFF',
            }}
          >
            <ProductsIcon />
          </span>
          Products
        </Link>

        <Link
          href="#customers"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
          Customers
        </Link>

        <Link
          href="#category"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
            <CategoryIcon />
          </span>
          Category
        </Link>

        <Link
          href="#orders"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
          Orders
        </Link>

        <Link
          href="#coupons"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
            <CouponsIcon />
          </span>
          Coupons
        </Link>

        <Link
          href="#message"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
            <MessageIcon />
          </span>
          Message
          <span
            style={{
              marginLeft: 'auto',
              marginRight: '10px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--accent)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            3
          </span>
        </Link>

        <Link
          href="#settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
            <SettingsIcon />
          </span>
          Settings
        </Link>
      </nav>

      <div style={{ flex: '1 1 16px' }} />

      {/* Logout */}
      <div style={{ padding: '0 24px 13px 20px' }}>
        <Link
          href="#logout"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            color: '#F1F3F8',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
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
            <LogoutIcon />
          </span>
          Logout
        </Link>
      </div>
    </aside>
  );
}
