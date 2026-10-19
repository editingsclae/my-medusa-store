'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/products/PageHeader';
import ProductsCard from '@/components/products/ProductsCard';

export default function ProductsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <PageHeader />
      <ProductsCard refreshKey={refreshKey} />
    </>
  );
}
