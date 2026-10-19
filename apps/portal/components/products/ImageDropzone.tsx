'use client';

import React, { useState, useRef } from 'react';
import { UploadCloudIcon } from '@/components/icons';

interface ImageDropzoneProps {
  imageUrl: string | null;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export default function ImageDropzone({
  imageUrl,
  uploading,
  onFileSelect,
  onRemove,
  disabled = false,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we leave the current container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onFileSelect(file);
      } else {
        alert('Please drop a valid image file (PNG, JPG, WEBP, GIF).');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // reset so re-selecting same filename triggers change
      e.target.value = '';
    }
  };

  const handleClickBrowse = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {imageUrl ? (
        /* Image Preview with Replace / Remove controls */
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 16px',
            border: isDragging ? '2px dashed var(--accent)' : '1px solid #E5E7EB',
            background: isDragging ? '#F5F3FF' : '#F9FAFB',
            borderRadius: '16px',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Thumbnail Preview */}
          <div
            style={{
              position: 'relative',
              width: '84px',
              height: '84px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #E5E7EB',
              flexShrink: 0,
              background: '#FFFFFF',
            }}
          >
            <img
              src={imageUrl}
              alt="Product thumbnail"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            <button
              type="button"
              onClick={onRemove}
              title="Remove image"
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#FFFFFF',
                border: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Description & Replace button */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              {isDragging ? 'Drop to replace image' : 'Product Photo'}
            </p>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#6B7280' }}>
              {isDragging
                ? 'Release to upload new photo'
                : 'Drag a new image here, or click to replace'}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleClickBrowse}
                disabled={uploading}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {uploading ? 'Uploading...' : 'Replace photo'}
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 0,
                  background: 'transparent',
                  color: '#EF4444',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone Empty State */
        <div
          role="button"
          tabIndex={0}
          onClick={handleClickBrowse}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClickBrowse();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            width: '100%',
            minHeight: '120px',
            border: isDragging
              ? '2px dashed var(--accent)'
              : '2px dashed #D1D5DB',
            borderRadius: '16px',
            background: isDragging ? '#F5F3FF' : '#F9FAFB',
            boxSizing: 'border-box',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
        >
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #E5E7EB',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent)' }}>
                Uploading to Cloudflare R2...
              </span>
            </div>
          ) : (
            <>
              {/* Cloud Upload Icon */}
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: isDragging ? '#EDE9FE' : '#EEF2F6',
                  color: isDragging ? 'var(--accent)' : '#4B5563',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                  transition: 'all 0.2s ease',
                }}
              >
                <UploadCloudIcon style={{ width: '22px', height: '22px' }} />
              </div>

              {/* Main text */}
              <div style={{ fontSize: '14px', color: '#1F2937', marginBottom: '4px' }}>
                {isDragging ? (
                  <strong style={{ color: 'var(--accent)' }}>Drop image here to upload</strong>
                ) : (
                  <>
                    <strong style={{ color: 'var(--accent)' }}>Click to upload</strong> or drag and drop
                  </>
                )}
              </div>

              {/* Supported formats */}
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                PNG, JPG, WEBP, or GIF (max 10MB)
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
