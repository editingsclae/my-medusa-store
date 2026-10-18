'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/products/PageHeader';
import ProductsCard from '@/components/products/ProductsCard';
import AddProductModal from '@/components/products/AddProductModal';

export default function ProductsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <PageHeader onAddProduct={() => setIsAddModalOpen(true)} />
      <ProductsCard
        refreshKey={refreshKey}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
