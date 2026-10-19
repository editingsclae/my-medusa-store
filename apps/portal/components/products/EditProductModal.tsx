'use client';

import React, { useState, useEffect } from 'react';
import { MerchantProduct, updateMerchantProduct, uploadMerchantMedia } from '@/lib/medusa';
import ImageDropzone from './ImageDropzone';

interface EditProductModalProps {
  isOpen: boolean;
  product: MerchantProduct | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProductModal({
  isOpen,
  product,
  onClose,
  onSuccess,
}: EditProductModalProps) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [inventory, setInventory] = useState('10');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setTitle(product.title || '');
      setSubtitle(product.subtitle || '');
      setDescription(product.description || '');

      const priceObj = product.variants?.[0]?.prices?.[0];
      setPrice(priceObj?.amount !== undefined ? String(priceObj.amount) : '');

      const stock = product.variants?.[0]?.inventory_quantity;
      setInventory(stock !== undefined ? String(stock) : '10');

      setStatus(product.status === 'published' ? 'published' : 'draft');
      setImageUrl(product.thumbnail || product.images?.[0]?.url || null);
      setError(null);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleFileSelect = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const uploadRes = await uploadMerchantMedia(file);
      setImageUrl(uploadRes.url);
    } catch (err: any) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Product title is required');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please provide a valid price');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateMerchantProduct(product.id, {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        price: numPrice,
        inventory_quantity: parseInt(inventory, 10) || 0,
        thumbnail: imageUrl || null,
        images: imageUrl ? [imageUrl] : [],
        status,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(6, 10, 25, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              Modify Product
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '14px',
                color: '#6B7280',
              }}
            >
              Update catalog details, pricing, stock and media
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              fontSize: '24px',
              color: '#9CA3AF',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: '#FEE2E2',
              color: '#DC2626',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '20px',
              border: '1px solid #FCA5A5',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Title */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Product Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Classic Cotton Overshirt"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '12px',
                border: '1px solid #D1D5DB',
                fontSize: '15px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Subtitle / Category */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Category / Subtitle
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Shirts, Apparel, Accessories"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '12px',
                border: '1px solid #D1D5DB',
                fontSize: '15px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Price & Inventory row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Price *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid #D1D5DB',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Stock Quantity
              </label>
              <input
                type="number"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder="10"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid #D1D5DB',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the product..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #D1D5DB',
                fontSize: '15px',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Product Image (Cloudflare R2)
            </label>
            <ImageDropzone
              imageUrl={imageUrl}
              uploading={uploadingImage}
              onFileSelect={handleFileSelect}
              onRemove={() => setImageUrl(null)}
            />
          </div>

          {/* Status radio */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Publish Status
            </label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="edit-status"
                  value="published"
                  checked={status === 'published'}
                  onChange={() => setStatus('published')}
                />
                <span style={{ fontSize: '14px', color: '#111827' }}>Published</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="edit-status"
                  value="draft"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                />
                <span style={{ fontSize: '14px', color: '#111827' }}>Draft</span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0 20px',
                height: '44px',
                borderRadius: '22px',
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0 24px',
                height: '44px',
                borderRadius: '22px',
                border: 0,
                background: saving ? '#9CA3AF' : 'var(--accent)',
                fontSize: '15px',
                fontWeight: 500,
                color: '#FFFFFF',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
