'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  createPlatformMerchant,
  getMerchantMe,
  getPlatformMerchants,
  CreatedMerchant,
  PlatformMerchant,
} from '@/lib/medusa';

const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  boxSizing: 'border-box',
  padding: '0 17px',
  border: '1px solid #E6E8EC',
  borderRadius: '22px',
  background: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: '16px',
  color: '#111827',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '14px',
  fontWeight: 500,
  color: '#1F2937',
  minWidth: 0,
};

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 400,
  color: '#6B7280',
};

const pillButton: React.CSSProperties = {
  height: '44px',
  boxSizing: 'border-box',
  padding: '0 20px',
  borderRadius: '22px',
  fontFamily: 'inherit',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  margin: '0 16px 17px 24px',
  background: '#FFFFFF',
  borderRadius: '24px',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "tn, fr" -> ["tn", "fr"]. Returns null when a code is not two letters.
function parseCountries(input: string): string[] | null {
  const parts = input
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return ['tn'];
  if (parts.some((code) => !/^[a-z]{2}$/.test(code))) return null;
  return Array.from(new Set(parts));
}

export default function MerchantsPage() {
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [merchants, setMerchants] = useState<PlatformMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countries, setCountries] = useState('tn');
  const [shippingPrice, setShippingPrice] = useState('0');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [created, setCreated] = useState<CreatedMerchant | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await getPlatformMerchants();
      setMerchants(res.merchants || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load merchants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getMerchantMe()
      .then((profile) => {
        const admin = Boolean(profile.is_super_admin);
        setIsPlatformAdmin(admin);
        if (admin) load();
      })
      .catch(() => setIsPlatformAdmin(false))
      .finally(() => setChecking(false));
  }, [load]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setCountries('tn');
    setShippingPrice('0');
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const storeName = name.trim();
    const ownerEmail = email.trim().toLowerCase();

    if (!storeName) return setFormError('Enter the store name.');
    if (storeName.length > MAX_NAME_LENGTH) {
      return setFormError(`The store name can be at most ${MAX_NAME_LENGTH} characters.`);
    }
    if (!EMAIL_PATTERN.test(ownerEmail)) return setFormError('Enter a valid owner email.');
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setFormError(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const countryCodes = parseCountries(countries);
    if (!countryCodes) {
      return setFormError('Delivery countries must be two-letter codes separated by commas, for example tn, fr.');
    }

    const price = shippingPrice.trim() === '' ? 0 : Number(shippingPrice);
    if (!Number.isFinite(price) || price < 0) {
      return setFormError('The shipping price must be zero or more.');
    }

    setCreating(true);
    try {
      const res = await createPlatformMerchant({
        name: storeName,
        email: ownerEmail,
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        countries: countryCodes,
        shipping_price: price,
      });
      setCreated(res.merchant);
      setCopied(false);
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the merchant.');
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.publishable_key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const header = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '28px 16px 20px 24px',
        minHeight: '44px',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px' }}>Merchants</h1>
      {isPlatformAdmin && !showForm && (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setCreated(null);
          }}
          style={{ ...pillButton, border: 0, background: 'var(--accent)', color: '#FFFFFF' }}
        >
          Add merchant
        </button>
      )}
    </div>
  );

  if (checking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {header}
        <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading...</div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {header}
        <section style={{ ...cardStyle, padding: '32px 24px' }} role="alert">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Platform admins only</h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#4B5263' }}>
            Merchant accounts are created and managed by the platform admin.
          </p>
        </section>
      </div>
    );
  }

  const fulfillmentOk = created?.fulfillment && !created.fulfillment_error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {header}

      {created && (
        <section style={{ ...cardStyle, padding: '24px' }} role="status">
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>
            Merchant created: {created.sales_channel.name}
          </h2>
          <p style={{ margin: '4px 0 16px', fontSize: '14px', color: '#4B5263' }}>
            The owner can now sign in to this portal with {created.user.email}.
          </p>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#1F2937' }}>Publishable key (for the storefront)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                <code
                  style={{
                    flex: '1 1 320px',
                    minWidth: 0,
                    padding: '10px 14px',
                    border: '1px solid #E6E8EC',
                    borderRadius: '14px',
                    background: '#F7F8FA',
                    fontSize: '13px',
                    wordBreak: 'break-all',
                  }}
                >
                  {created.publishable_key}
                </code>
                <button
                  type="button"
                  onClick={copyKey}
                  style={{
                    ...pillButton,
                    height: '40px',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    color: '#374151',
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '14px', color: '#1F2937' }}>
              <strong>Sales channel id:</strong> <code>{created.sales_channel.id}</code>
            </div>

            <div
              style={{
                padding: '10px 16px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 500,
                border: `1px solid ${fulfillmentOk ? '#9BDDB4' : '#F5B5B5'}`,
                background: fulfillmentOk ? '#F2FBF6' : '#FEF2F2',
                color: fulfillmentOk ? '#17803F' : '#B42318',
              }}
            >
              {fulfillmentOk
                ? created.fulfillment?.created === false
                  ? 'Delivery was already set up for this location.'
                  : `Delivery set up for ${(created.fulfillment?.countries || []).join(', ').toUpperCase()} with a Standard Shipping option.`
                : `Delivery setup failed: ${created.fulfillment_error || 'unknown error'}. Set it up in the Medusa admin under Locations & Shipping, or run the backfill script.`}
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
              When this merchant gets a storefront, add the storefront address to STORE_CORS and AUTH_CORS on the
              backend and redeploy.
            </p>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setCreated(null)}
              style={{
                ...pillButton,
                height: '40px',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #D1D5DB',
                background: '#FFFFFF',
                color: '#374151',
              }}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {showForm && (
        <section style={{ ...cardStyle, padding: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>New merchant</h2>
          <p style={{ margin: '4px 0 16px', fontSize: '14px', fontWeight: 500, color: '#4B5263' }}>
            Creates the store, its warehouse, its delivery setup, a storefront key and the owner login in one step.
          </p>

          <form onSubmit={handleCreate}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              <label style={labelStyle}>
                Store name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  style={inputStyle}
                  autoFocus
                />
              </label>
              <label style={labelStyle}>
                Owner email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                />
                <span style={hintStyle}>At least {MIN_PASSWORD_LENGTH} characters. Share it with the owner safely.</span>
              </label>
              <label style={labelStyle}>
                Owner first name (optional)
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Owner last name (optional)
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Delivery countries
                <input type="text" value={countries} onChange={(e) => setCountries(e.target.value)} style={inputStyle} />
                <span style={hintStyle}>Two-letter codes separated by commas, for example tn, fr.</span>
              </label>
              <label style={labelStyle}>
                Standard shipping price
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={shippingPrice}
                  onChange={(e) => setShippingPrice(e.target.value)}
                  style={inputStyle}
                />
                <span style={hintStyle}>In the store currency. 0 means free shipping.</span>
              </label>
            </div>

            {formError && (
              <div
                role="alert"
                style={{
                  marginTop: '16px',
                  padding: '10px 16px',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid #F5B5B5',
                  background: '#FEF2F2',
                  color: '#B42318',
                }}
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '20px' }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  ...pillButton,
                  border: 0,
                  background: creating ? '#9CA3AF' : 'var(--accent)',
                  color: '#FFFFFF',
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Creating...' : 'Create merchant'}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={{
                  ...pillButton,
                  fontWeight: 500,
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  color: '#374151',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section style={cardStyle}>
        <div style={{ padding: '24px 24px 8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>All merchants</h2>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
            Each merchant is one store with its own products, categories, orders and storefront key.
          </p>
        </div>

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <div style={{ minWidth: '640px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(200px, 1.4fr) 100px 100px 140px',
                alignItems: 'center',
                height: '40px',
                boxSizing: 'border-box',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              <span>Store</span>
              <span>Owner</span>
              <span>Products</span>
              <span>Orders</span>
              <span>Created</span>
            </div>

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading merchants...</div>
            ) : loadError ? (
              <div role="alert" style={{ padding: '48px', textAlign: 'center', color: '#B42318' }}>
                {loadError}
              </div>
            ) : merchants.length === 0 ? (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '96px',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#4B5263',
                }}
              >
                No merchants yet. Add the first one above.
              </div>
            ) : (
              merchants.map((merchant) => (
                <div
                  key={merchant.user.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(200px, 1.4fr) 100px 100px 140px',
                    alignItems: 'center',
                    minHeight: '64px',
                    boxSizing: 'border-box',
                    padding: '8px 24px',
                    borderBottom: '1px solid #EDEFF3',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#111827',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>
                    {merchant.sales_channel?.name || 'No sales channel'}
                    {merchant.sales_channel?.is_disabled ? ' (disabled)' : ''}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px', color: '#4B5263' }}>
                    {merchant.user.email}
                  </span>
                  <span>{merchant.product_count}</span>
                  <span>{merchant.order_count}</span>
                  <span style={{ color: '#4B5263' }}>
                    {merchant.user.created_at ? new Date(merchant.user.created_at).toLocaleDateString('en-GB') : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div style={{ height: '16px' }} />
      </section>
    </div>
  );
}
