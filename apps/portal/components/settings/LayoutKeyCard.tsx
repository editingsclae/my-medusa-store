'use client';

import React, { useState } from 'react';
import { createLayoutKey, type StorefrontLayoutInfo } from '@/lib/medusa';
import { smallButton } from '@/components/settings/styles';

type Props = {
  layout: StorefrontLayoutInfo | null;
  // Called after a key was created, so the page knows one exists
  onKeyCreated: () => void;
};

const box: React.CSSProperties = {
  marginTop: '24px',
  padding: '16px',
  border: '1px solid #E6E8EC',
  borderRadius: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

// For whoever builds the storefront: a storefront tells us how many promo
// banners it has room for, and proves it is this store's with this key.
export default function LayoutKeyCard({ layout, onKeyCreated }: Props) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasKey = layout?.key_set === true;

  const create = async () => {
    if (hasKey && !window.confirm('This replaces the current key. The storefront has to be given the new one. Continue?')) {
      return;
    }
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await createLayoutKey();
      setKey(res.layout_key);
      onKeyCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the key.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={box} data-testid="layout-key-card">
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Storefront connection</h3>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#4B5263' }}>
        {layout?.declared
          ? `Your storefront has told us it has ${layout.promo_banners} promo banner ${layout.promo_banners === 1 ? 'place' : 'places'}.`
          : 'Your storefront has not told us yet how many promo banners it has, so 2 places are available.'}{' '}
        A storefront does this with a layout key. Create one and give it to whoever builds your storefront; it is shown only once.
      </p>

      {key && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <code
            data-testid="layout-key"
            style={{ display: 'block', padding: '10px 12px', background: '#F3F4F6', borderRadius: '12px', fontSize: '13px', overflowWrap: 'anywhere' }}
          >
            {key}
          </code>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={smallButton} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <span style={{ fontSize: '13px', color: '#92400E' }}>Save it now. It cannot be shown again.</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: '14px', color: '#B42318' }}>
          {error}
        </p>
      )}

      <div>
        <button type="button" style={smallButton} onClick={create} disabled={busy}>
          {busy ? 'Creating...' : hasKey ? 'Create a new key' : 'Create a layout key'}
        </button>
      </div>
    </div>
  );
}
