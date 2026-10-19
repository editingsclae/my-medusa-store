'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductForm from '@/components/products/ProductForm';
import { getMerchantProducts, MerchantProduct } from '@/lib/medusa';

export default function EditProductPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const [product, setProduct] = useState<MerchantProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadProduct = async () => {
      try {
        setLoading(true);
        // Find product from merchant products list
        const res = await getMerchantProducts({ limit: 100 });
        const found = res.products?.find((p) => p.id === id);
        if (found) {
          setProduct(found);
        }
      } catch (err) {
        console.warn('Could not fetch product detail', err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280', fontSize: '16px' }}>
        Loading product details...
      </div>
    );
  }

  return <ProductForm mode="edit" productId={id} initialProduct={product} />;
}
