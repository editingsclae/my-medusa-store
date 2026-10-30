'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DashboardIcon,
  ProductsIcon,
  CustomersIcon,
  CategoryIcon,
  OrdersIcon,
  CouponsIcon,
  SettingsIcon,
  LogoutIcon,
  MerchantsIcon,
} from '@/components/icons';
import { getMerchantMe, removeStoredToken } from '@/lib/medusa';

export default function Sidebar() {
  const pathname = usePathname();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    getMerchantMe()
      .then((profile) => setIsPlatformAdmin(Boolean(profile.is_super_admin)))
      .catch(() => setIsPlatformAdmin(false));
  }, []);

  const isDashboardActive = pathname === '/dashboard';
  const isProductsActive = pathname === '/products' || pathname.startsWith('/products/');
  const isCustomersActive = pathname === '/customers' || pathname.startsWith('/customers/');
  const isCategoriesActive = pathname === '/categories' || pathname.startsWith('/categories/');
  const isOrdersActive = pathname === '/orders' || pathname.startsWith('/orders/');
  const isMerchantsActive = pathname === '/merchants' || pathname.startsWith('/merchants/');
  const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');

  return (
    <aside
      className="dl-side"
      style={{
        width: '244px',
        minWidth: '244px',
        flex: '0 0 244px',
        minHeight: '100vh',
        height: '100vh',
        position: 'sticky',
        top: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: '#060A19',
        color: '#FFFFFF',
        overflowY: 'auto',
        zIndex: 50,
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
        <svg width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="Vysas logo" style={{ flex: 'none' }}>
          <circle cx="20" cy="20" r="20" fill="#1F1B4D" />
          <path d="M26.5 14 A9 9 0 1 0 26.5 26" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="27.5" cy="27.5" r="3.5" fill="var(--accent)" />
        </svg>
        <span style={{ fontSize: '24px', fontWeight: 600, lineHeight: 1 }}>Vysas</span>
      </div>

      {/* Nav */}
      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px 0 20px' }}>
        {/* Dashboard */}
        <Link
          href="/dashboard"
          aria-current={isDashboardActive ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: isDashboardActive ? 'var(--accent)' : 'transparent',
            color: isDashboardActive ? '#FFFFFF' : '#F1F3F8',
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
              border: isDashboardActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid #2B3245',
              background: isDashboardActive ? 'rgba(255,255,255,0.14)' : '#0B1020',
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

        {/* Products */}
        <Link
          href="/products"
          aria-current={isProductsActive ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: isProductsActive ? 'var(--accent)' : 'transparent',
            color: isProductsActive ? '#FFFFFF' : '#F1F3F8',
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
              border: isProductsActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid #2B3245',
              background: isProductsActive ? 'rgba(255,255,255,0.14)' : '#0B1020',
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

        {/* Customers */}
        <Link
          href="/customers"
          aria-current={isCustomersActive ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: isCustomersActive ? 'var(--accent)' : 'transparent',
            color: isCustomersActive ? '#FFFFFF' : '#F1F3F8',
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
              border: isCustomersActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid #2B3245',
              background: isCustomersActive ? 'rgba(255,255,255,0.14)' : '#0B1020',
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

        {/* Category */}
        <Link
          href="/categories"
          aria-current={isCategoriesActive ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: isCategoriesActive ? 'var(--accent)' : 'transparent',
            color: isCategoriesActive ? '#FFFFFF' : '#F1F3F8',
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
              border: isCategoriesActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid #2B3245',
              background: isCategoriesActive ? 'rgba(255,255,255,0.14)' : '#0B1020',
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

        {/* Orders */}
        <Link
          href="/orders"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: isOrdersActive ? 'var(--accent)' : 'transparent',
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
              border: isOrdersActive ? '0' : '1px solid #2B3245',
              background: isOrdersActive ? 'transparent' : '#0B1020',
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

        {/* Coupons */}
        <Link
          href="#"
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

        {/* Settings */}
        <Link
          href="/settings/delivery"
          aria-current={isSettingsActive ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            background: isSettingsActive ? 'var(--accent)' : 'transparent',
            color: isSettingsActive ? '#FFFFFF' : '#F1F3F8',
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
              border: isSettingsActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid #2B3245',
              background: isSettingsActive ? 'rgba(255,255,255,0.14)' : '#0B1020',
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

        {/* Merchants: platform admins only (the backend enforces this too) */}
        {isPlatformAdmin && (
          <Link
            href="/merchants"
            aria-current={isMerchantsActive ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '48px',
              boxSizing: 'border-box',
              padding: '0 6px',
              borderRadius: '24px',
              background: isMerchantsActive ? 'var(--accent)' : 'transparent',
              color: isMerchantsActive ? '#FFFFFF' : '#F1F3F8',
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
                border: isMerchantsActive ? '1px solid rgba(255,255,255,0.5)' : '1px solid #2B3245',
                background: isMerchantsActive ? 'rgba(255,255,255,0.14)' : '#0B1020',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                color: '#FFFFFF',
              }}
            >
              <MerchantsIcon />
            </span>
            Merchants
          </Link>
        )}
      </nav>

      <div style={{ flex: '1 1 16px' }} />

      {/* Logout */}
      <div style={{ padding: '0 24px 13px 20px' }}>
        <button
          type="button"
          onClick={() => {
            removeStoredToken();
            window.location.href = '/login';
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            height: '48px',
            width: '100%',
            boxSizing: 'border-box',
            padding: '0 6px',
            borderRadius: '24px',
            border: 0,
            background: 'transparent',
            color: '#F1F3F8',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
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
        </button>
      </div>
    </aside>
  );
}
