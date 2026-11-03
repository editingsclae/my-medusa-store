'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getFooterSettings,
  getMerchantMe,
  saveFooterSettings,
  FooterContent,
  FooterLimits,
  FooterNetwork,
} from '@/lib/medusa';
import {
  DEFAULT_LIMITS,
  NETWORKS,
  NETWORK_NAMES,
  NETWORK_PLACEHOLDERS,
  emptyFooter,
  validateFooter,
  visibleNetworks,
} from '@/lib/footer';

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

const counterStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  fontSize: '12px',
  fontWeight: 400,
  color: '#6B7280',
};

export default function FooterSettingsPage() {
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [footer, setFooter] = useState<FooterContent>(emptyFooter());
  const [savedJson, setSavedJson] = useState('');
  const [limits, setLimits] = useState<FooterLimits>(DEFAULT_LIMITS);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await getFooterSettings();
      setFooter(res.footer);
      setSavedJson(JSON.stringify(res.footer));
      setLimits({ ...DEFAULT_LIMITS, ...res.limits });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your footer.');
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

  const dirty = JSON.stringify(footer) !== savedJson;

  const setText = (field: 'store_name' | 'description', value: string) => {
    setMessage(null);
    setFooter((prev) => ({ ...prev, [field]: value }));
  };

  const setLink = (network: FooterNetwork, patch: Partial<{ url: string; enabled: boolean }>) => {
    setMessage(null);
    setFooter((prev) => {
      const next = { ...prev.social[network], ...patch };
      // A network without a link cannot be on
      if (next.url.trim() === '') next.enabled = false;
      return { ...prev, social: { ...prev.social, [network]: next } };
    });
  };

  const handleSave = async () => {
    const problem = validateFooter(footer, limits);
    if (problem) return setMessage({ kind: 'error', text: problem });

    setSaving(true);
    setMessage(null);
    try {
      const res = await saveFooterSettings(footer);
      // The server cleans the links (an @name becomes the full address)
      setFooter(res.footer);
      setSavedJson(JSON.stringify(res.footer));
      setMessage({ kind: 'ok', text: 'Saved. Your store shows the new footer right away.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading...</div>;
  }

  if (isPlatformAdmin) {
    return (
      <section style={{ ...cardStyle, padding: '32px 24px' }} role="status">
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Settings belong to each merchant</h2>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#4B5263' }}>
          The footer of a store is managed by the merchant who owns it. Sign in with a merchant account to change it.
        </p>
      </section>
    );
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading...</div>;
  }

  if (loadError) {
    return (
      <section style={{ ...cardStyle, padding: '24px' }}>
        <div role="alert" style={{ fontSize: '14px', color: '#B42318' }}>
          {loadError}{' '}
          <button type="button" onClick={load} style={smallButton}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const shown = visibleNetworks(footer);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          style={{
            margin: '0 16px 17px 24px',
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

      <section style={{ ...cardStyle, padding: '24px' }} aria-labelledby="footer-about-heading">
        <h2 id="footer-about-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          About your store
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4B5263' }}>
          The name and the short text shown at the bottom of every page of your store.
        </p>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <label style={labelStyle}>
            Store name
            <input
              type="text"
              value={footer.store_name}
              onChange={(e) => setText('store_name', e.target.value)}
              placeholder="Leave empty to use your store's usual name"
              style={inputStyle}
            />
            <span style={counterStyle}>
              {footer.store_name.length} / {limits.store_name}
            </span>
          </label>
          <label style={labelStyle}>
            Description
            <textarea
              value={footer.description}
              onChange={(e) => setText('description', e.target.value)}
              rows={3}
              placeholder="A short sentence about your store"
              style={{
                ...inputStyle,
                height: 'auto',
                minHeight: '88px',
                padding: '12px 17px',
                borderRadius: '18px',
                resize: 'vertical',
                lineHeight: '24px',
              }}
            />
            <span style={counterStyle}>
              {footer.description.length} / {limits.description}
            </span>
          </label>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: '24px' }} aria-labelledby="footer-social-heading">
        <h2 id="footer-social-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Social media
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4B5263' }}>
          Paste the link of your page, or just your @name. Switch a network off to hide it from your footer without losing
          the link.
        </p>
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '14px' }}>
          {NETWORKS.map((network) => {
            const link = footer.social[network];
            const empty = link.url.trim() === '';
            return (
              <li
                key={network}
                style={{
                  border: '1px solid #E6E8EC',
                  borderRadius: '18px',
                  padding: '16px',
                  background: link.enabled ? '#FFFFFF' : '#F7F8FA',
                  display: 'grid',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '16px', flex: '1 1 auto' }}>{NETWORK_NAMES[network]}</strong>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      opacity: empty ? 0.55 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={link.enabled}
                      disabled={empty}
                      onChange={(e) => setLink(network, { enabled: e.target.checked })}
                      aria-label={`Show ${NETWORK_NAMES[network]} in my footer`}
                    />
                    Show in my footer
                  </label>
                </div>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  value={link.url}
                  onChange={(e) => setLink(network, { url: e.target.value })}
                  placeholder={NETWORK_PLACEHOLDERS[network]}
                  aria-label={`${NETWORK_NAMES[network]} link`}
                  style={inputStyle}
                />
                {empty && (
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>Add the link to be able to switch it on.</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section style={{ ...cardStyle, padding: '24px' }} aria-labelledby="footer-preview-heading">
        <h2 id="footer-preview-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Preview
        </h2>
        <p style={{ margin: '4px 0 16px', fontSize: '14px', color: '#4B5263' }}>
          A simple preview. The look follows the design of your store.
        </p>
        <div
          data-testid="footer-preview"
          style={{ border: '1px solid #E6E8EC', borderRadius: '16px', background: '#FAFAFA', padding: '20px' }}
        >
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {footer.store_name.trim() || 'Your store name'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#4B5263' }}>
            {footer.description.trim() || 'Your store usually shows its own line here.'}
          </p>
          {shown.length > 0 && (
            <p style={{ margin: '14px 0 0', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', fontWeight: 600 }}>
              {shown.map((network) => (
                <span key={network} data-network={network}>
                  {NETWORK_NAMES[network]}
                </span>
              ))}
            </p>
          )}
        </div>
      </section>

      <div
        style={{
          margin: '0 16px 32px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={handleSave}
          style={{
            ...pillButton,
            border: 0,
            background: 'var(--accent)',
            color: '#FFFFFF',
            opacity: saving || !dirty ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <span style={{ fontSize: '14px', color: dirty ? '#B54708' : '#6B7280' }}>
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
      </div>
    </div>
  );
}
