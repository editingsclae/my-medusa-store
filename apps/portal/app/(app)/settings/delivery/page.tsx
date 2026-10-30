'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  createDeliveryOption,
  deleteDeliveryOption,
  getDeliveryOptions,
  getMerchantMe,
  updateDeliveryOption,
  DeliveryOption,
} from '@/lib/medusa';
import ConfirmDeleteModal from '@/components/products/ConfirmDeleteModal';

const MAX_NAME_LENGTH = 60;
const MAX_PRICE = 100000;

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

const smallButton: React.CSSProperties = {
  height: '36px',
  boxSizing: 'border-box',
  padding: '0 16px',
  borderRadius: '18px',
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#374151',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 500,
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

// "7,5" and "7.5" both work. Returns null when it is not a usable price.
function parsePrice(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) return null;
  return Math.round(value * 1000) / 1000;
}

function formatAmount(price: number | null, currency: string): string {
  if (price === null) return 'Not set';
  if (price === 0) return 'Free';
  const text = price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
  return `${text} ${currency.toUpperCase()}`;
}

export default function DeliverySettingsPage() {
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [currency, setCurrency] = useState('tnd');
  const [countries, setCountries] = useState<string[]>([]);
  const [canAdd, setCanAdd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [adding, setAdding] = useState(false);

  const [toDelete, setToDelete] = useState<DeliveryOption | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await getDeliveryOptions();
      setOptions(res.delivery_options || []);
      setCurrency(res.currency_code || 'tnd');
      setCountries(res.countries || []);
      setCanAdd(Boolean(res.can_add));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your delivery options.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getMerchantMe()
      .then((profile) => {
        const admin = Boolean(profile.is_super_admin);
        setIsPlatformAdmin(admin);
        if (!admin) load();
      })
      .catch(() => setIsPlatformAdmin(false))
      .finally(() => setChecking(false));
  }, [load]);

  const enabledCount = options.filter((o) => o.enabled).length;

  const startEdit = (option: DeliveryOption) => {
    setEditingId(option.id);
    setEditName(option.name);
    setEditPrice(option.price === null ? '' : String(option.price));
    setMessage(null);
  };

  const saveEdit = async (option: DeliveryOption) => {
    const name = editName.replace(/\s+/g, ' ').trim();
    if (!name) return setMessage({ kind: 'error', text: 'Enter a name for this delivery option.' });
    if (name.length > MAX_NAME_LENGTH) {
      return setMessage({ kind: 'error', text: `The name can be at most ${MAX_NAME_LENGTH} characters.` });
    }

    const body: { name?: string; price?: number } = {};
    if (name !== option.name) body.name = name;

    if (option.is_flat) {
      const price = parsePrice(editPrice);
      if (price === null) {
        return setMessage({ kind: 'error', text: 'Enter a price of 0 or more. Use 0 for free delivery.' });
      }
      if (price !== option.price) body.price = price;
    }

    if (Object.keys(body).length === 0) {
      setEditingId(null);
      return;
    }

    setBusyId(option.id);
    setMessage(null);
    try {
      await updateDeliveryOption(option.id, body);
      await load();
      setEditingId(null);
      setMessage({ kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (option: DeliveryOption) => {
    setBusyId(option.id);
    setMessage(null);
    try {
      await updateDeliveryOption(option.id, { enabled: !option.enabled });
      await load();
      setMessage({
        kind: 'ok',
        text: option.enabled ? 'Switched off. Shoppers no longer see it.' : 'Switched on. Shoppers can choose it.',
      });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not update.' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteDeliveryOption(toDelete.id);
      setToDelete(null);
      await load();
      setMessage({ kind: 'ok', text: 'Delivery option deleted.' });
    } catch (err) {
      setToDelete(null);
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not delete.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const name = newName.replace(/\s+/g, ' ').trim();
    if (!name) return setMessage({ kind: 'error', text: 'Enter a name, for example "Aramex" or "Express".' });
    if (name.length > MAX_NAME_LENGTH) {
      return setMessage({ kind: 'error', text: `The name can be at most ${MAX_NAME_LENGTH} characters.` });
    }
    const price = parsePrice(newPrice);
    if (price === null) {
      return setMessage({ kind: 'error', text: 'Enter a price of 0 or more. Use 0 for free delivery.' });
    }

    setAdding(true);
    try {
      await createDeliveryOption({ name, price });
      setNewName('');
      setNewPrice('');
      await load();
      setMessage({ kind: 'ok', text: 'Delivery option added. Shoppers can choose it now.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not add the option.' });
    } finally {
      setAdding(false);
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading...</div>
      </div>
    );
  }

  if (isPlatformAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <section style={{ ...cardStyle, padding: '32px 24px' }} role="status">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Settings belong to each merchant</h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#4B5263' }}>
            Delivery options are managed by the merchant who owns the store. Sign in with a merchant account to
            change them.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <section style={{ ...cardStyle, padding: '24px' }} aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Delivery
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4B5263' }}>
          The delivery options shoppers can choose at checkout. Prices are in {currency.toUpperCase()}.
          {countries.length > 0 && <> Delivers to: {countries.map((c) => c.toUpperCase()).join(', ')}.</>}
        </p>

        {message && (
          <div
            role={message.kind === 'error' ? 'alert' : 'status'}
            style={{
              marginTop: '16px',
              padding: '10px 16px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 500,
              border: `1px solid ${message.kind === 'ok' ? '#9BDDB4' : '#F5B5B5'}`,
              background: message.kind === 'ok' ? '#F2FBF6' : '#FEF2F2',
              color: message.kind === 'ok' ? '#17803F' : '#B42318',
            }}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8A90A0' }}>Loading...</div>
        ) : loadError ? (
          <div role="alert" style={{ marginTop: '16px', fontSize: '14px', color: '#B42318' }}>
            {loadError}{' '}
            <button type="button" onClick={load} style={smallButton}>
              Try again
            </button>
          </div>
        ) : options.length === 0 ? (
          <p style={{ margin: '16px 0 0', fontSize: '14px', color: '#4B5263' }}>
            You have no delivery options yet. Shoppers cannot check out until you add one.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '10px' }}>
            {options.map((option) => {
              const isEditing = editingId === option.id;
              const busy = busyId === option.id;
              const lastOn = option.enabled && enabledCount === 1;

              return (
                <li
                  key={option.id}
                  style={{
                    border: '1px solid #E6E8EC',
                    borderRadius: '18px',
                    padding: '14px 16px',
                    background: option.enabled ? '#FFFFFF' : '#F7F8FA',
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                      <label style={{ ...labelStyle, flex: '2 1 200px' }}>
                        Name
                        <input
                          value={editName}
                          maxLength={MAX_NAME_LENGTH}
                          onChange={(e) => setEditName(e.target.value)}
                          style={inputStyle}
                        />
                      </label>
                      <label style={{ ...labelStyle, flex: '1 1 140px' }}>
                        Price ({currency.toUpperCase()})
                        <input
                          value={editPrice}
                          inputMode="decimal"
                          disabled={!option.is_flat}
                          onChange={(e) => setEditPrice(e.target.value)}
                          style={{ ...inputStyle, background: option.is_flat ? '#FFFFFF' : '#F3F4F6' }}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => saveEdit(option)}
                          style={{
                            ...pillButton,
                            border: 0,
                            background: 'var(--accent)',
                            color: '#FFFFFF',
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          {busy ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                          style={{ ...pillButton, border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#374151' }}
                        >
                          Cancel
                        </button>
                      </div>
                      {!option.is_flat && (
                        <p style={{ margin: 0, flexBasis: '100%', fontSize: '12px', color: '#6B7280' }}>
                          This option has a calculated price, so only its name can be changed here.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, wordBreak: 'break-word' }}>{option.name}</div>
                        <div style={{ fontSize: '14px', color: '#4B5263', marginTop: '2px' }}>
                          {option.is_flat ? formatAmount(option.price, option.currency_code) : 'Calculated price'}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '14px',
                          fontSize: '13px',
                          fontWeight: 600,
                          background: option.enabled ? '#E8F7EE' : '#ECEEF2',
                          color: option.enabled ? '#17803F' : '#6B7280',
                        }}
                      >
                        {option.enabled ? 'On' : 'Off'}
                      </span>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button type="button" disabled={busy} onClick={() => startEdit(option)} style={smallButton}>
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy || lastOn}
                          title={lastOn ? 'Keep at least one option on so shoppers can check out' : undefined}
                          onClick={() => toggleEnabled(option)}
                          style={{ ...smallButton, opacity: busy || lastOn ? 0.5 : 1 }}
                        >
                          {option.enabled ? 'Switch off' : 'Switch on'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || lastOn}
                          title={lastOn ? 'Keep at least one option so shoppers can check out' : undefined}
                          onClick={() => setToDelete(option)}
                          style={{
                            ...smallButton,
                            color: '#B42318',
                            borderColor: '#F5B5B5',
                            opacity: busy || lastOn ? 0.5 : 1,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !loadError && (
          <form
            onSubmit={handleAdd}
            style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #EEF0F3' }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Add a delivery option</h3>
            {canAdd ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                <label style={{ ...labelStyle, flex: '2 1 200px' }}>
                  Name
                  <input
                    value={newName}
                    maxLength={MAX_NAME_LENGTH}
                    placeholder="Express delivery"
                    onChange={(e) => setNewName(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={{ ...labelStyle, flex: '1 1 140px' }}>
                  Price ({currency.toUpperCase()})
                  <input
                    value={newPrice}
                    inputMode="decimal"
                    placeholder="7"
                    onChange={(e) => setNewPrice(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <button
                  type="submit"
                  disabled={adding}
                  style={{
                    ...pillButton,
                    border: 0,
                    background: 'var(--accent)',
                    color: '#FFFFFF',
                    opacity: adding ? 0.6 : 1,
                  }}
                >
                  {adding ? 'Adding...' : 'Add option'}
                </button>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', color: '#4B5263' }}>
                You have reached the maximum number of delivery options, or delivery is not set up yet. Ask the
                platform admin if you need more.
              </p>
            )}
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6B7280' }}>
              Enter the price the shopper pays. Use 0 for free delivery.
            </p>
          </form>
        )}
      </section>

      <ConfirmDeleteModal
        isOpen={toDelete !== null}
        title="Delete Delivery Option"
        itemName={toDelete?.name}
        loading={deleting}
        confirmLabel="Delete Option"
        message={
          toDelete ? (
            <>
              Delete <strong>&ldquo;{toDelete.name}&rdquo;</strong>? Shoppers will no longer be able to choose it.
              Orders already placed are not affected. You can also switch it off instead.
            </>
          ) : undefined
        }
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
