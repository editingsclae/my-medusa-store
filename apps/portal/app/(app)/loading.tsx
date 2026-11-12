import React from 'react';
import { Skeleton, SkeletonCard, LoadingRegion } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <LoadingRegion label="Loading page" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 16px 17px 24px' }}>
      {/* Title bar */}
      <div style={{ padding: '28px 0 20px 0' }}>
        <Skeleton width={180} height={30} radius={8} />
      </div>

      {/* One card */}
      <SkeletonCard style={{ minHeight: '400px', padding: '24px', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width={200} height={24} radius={6} />
          <Skeleton width={120} height={36} radius={18} />
        </div>
        <Skeleton width="100%" height={40} radius={8} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="100%" height={48} radius={8} />
          ))}
        </div>
      </SkeletonCard>
    </LoadingRegion>
  );
}

