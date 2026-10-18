'use client';

import React from 'react';
import Link from 'next/link';
import Thumbnail from '@/components/products/Thumbnail';
import { ArrowRightIcon } from '@/components/icons';

interface TopProductsProps {
  products?: { title: string; quantity: number }[];
  currencyCode?: string;
}

export default function TopProducts({ products = [], currencyCode = 'TND' }: TopProductsProps) {
  const maxQty = products.length > 0 ? Math.max(...products.map((p) => p.quantity), 1) : 1;

  return (
    <section
      style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        paddingBottom: '8px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              lineHeight: '28px',
              color: '#111827',
            }}
          >
            Top products
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: '20px',
              color: '#4B5263',
            }}
          >
            By units sold
          </p>
        </div>

        <Link
          href="/products"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '28px',
            color: 'color-mix(in srgb, var(--accent) 82%, black)',
            textDecoration: 'none',
          }}
        >
          View all products
          <ArrowRightIcon />
        </Link>
      </div>

      {products.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280' }}>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
            No product sales yet.
          </p>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#9CA3AF' }}>
            Products purchased on your storefront will be ranked here by sales volume.
          </p>
        </div>
      ) : (
        /* Table in overflow-x auto */
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '888px' }}>
            {/* Header Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1fr) 140px 1fr',
                alignItems: 'center',
                height: '40px',
                boxSizing: 'border-box',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              <span>Product</span>
              <span>Units sold</span>
              <span>Sales Volume</span>
            </div>

            {/* Body Rows */}
            <div>
              {products.map((product, idx) => {
                const fillPct = ((product.quantity / maxQty) * 100).toFixed(2);
                return (
                  <div
                    key={`${product.title}-${idx}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1fr) 140px 1fr',
                      alignItems: 'center',
                      height: '64px',
                      boxSizing: 'border-box',
                      padding: '0 24px',
                      borderBottom: '1px solid #EDEFF3',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: '#111827',
                    }}
                  >
                    {/* Product Cell */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#F3F4F6',
                          overflow: 'hidden',
                          flex: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Thumbnail type="shirt" />
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {product.title}
                      </span>
                    </span>

                    {/* Units sold */}
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {product.quantity}
                    </span>

                    {/* Volume bar track */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          flex: 1,
                          height: '8px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          background: 'color-mix(in srgb, var(--accent) 12%, white)',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${fillPct}%`,
                            borderRadius: '0 4px 4px 0',
                            background: 'var(--accent)',
                          }}
                        />
                      </div>
                      <span
                        style={{
                          width: '60px',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: '#111827',
                        }}
                      >
                        {product.quantity} sold
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
