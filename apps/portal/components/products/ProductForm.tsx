'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
  uploadMerchantMedia,
  MerchantProduct,
} from '@/lib/medusa';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { ArrowLeftIcon, TrashIcon, CheckIcon, UploadCloudIcon, PlusIcon } from '@/components/icons';

interface ProductImageItem {
  id: string;
  url: string;
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  initialProduct?: MerchantProduct | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  'Shirt',
  'Shoe',
  'Polo',
  'Top',
  'Knitwear',
  'Bag',
  'Waistcoat',
  'Co-Ord Set',
  'Accessories',
  'Electronics',
  'Automotive',
];

export default function ProductForm({
  mode,
  productId,
  initialProduct,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [status, setStatus] = useState<'Active' | 'Draft'>('Active');

  // Images state
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [mainImageId, setMainImageId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Status & notifications
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize data if in edit mode
  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.title || '');
      setDescription(initialProduct.description || '');
      setCategory(initialProduct.subtitle || '');

      const variant = initialProduct.variants?.[0];
      const p = variant?.prices?.[0];
      setPrice(p?.amount !== undefined ? String(p.amount) : '');
      setStock(variant?.inventory_quantity !== undefined ? String(variant.inventory_quantity) : '10');

      setStatus(initialProduct.status === 'published' ? 'Active' : 'Draft');

      // Setup images
      const initialImgs: ProductImageItem[] = [];
      if (initialProduct.thumbnail) {
        initialImgs.push({ id: 'thumb-0', url: initialProduct.thumbnail });
      }
      if (initialProduct.images && initialProduct.images.length > 0) {
        for (const img of initialProduct.images) {
          if (!initialImgs.some((i) => i.url === img.url)) {
            initialImgs.push({ id: img.id || `img-${initialImgs.length}`, url: img.url });
          }
        }
      }
      setImages(initialImgs);
      if (initialImgs.length > 0) {
        setMainImageId(initialImgs[0].id);
      }
    }
  }, [initialProduct]);

  // Handle image upload from file or drop
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const newItems: ProductImageItem[] = [...images];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (newItems.length >= 6) break; // max 6 images
        const uploadRes = await uploadMerchantMedia(file);
        const newItem: ProductImageItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: uploadRes.url,
        };
        newItems.push(newItem);
      }

      setImages(newItems);
      if (!mainImageId && newItems.length > 0) {
        setMainImageId(newItems[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (id: string) => {
    const nextImages = images.filter((img) => img.id !== id);
    setImages(nextImages);
    if (mainImageId === id) {
      setMainImageId(nextImages.length > 0 ? nextImages[0].id : null);
    }
  };

  const handleSetMain = (id: string) => {
    setMainImageId(id);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please provide a valid price');
      return;
    }

    setSaving(true);
    setError(null);
    setSavedMessage(null);

    // Identify main thumbnail and rest of images
    const mainImg = images.find((i) => i.id === mainImageId) || images[0];
    const thumbnailUrl = mainImg ? mainImg.url : undefined;
    const imageUrls = images.map((i) => i.url);

    try {
      if (mode === 'create') {
        await createMerchantProduct({
          title: name.trim(),
          subtitle: category.trim() || undefined,
          description: description.trim() || undefined,
          price: numPrice,
          inventory_quantity: parseInt(stock, 10) || 0,
          thumbnail: thumbnailUrl,
          images: imageUrls.length > 0 ? imageUrls : undefined,
          status: status === 'Active' ? 'published' : 'draft',
        });
        setSavedMessage('Product created successfully.');
      } else if (mode === 'edit' && productId) {
        await updateMerchantProduct(productId, {
          title: name.trim(),
          subtitle: category.trim() || undefined,
          description: description.trim() || undefined,
          price: numPrice,
          inventory_quantity: parseInt(stock, 10) || 0,
          thumbnail: thumbnailUrl || null,
          images: imageUrls,
          status: status === 'Active' ? 'published' : 'draft',
        });
        setSavedMessage('Changes saved successfully.');
      }

      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/products');
        }
      }, 700);
    } catch (err: any) {
      setError(err.message || `Failed to ${mode === 'create' ? 'create' : 'save'} product`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productId) return;
    setDeleting(true);
    try {
      await deleteMerchantProduct(productId);
      setShowDeleteModal(false);
      router.push('/products');
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
      />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '28px 16px 20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/products"
              aria-label="Back to products"
              style={{
                width: '36px',
                height: '36px',
                boxSizing: 'border-box',
                border: '1px solid #E6E8EC',
                borderRadius: '50%',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2A3040',
                textDecoration: 'none',
              }}
            >
              <ArrowLeftIcon />
            </Link>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>
              {mode === 'create' ? 'Add Product' : 'Edit Product'}
            </h1>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  height: '44px',
                  padding: '0 22px',
                  border: '1px solid #E6E8EC',
                  borderRadius: '22px',
                  background: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                {mode === 'create' ? 'Cancel' : 'Discard'}
              </button>
            ) : (
              <Link
                href="/products"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  height: '44px',
                  padding: '0 22px',
                  border: '1px solid #E6E8EC',
                  borderRadius: '22px',
                  background: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#374151',
                  textDecoration: 'none',
                }}
              >
                {mode === 'create' ? 'Cancel' : 'Discard'}
              </Link>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                boxSizing: 'border-box',
                height: '44px',
                padding: '0 22px 0 20px',
                border: 0,
                borderRadius: '22px',
                background: saving ? '#9CA3AF' : 'var(--accent)',
                fontSize: '16px',
                fontWeight: 500,
                color: '#FFFFFF',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <CheckIcon />
              {saving
                ? 'Saving...'
                : mode === 'create'
                ? 'Save Product'
                : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 16px 17px 24px' }}>
          {/* Status Alert Messages */}
          {savedMessage && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxSizing: 'border-box',
                padding: '12px 16px',
                border: '1px solid #9BDDB4',
                borderRadius: '16px',
                background: '#F2FBF6',
                color: '#17803F',
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: '20px',
              }}
            >
              <CheckIcon />
              {savedMessage}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                border: '1px solid #FCA5A5',
                borderRadius: '16px',
                background: '#FEE2E2',
                color: '#DC2626',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* 2-Column Responsive Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '20px' }}>
            {/* LEFT COLUMN */}
            <div style={{ flex: '2 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* General information section */}
              <section
                style={{
                  boxSizing: 'border-box',
                  padding: '24px',
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                    General information
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                    The name and description shoppers will see.
                  </p>
                </div>

                {/* Product Name */}
                <div>
                  <label
                    htmlFor="p-name"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      lineHeight: '20px',
                      color: '#1F2937',
                    }}
                  >
                    Product name *
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                      height: '48px',
                      padding: '0 17px',
                      border: '1px solid #E6E8EC',
                      borderRadius: '24px',
                      background: '#FFFFFF',
                    }}
                  >
                    <input
                      id="p-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter product name"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: 0,
                        outline: 'none',
                        background: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: '16px',
                        color: '#111827',
                      }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="p-desc"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      lineHeight: '20px',
                      color: '#1F2937',
                    }}
                  >
                    Description
                  </label>
                  <div
                    style={{
                      boxSizing: 'border-box',
                      padding: '12px 17px',
                      border: '1px solid #E6E8EC',
                      borderRadius: '16px',
                      background: '#FFFFFF',
                    }}
                  >
                    <textarea
                      id="p-desc"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the product: material, fit, care instructions"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '120px',
                        boxSizing: 'border-box',
                        padding: 0,
                        border: 0,
                        outline: 'none',
                        background: 'transparent',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        fontSize: '16px',
                        lineHeight: '24px',
                        color: '#111827',
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Product images section */}
              <section
                style={{
                  boxSizing: 'border-box',
                  padding: '24px',
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                    Product images
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                    The main image is the thumbnail shown in the product list and on your store page.
                  </p>
                </div>

                {images.length > 0 ? (
                  /* Image Grid */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      role="group"
                      aria-label="Product images"
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}
                    >
                      {images.map((img, idx) => {
                        const isMain = img.id === mainImageId || (!mainImageId && idx === 0);
                        return (
                          <div
                            key={img.id}
                            style={{
                              position: 'relative',
                              flex: 'none',
                              width: '132px',
                              height: '132px',
                              boxSizing: 'border-box',
                              border: isMain ? '2px solid var(--accent)' : '1px solid #E6E8EC',
                              borderRadius: '16px',
                              background: '#F9FAFB',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={img.url}
                              alt={`Product image ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />

                            {/* Main badge */}
                            {isMain && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  left: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  boxSizing: 'border-box',
                                  height: '24px',
                                  padding: '0 10px',
                                  borderRadius: '12px',
                                  background: 'var(--accent)',
                                  color: '#FFFFFF',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                Main
                              </span>
                            )}

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img.id)}
                              aria-label={`Remove image ${idx + 1}`}
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                width: '28px',
                                height: '28px',
                                boxSizing: 'border-box',
                                padding: 0,
                                border: '1px solid #E6E8EC',
                                borderRadius: '50%',
                                background: '#FFFFFF',
                                color: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '13px',
                                lineHeight: 1,
                              }}
                            >
                              ✕
                            </button>

                            {/* Set as main button */}
                            {!isMain && (
                              <button
                                type="button"
                                onClick={() => handleSetMain(img.id)}
                                style={{
                                  position: 'absolute',
                                  left: '8px',
                                  right: '8px',
                                  bottom: '8px',
                                  height: '28px',
                                  boxSizing: 'border-box',
                                  padding: 0,
                                  border: '1px solid #E6E8EC',
                                  borderRadius: '14px',
                                  background: '#FFFFFF',
                                  color: '#374151',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Set as main
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Add Image Button */}
                      {images.length < 6 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          style={{
                            flex: 'none',
                            width: '132px',
                            height: '132px',
                            boxSizing: 'border-box',
                            padding: 0,
                            border: '1.5px dashed #C9CED8',
                            borderRadius: '16px',
                            background: '#F7F8FA',
                            color: '#374151',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: uploading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              boxSizing: 'border-box',
                              border: '1px solid #E6E8EC',
                              borderRadius: '50%',
                              background: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <PlusIcon />
                          </span>
                          {uploading ? 'Uploading...' : 'Add image'}
                        </button>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                      {images.length} of 6 images uploaded. PNG, JPG or WebP, up to 10 MB each.
                    </p>
                  </div>
                ) : (
                  /* Empty Dropzone State */
                  <div
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      boxSizing: 'border-box',
                      padding: '36px 24px',
                      border: isDragging
                        ? '1.5px dashed var(--accent)'
                        : '1.5px dashed #C9CED8',
                      borderRadius: '16px',
                      background: isDragging ? '#F5F3FF' : '#F7F8FA',
                      textAlign: 'center',
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '48px',
                        height: '48px',
                        boxSizing: 'border-box',
                        border: '1px solid #E6E8EC',
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <UploadCloudIcon />
                    </span>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 600, lineHeight: '24px' }}>
                        {isDragging ? 'Drop images here' : 'Drag and drop images here'}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                        PNG, JPG or WebP, up to 10 MB each
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={uploading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxSizing: 'border-box',
                        height: '40px',
                        padding: '0 18px',
                        border: '1px solid #E6E8EC',
                        borderRadius: '20px',
                        background: '#FFFFFF',
                        fontSize: '15px',
                        fontWeight: 500,
                        color: '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      {uploading ? 'Uploading...' : 'Upload images'}
                    </button>
                  </div>
                )}
              </section>

              {/* Pricing and inventory section (NO SKU) */}
              <section
                style={{
                  boxSizing: 'border-box',
                  padding: '24px',
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                    Pricing and inventory
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                    What it costs and how many you have in stock.
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                  {/* Price */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <label
                      htmlFor="p-price"
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        lineHeight: '20px',
                        color: '#1F2937',
                      }}
                    >
                      Price *
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxSizing: 'border-box',
                        height: '48px',
                        padding: '0 17px',
                        border: '1px solid #E6E8EC',
                        borderRadius: '24px',
                        background: '#FFFFFF',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#4B5263' }}>
                        TND
                      </span>
                      <input
                        id="p-price"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 0,
                          outline: 'none',
                          background: 'transparent',
                          fontFamily: 'inherit',
                          fontSize: '16px',
                          color: '#111827',
                        }}
                      />
                    </div>
                  </div>

                  {/* Stock */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <label
                      htmlFor="p-stock"
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        lineHeight: '20px',
                        color: '#1F2937',
                      }}
                    >
                      Stock quantity
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box',
                        height: '48px',
                        padding: '0 17px',
                        border: '1px solid #E6E8EC',
                        borderRadius: '24px',
                        background: '#FFFFFF',
                      }}
                    >
                      <input
                        id="p-stock"
                        type="number"
                        min="0"
                        step="1"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        placeholder="0"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 0,
                          outline: 'none',
                          background: 'transparent',
                          fontFamily: 'inherit',
                          fontSize: '16px',
                          color: '#111827',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Status Section */}
              <fieldset
                style={{
                  margin: 0,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '24px',
                  border: 0,
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <legend style={{ float: 'left', width: '100%', padding: 0 }}>
                  <span style={{ display: 'block', fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                    Status
                  </span>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                    Controls where the product appears.
                  </span>
                </legend>

                <div style={{ clear: 'both', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Active Radio Option */}
                  <label
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxSizing: 'border-box',
                      padding: '12px 16px',
                      border: status === 'Active' ? '1px solid #9BDDB4' : '1px solid #E6E8EC',
                      borderRadius: '16px',
                      background: status === 'Active' ? '#F2FBF6' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={status === 'Active'}
                      onChange={() => setStatus('Active')}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        boxSizing: 'border-box',
                        border: status === 'Active' ? '1.5px solid #17803F' : '1.5px solid #C9CED8',
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: status === 'Active' ? '#17803F' : 'transparent',
                        }}
                      />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: '20px', color: '#111827' }}>
                        Active
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                        Visible and ready to sell
                      </span>
                    </span>
                  </label>

                  {/* Draft Radio Option */}
                  <label
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxSizing: 'border-box',
                      padding: '12px 16px',
                      border: status === 'Draft' ? '1px solid #9CC3FA' : '1px solid #E6E8EC',
                      borderRadius: '16px',
                      background: status === 'Draft' ? '#F1F7FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="Draft"
                      checked={status === 'Draft'}
                      onChange={() => setStatus('Draft')}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        boxSizing: 'border-box',
                        border: status === 'Draft' ? '1.5px solid #2563EB' : '1.5px solid #C9CED8',
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: status === 'Draft' ? '#2563EB' : 'transparent',
                        }}
                      />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600, lineHeight: '20px', color: '#111827' }}>
                        Draft
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                        Saved but hidden from the store
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {/* Category Section */}
              <section
                style={{
                  boxSizing: 'border-box',
                  padding: '24px',
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                    Category
                  </h2>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                    Helps shoppers find it.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="p-category"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      lineHeight: '20px',
                      color: '#1F2937',
                    }}
                  >
                    Product category
                  </label>
                  <div
                    style={{
                      position: 'relative',
                      boxSizing: 'border-box',
                      height: '48px',
                      border: '1px solid #E6E8EC',
                      borderRadius: '24px',
                      background: '#FFFFFF',
                    }}
                  >
                    <select
                      id="p-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        boxSizing: 'border-box',
                        padding: '0 44px 0 17px',
                        border: 0,
                        borderRadius: '24px',
                        outline: 'none',
                        background: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: '16px',
                        color: category ? '#111827' : '#8A90A0',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#4B5263"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ position: 'absolute', right: '17px', top: '17px', pointerEvents: 'none' }}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </section>

              {/* Delete Product Section (in Edit mode only) */}
              {mode === 'edit' && productId && (
                <section
                  style={{
                    boxSizing: 'border-box',
                    padding: '24px',
                    background: '#FFFFFF',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
                      Delete product
                    </h2>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                      Removes it from your store for good. This can&apos;t be undone.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxSizing: 'border-box',
                      height: '44px',
                      padding: '0 20px 0 16px',
                      border: '1px solid #F3C1BC',
                      borderRadius: '22px',
                      background: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: '#B42318',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <TrashIcon style={{ width: '16px', height: '16px' }} />
                    Delete product
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        itemName={name}
        itemCount={1}
        loading={deleting}
        onConfirm={handleDeleteProduct}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
