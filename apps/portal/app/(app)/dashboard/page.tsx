'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiTile from '@/components/dashboard/KpiTile';
import RevenueChart from '@/components/dashboard/RevenueChart';
import PendingFulfillment from '@/components/dashboard/PendingFulfillment';
import TopProducts from '@/components/dashboard/TopProducts';
import { Skeleton, SkeletonCard, LoadingRegion } from '@/components/ui/Skeleton';
import { DailyRevenue, KpiData } from '@/lib/dashboard-data';
import { AnalyticsDays, getMerchantAnalytics, getMerchantProducts, MerchantAnalytics } from '@/lib/medusa';
import { CalendarIcon, PlusIcon } from '@/components/icons';

const PERIODS: { days: AnalyticsDays; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

function formatMoney(amount: number, currencyCode: string): string {
  return `${Number(amount).toFixed(2)} ${(currencyCode || '').toUpperCase()}`.trim();
}

// Same blocks, same sizes as the real dashboard, so nothing jumps when the data arrives.
function DashboardSkeleton() {
  return (
    <LoadingRegion
      label="Loading the dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 16px 17px 24px' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} style={{ flex: '1 1 280px', minWidth: 0, height: '152px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skeleton width={120} height={16} />
              <Skeleton width={36} height={36} radius="50%" />
            </div>
            <Skeleton width={160} height={36} />
            <Skeleton width={190} height={14} />
          </SkeletonCard>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <SkeletonCard style={{ flex: '2 1 0', minWidth: 'min(540px, 100%)', height: '380px' }}>
          <Skeleton width={180} height={24} />
          <Skeleton height={290} radius={16} />
        </SkeletonCard>
        <SkeletonCard style={{ flex: '1 1 0', minWidth: 'min(320px, 100%)', height: '380px' }}>
          <Skeleton width={170} height={24} />
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} />
        </SkeletonCard>
      </div>
      <SkeletonCard style={{ height: '420px' }}>
        <Skeleton width={150} height={24} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Skeleton width={38} height={38} radius={10} />
            <Skeleton height={16} />
          </div>
        ))}
      </SkeletonCard>
    </LoadingRegion>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState<AnalyticsDays>(7);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [data, productsRes] = await Promise.all([
          getMerchantAnalytics(days),
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

        if (alive) setAnalytics(data);
      } catch (err) {
        if (alive) {
          setAnalytics(null);
          setError(err instanceof Error ? err.message : 'The dashboard could not be loaded.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadData();
    return () => {
      alive = false;
    };
  }, [reloadKey, days]);

  // Everything below is built from the real answer only. There is no sample data: while
  // the request runs the page shows skeletons, and if it fails it says so.
  const dailySales = analytics?.daily_sales ?? [];
  const currency = analytics?.currency_code ?? '';

  const kpis: KpiData[] = analytics
    ? [
        {
          title: 'Total revenue',
          value: formatMoney(analytics.total_sales, currency),
          deltaCaption: `${formatMoney(analytics.all_time_sales, currency)} all time`,
          iconName: 'dollar',
          sparklineSeries: dailySales.map((d) => d.sales || 0),
          sparklineAriaLabel: 'Revenue trend',
        },
        {
          title: 'Orders',
          value: String(analytics.total_orders),
          deltaCaption: `${analytics.all_time_orders} all time`,
          iconName: 'cart',
          sparklineSeries: dailySales.map((d) => d.count || 0),
          sparklineAriaLabel: 'Orders trend',
        },
        {
          title: 'Pending fulfillment',
          value: String(analytics.pending_orders),
          deltaCaption: `${analytics.fulfilled_orders} shipped`,
          iconName: 'truck',
        },
      ]
    : [];

  const dailyData: DailyRevenue[] = dailySales.map((item, idx) => {
    const d = new Date(item.date);
    return {
      dayIndex: idx,
      dateUtc: d.getTime(),
      dateShort: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateFull: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      revenue: item.sales,
      revenueFormatted: formatMoney(item.sales, currency),
    };
  });

  return (
    <>
      {/* Page Header */}
      <PageHeader title="Dashboard">
        <label
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxSizing: 'border-box',
            height: '44px',
            padding: '0 36px 0 16px',
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
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Period
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as AnalyticsDays)}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              border: 0,
              outline: 'none',
              background: 'transparent',
              font: 'inherit',
              color: 'inherit',
              cursor: 'pointer',
              paddingRight: '4px',
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            style={{ position: 'absolute', right: '16px', fontSize: '12px', color: '#6B7280', pointerEvents: 'none' }}
          >
            ▾
          </span>
        </label>

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

      {loading && !analytics ? (
        <DashboardSkeleton />
      ) : !analytics ? (
        <div style={{ padding: '0 16px 17px 24px' }}>
          <div
            role="alert"
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '48px 24px',
              textAlign: 'center',
              color: '#6B7280',
            }}
          >
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
              The dashboard could not be loaded
            </p>
            {error && <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>{error}</p>}
            <button
              type="button"
              onClick={retry}
              style={{
                marginTop: '20px',
                height: '40px',
                padding: '0 22px',
                border: 0,
                borderRadius: '20px',
                background: 'var(--accent)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '0 16px 17px 24px',
            // Changing the period keeps the old numbers on screen, dimmed, until the new ones arrive
            opacity: loading ? 0.55 : 1,
            transition: 'opacity 0.15s ease',
            pointerEvents: loading ? 'none' : 'auto',
          }}
          aria-busy={loading}
        >
          {/* 1) KPI tiles */}
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px' }}>
            {kpis.map((kpi) => (
              <KpiTile key={kpi.title} data={kpi} />
            ))}
          </div>

          {/* 2) Row: Revenue overview + Pending fulfillment */}
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px' }}>
            <RevenueChart data={dailyData} />
            <PendingFulfillment
              pendingCount={analytics.pending_orders}
              fulfilledCount={analytics.fulfilled_orders}
            />
          </div>

          {/* 3) Top products card */}
          <TopProducts products={analytics.top_products} currencyCode={analytics.currency_code} />
        </div>
      )}
    </>
  );
}
