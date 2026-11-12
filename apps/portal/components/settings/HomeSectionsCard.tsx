'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getHomeSections,
  saveHomeSections,
  type HomeSectionKey,
  type HomeSectionsResponse,
  type HomeSectionsSettings,
  type MerchantProduct,
} from '@/lib/medusa';
import { MAX_TITLE, featuredOver, isDirty, moveItem, sectionHelp, validateSettings } from '@/lib/home-sections';
import { inputStyle, pillButton, iconButton, smallButton, sectionHintStyle, sectionTitleStyle } from '@/components/settings/styles';
import { Skeleton, LoadingRegion } from '@/components/ui/Skeleton';

type Props = {
  // The merchant's products, for choosing the featured ones
  products: MerchantProduct[];
};

const muted: React.CSSProperties = { margin: '16px 0 0', fontSize: '14px', color: '#4B5263' };
const errorText: React.CSSProperties = { margin: '16px 0 0', fontSize: '14px', color: '#B42318' };

const rowStyle: React.CSSProperties = {
  border: '1px solid #E6E8EC',
  borderRadius: '16px',
  padding: '16px',
  display: 'grid',
  gap: '12px',
};

// The product sections of the home page. Which ones exist, in which order and how
// many products they show is decided by the storefront's design; the merchant
// switches them on or off, renames them and chooses the featured products.
export default function HomeSectionsCard({ products }: Props) {
  const [info, setInfo] = useState<HomeSectionsResponse | null>(null);
  const [saved, setSaved] = useState<HomeSectionsSettings | null>(null);
  const [draft, setDraft] = useState<HomeSectionsSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const show = useCallback((res: HomeSectionsResponse) => {
    setInfo(res);
    setSaved(res.settings);
    setDraft(res.settings);
  }, []);

  const failed = (err: unknown) =>
    setLoadError(err instanceof Error ? err.message : 'Could not load your home page sections.');

  // The first load: state is only set when the answer arrives
  useEffect(() => {
    let active = true;
    getHomeSections()
      .then((res) => {
        if (active) show(res);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Could not load your home page sections.');
      });
    return () => {
      active = false;
    };
  }, [show]);

  const retry = () => {
    setLoadError(null);
    getHomeSections().then(show).catch(failed);
  };

  if (loadError) {
    return (
      <div style={{ padding: '20px 24px 24px' }}>
        <p role="alert" style={errorText}>{loadError}</p>
        <button type="button" style={{ ...smallButton, marginTop: '12px' }} onClick={retry}>Try again</button>
      </div>
    );
  }
  if (!info || !draft || !saved) {
    return (
      <LoadingRegion label="Loading home sections" style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton width={180} height={24} />
        <Skeleton width="60%" height={14} />
        <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ border: '1px solid #E6E8EC', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton width={140} height={18} />
                <Skeleton width={200} height={14} />
              </div>
              <Skeleton width={60} height={32} radius={16} />
            </div>
          ))}
        </div>
      </LoadingRegion>
    );
  }

  const featuredRoom = info.declared.find((s) => s.key === 'featured')?.count ?? 0;
  const over = featuredOver(draft.featured_ids.length, featuredRoom);
  const dirty = isDirty(saved, draft);
  const problem = validateSettings(draft);
  const byId = new Map(products.map((p) => [p.id, p]));
  const choices = products.filter((p) => p.status === 'published' && !draft.featured_ids.includes(p.id));

  const change = (next: HomeSectionsSettings) => {
    setMessage(null);
    setDraft(next);
  };
  const setSection = (key: HomeSectionKey, patch: Partial<{ enabled: boolean; title: string }>) =>
    change({ ...draft, sections: { ...draft.sections, [key]: { ...draft.sections[key], ...patch } } });

  const save = async () => {
    if (problem) {
      setMessage({ kind: 'error', text: problem });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await saveHomeSections(draft);
      setInfo(res);
      setSaved(res.settings);
      setDraft(res.settings);
      setMessage({ kind: 'ok', text: 'Saved. Your store shows the change right away.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="tabpanel" id="appearance-panel-home_sections" aria-labelledby="appearance-tab-home_sections" style={{ padding: '20px 24px 24px' }}>
      <h2 id="home_sections-heading" style={sectionTitleStyle}>Home page sections</h2>
      <p style={sectionHintStyle}>
        Rows of products on your home page. You can switch each one off, rename it and choose your featured products.
      </p>

      {info.declared.length === 0 ? (
        <p style={muted} data-testid="sections-none">
          Your storefront has not told us yet which product sections it has. They appear here as soon as it does.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '12px' }}>
          {info.declared.map((section) => {
            const setting = draft.sections[section.key];
            return (
              <li key={section.key} style={rowStyle} data-testid={`section-${section.key}`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '16px' }}>{section.default_title}</strong>
                  <label style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '14px', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={setting.enabled}
                      onChange={(e) => setSection(section.key, { enabled: e.target.checked })}
                    />
                    Show on my store
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#4B5263' }}>
                  {sectionHelp(section.key, section.count, info.windows)} Shows up to {section.count} product
                  {section.count === 1 ? '' : 's'}.
                </p>
                <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Title on your store
                  <input
                    style={inputStyle}
                    value={setting.title}
                    maxLength={MAX_TITLE}
                    onChange={(e) => setSection(section.key, { title: e.target.value })}
                    aria-label={`Title of ${section.default_title}`}
                  />
                </label>

                {section.key === 'featured' && (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {over > 0 && (
                      <p role="alert" style={{ ...errorText, margin: 0 }}>
                        You chose {draft.featured_ids.length} products but your storefront has room for {featuredRoom}. Only the
                        first {featuredRoom} are shown. Remove {over} to be able to save.
                      </p>
                    )}
                    {draft.featured_ids.length === 0 ? (
                      <p style={{ ...muted, margin: 0 }}>No featured products yet. This section is not shown until you choose some.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                        {draft.featured_ids.map((id, index) => {
                          const product = byId.get(id);
                          return (
                            <li
                              key={id}
                              style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #E6E8EC', borderRadius: '14px', padding: '8px 10px' }}
                            >
                              {product?.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.thumbnail} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: '8px' }} />
                              ) : (
                                <span style={{ width: 40, height: 40, borderRadius: '8px', background: '#F3F4F6', flex: '0 0 auto' }} />
                              )}
                              <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: '14px', overflowWrap: 'anywhere' }}>
                                {product ? product.title : 'A product that is not in your list'}
                              </span>
                              <button
                                type="button"
                                style={iconButton}
                                aria-label="Move up"
                                disabled={index === 0}
                                onClick={() => change({ ...draft, featured_ids: moveItem(draft.featured_ids, index, -1) })}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                style={iconButton}
                                aria-label="Move down"
                                disabled={index === draft.featured_ids.length - 1}
                                onClick={() => change({ ...draft, featured_ids: moveItem(draft.featured_ids, index, 1) })}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                style={smallButton}
                                onClick={() => change({ ...draft, featured_ids: draft.featured_ids.filter((x) => x !== id) })}
                              >
                                Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {draft.featured_ids.length >= featuredRoom ? (
                      <p style={{ ...muted, margin: 0 }}>Maximum of {featuredRoom} reached.</p>
                    ) : (
                      <select
                        style={inputStyle}
                        value=""
                        aria-label="Add a featured product"
                        onChange={(e) => {
                          if (e.target.value) change({ ...draft, featured_ids: [...draft.featured_ids, e.target.value] });
                        }}
                      >
                        <option value="">{choices.length === 0 ? 'No more published products' : 'Add a featured product...'}</option>
                        {choices.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {info.declared.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving || over > 0}
            style={{
              ...pillButton,
              border: 0,
              background: 'var(--accent)',
              color: '#FFFFFF',
              opacity: !dirty || saving || over > 0 ? 0.6 : 1,
              cursor: !dirty || saving || over > 0 ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save sections'}
          </button>
          <span style={{ fontSize: '14px', fontWeight: 500, color: dirty ? '#B54708' : '#6B7280' }}>
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </span>
          {message && (
            <span role={message.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: '14px', color: message.kind === 'ok' ? '#17803F' : '#B42318' }}>
              {message.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
