'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiTile from '@/components/dashboard/KpiTile';
import RevenueChart from '@/components/dashboard/RevenueChart';
import PendingFulfillment from '@/components/dashboard/PendingFulfillment';
import TopProducts from '@/components/dashboard/TopProducts';
import { KPI_TILES_DATA, getDailyRevenueData, DailyRevenue, KpiData } from '@/lib/dashboard-data';
import { getMerchantAnalytics, getMerchantProducts, MerchantAnalytics } from '@/lib/medusa';
import { CalendarIcon, ChevronDownIcon, PlusIcon } from '@/components/icons';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [data, productsRes] = await Promise.all([
          getMerchantAnalytics(),
          getMerchantProducts({ limit: 100 }).catch(() => null),
        ]);

        if (data && productsRes?.products) {
          const productMap = new Map<string, string>();
          for (const prod of productsRes.products) {
            const thumb = prod.thumbnail || prod.images?.[0]?.url;
            if (thumb) {
              productMap.set(prod.title.toLowerCase().trim(), thumb);
            }
          }

          if (data.top_products) {
            data.top_products = data.top_products.map((item) => {
              const matchedThumb =
                item.thumbnail ||
                item.thumbnailUrl ||
                productMap.get(item.title.toLowerCase().trim()) ||
                null;
              return {
                ...item,
                thumbnail: matchedThumb,
                thumbnailUrl: matchedThumb,
              };
            });
          }
        }

        setAnalytics(data);
      } catch (err) {
        console.warn('Using default preview analytics (live data not yet created or session pending)');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute live KPI data or fallback
  const kpis: KpiData[] = analytics
    ? [
        {
          title: 'Total revenue',
          value: `${Number(analytics.total_sales).toFixed(2)} ${analytics.currency_code?.toUpperCase() || 'EUR'}`,
          delta: '+100%',
          isUp: true,
          deltaCaption: 'Store total sales',
          iconName: 'dollar',
          sparklineSeries: analytics.daily_sales.map((d) => d.sales || 0),
          sparklineAriaLabel: 'Revenue trend',
        },
        {
          title: 'Orders',
          value: String(analytics.total_orders),
          delta: `${analytics.total_orders} total`,
          isUp: true,
          deltaCaption: 'Orders placed',
          iconName: 'cart',
          sparklineSeries: analytics.daily_sales.map((d) => d.count || 0),
          sparklineAriaLabel: 'Orders trend',
        },
        {
          title: 'Pending fulfillment',
          value: String(analytics.pending_orders),
          delta: `${analytics.fulfilled_orders} fulfilled`,
          isUp: analytics.pending_orders === 0,
          deltaCaption: 'Needs shipping',
          iconName: 'truck',
          sparklineSeries: [analytics.pending_orders, analytics.fulfilled_orders],
          sparklineAriaLabel: 'Fulfillment trend',
        },
      ]
    : KPI_TILES_DATA;

  // Convert daily sales from backend or fallback to preview generator
  const dailyData: DailyRevenue[] =
    analytics && analytics.daily_sales?.length > 0
      ? analytics.daily_sales.map((item, idx) => {
          const d = new Date(item.date);
          return {
            dayIndex: idx,
            dateUtc: d.getTime(),
            dateShort: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            dateFull: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            revenue: item.sales,
            revenueFormatted: `${Number(item.sales).toFixed(2)} ${analytics.currency_code?.toUpperCase() || 'EUR'}`,
          };
        })
      : getDailyRevenueData();

  return (
    <>
      {/* Page Header */}
      <PageHeader title="Dashboard">
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxSizing: 'border-box',
            height: '44px',
            padding: '0 16px',
            border: '1px solid #E6E8EC',
            borderRadius: '22px',
            background: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          <CalendarIcon />
          Last 7-30 days
          <ChevronDownIcon style={{ marginLeft: '4px' }} />
        </button>

        <Link
          href="/products/new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            boxSizing: 'border-box',
            height: '44px',
            padding: '0 16px 0 18px',
            border: 0,
            borderRadius: '22px',
            background: 'var(--accent)',
            fontSize: '16px',
            fontWeight: 500,
            color: '#FFFFFF',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          <PlusIcon />
          Add Product
        </Link>
      </PageHeader>

      {/* Content wrapper */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '0 16px 17px 24px',
        }}
      >
        {/* 1) KPI tiles */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          {kpis.map((kpi) => (
            <KpiTile key={kpi.title} data={kpi} />
          ))}
        </div>

        {/* 2) Row: Revenue overview + Pending fulfillment */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <RevenueChart data={dailyData} />
          <PendingFulfillment
            pendingCount={analytics?.pending_orders}
            fulfilledCount={analytics?.fulfilled_orders}
          />
        </div>

        {/* 3) Top products card */}
        <TopProducts
          products={analytics?.top_products}
          currencyCode={analytics?.currency_code}
        />
      </div>


    </>
  );
}
