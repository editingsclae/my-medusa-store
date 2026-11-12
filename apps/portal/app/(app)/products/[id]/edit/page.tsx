'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProductForm from '@/components/products/ProductForm';
import { getMerchantProducts, MerchantProduct } from '@/lib/medusa';
import { Skeleton, SkeletonCard, LoadingRegion } from '@/components/ui/Skeleton';

function EditProductSkeleton() {
  return (
    <LoadingRegion label="Loading product details">
      {/* Top Bar Skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px 16px 20px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Skeleton width={36} height={36} radius="50%" />
          <Skeleton width={160} height={28} radius={6} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Skeleton width={90} height={44} radius={22} />
          <Skeleton width={140} height={44} radius={22} />
        </div>
      </div>

      {/* Content body */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '20px', padding: '0 16px 17px 24px' }}>
        {/* Left Column */}
        <div style={{ flex: '2 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* General Information Card */}
          <SkeletonCard style={{ padding: '24px', gap: '20px' }}>
            <Skeleton width={180} height={24} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton width={120} height={16} />
              <Skeleton width="100%" height={48} radius={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton width={100} height={16} />
              <Skeleton width="100%" height={120} radius={16} />
            </div>
          </SkeletonCard>

          {/* Media Card */}
          <SkeletonCard style={{ padding: '24px', gap: '16px' }}>
            <Skeleton width={160} height={24} />
            <Skeleton width="50%" height={14} />
            <div style={{ display: 'flex', gap: '16px' }}>
              <Skeleton width={132} height={132} radius={16} />
              <Skeleton width={132} height={132} radius={16} />
            </div>
          </SkeletonCard>

          {/* Pricing & Stock Card */}
          <SkeletonCard style={{ padding: '24px', gap: '20px' }}>
            <Skeleton width={160} height={24} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width={80} height={16} />
                <Skeleton width="100%" height={48} radius={24} />
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width={80} height={16} />
                <Skeleton width="100%" height={48} radius={24} />
              </div>
            </div>
          </SkeletonCard>
        </div>

        {/* Right Column */}
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Card */}
          <SkeletonCard style={{ padding: '24px', gap: '16px' }}>
            <Skeleton width={140} height={22} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <Skeleton width={90} height={40} radius={20} />
              <Skeleton width={90} height={40} radius={20} />
            </div>
          </SkeletonCard>

          {/* Category Card */}
          <SkeletonCard style={{ padding: '24px', gap: '16px' }}>
            <Skeleton width={140} height={22} />
            <Skeleton width="100%" height={48} radius={24} />
          </SkeletonCard>

          {/* Badge Card */}
          <SkeletonCard style={{ padding: '24px', gap: '16px' }}>
            <Skeleton width={120} height={22} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width={70} height={32} radius={16} />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </LoadingRegion>
  );
}

export default function EditProductPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const [product, setProduct] = useState<MerchantProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setLoadError(null);
      const res = await getMerchantProducts({ limit: 100 });
      const found = res.products?.find((p) => p.id === id);
      if (found) {
        setProduct(found);
      } else {
        setLoadError('Product not found.');
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not fetch product details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  if (loading) {
    return <EditProductSkeleton />;
  }

  if (loadError || !product) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
          {loadError || 'The product could not be loaded.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={loadProduct}
            style={{
              height: '40px',
              padding: '0 22px',
              border: 0,
              borderRadius: '20px',
              background: 'var(--accent)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <Link
            href="/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '40px',
              padding: '0 20px',
              border: '1px solid #E6E8EC',
              borderRadius: '20px',
              background: '#FFFFFF',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  return <ProductForm mode="edit" productId={id} initialProduct={product} />;
}
