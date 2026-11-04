'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getFooterSettings,
  getMerchantCategories,
  getMerchantMe,
  previewFooterPage,
  saveFooterSettings,
  FooterContent,
  FooterLimits,
  FooterNetwork,
  FooterPageKey,
  MerchantCategory,
  RichBlock,
} from '@/lib/medusa';
import { htmlToMarkdown, replaceRange } from '@/lib/rich-text';
import { RichBlocks } from '@/components/settings/RichBlocks';
import {
  DEFAULT_LIMITS,
  NETWORKS,
  NETWORK_NAMES,
  NETWORK_PLACEHOLDERS,
  PAGE_HINTS,
  PAGE_KEYS,
  PAGE_TITLES,
  addShopCategory,
  emptyFooter,
  moveShopCategory,
  removeShopCategory,
  validateFooter,
  visibleNetworks,
  visiblePages,
} from '@/lib/footer';

// What the server sends, with every part present even if the server is older
// than this page.
function completeFooter(footer: Partial<FooterContent> | undefined): FooterContent {
  const base = emptyFooter();
  return {
    ...base,
    ...footer,
    social: { ...base.social, ...(footer?.social ?? {}) },
    shop_category_ids: Array.isArray(footer?.shop_category_ids) ? footer.shop_category_ids : [],
    pages: { ...base.pages, ...(footer?.pages ?? {}) },
  };
}

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

// How a page will look to shoppers. The server draws it from the same text, so
// this is exactly what the storefront will show.
function PagePreview({ text }: { text: string }) {
  // The answer is kept with the text it was made for. While the text that is
  // shown has no answer yet, the preview is loading; nothing is set in the effect
  // itself, only when the server answers.
  const [answer, setAnswer] = useState<
    { text: string; blocks: RichBlock[]; message?: undefined } | { text: string; message: string; blocks?: undefined } | null
  >(null);

  useEffect(() => {
    if (text.trim() === '') return;
    let cancelled = false;
    previewFooterPage(text)
      .then((res) => {
        if (!cancelled) setAnswer({ text, blocks: res.blocks });
      })
      .catch((err) => {
        if (!cancelled) {
          setAnswer({ text, message: err instanceof Error ? err.message : 'Could not load the preview.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  const current = answer && answer.text === text ? answer : null;

  const box: React.CSSProperties = {
    border: '1px solid #E6E8EC',
    borderRadius: '18px',
    background: '#FFFFFF',
    padding: '18px 20px',
    minHeight: '132px',
    maxHeight: '480px',
    overflow: 'auto',
  };

  if (text.trim() === '') {
    return (
      <div style={{ ...box, color: '#6B7280', fontSize: '14px' }} data-testid="page-preview">
        Nothing to preview. A page with no text is left out of your footer.
      </div>
    );
  }
  if (!current) {
    return (
      <div style={{ ...box, color: '#6B7280', fontSize: '14px' }} data-testid="page-preview">
        Loading the preview...
      </div>
    );
  }
  if (current.blocks === undefined) {
    return (
      <div role="alert" style={{ ...box, color: '#B42318', fontSize: '14px' }} data-testid="page-preview">
        {current.message}
      </div>
    );
  }
  return (
    <div style={box} data-testid="page-preview">
      <RichBlocks blocks={current.blocks} />
    </div>
  );
}

export default function FooterSettingsPage() {
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [footer, setFooter] = useState<FooterContent>(emptyFooter());
  const [savedJson, setSavedJson] = useState('');
  const [limits, setLimits] = useState<FooterLimits>(DEFAULT_LIMITS);
  // null while not loaded, or when it could not be loaded
  const [categories, setCategories] = useState<MerchantCategory[] | null>(null);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  // Which pages show their preview instead of the text box, and which one just
  // got pasted text with formatting
  const [previewing, setPreviewing] = useState<Partial<Record<FooterPageKey, boolean>>>({});
  const [pasted, setPasted] = useState<Partial<Record<FooterPageKey, boolean>>>({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await getFooterSettings();
      const loaded = completeFooter(res.footer);
      setFooter(loaded);
      setSavedJson(JSON.stringify(loaded));
      setLimits({ ...DEFAULT_LIMITS, ...res.limits });
      // The footer page works without the list; only the Shop column needs it
      getMerchantCategories()
        .then((list) => {
          setCategories(list.categories);
          setCategoriesFailed(false);
        })
        .catch(() => {
          setCategories(null);
          setCategoriesFailed(true);
        });
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

  const setShopCategories = (ids: string[]) => {
    setMessage(null);
    setFooter((prev) => ({ ...prev, shop_category_ids: ids }));
  };

  const setPage = (key: FooterPageKey, value: string) => {
    setMessage(null);
    setPasted((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
    setFooter((prev) => ({ ...prev, pages: { ...prev.pages, [key]: value } }));
  };

  // Text copied from an AI assistant arrives as HTML. Its headings, bold text,
  // lists and links are turned into the page's simple formatting, so they keep
  // their look. A paste that is only plain text is left to the browser.
  const handlePagePaste = (key: FooterPageKey, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return;
    const markdown = htmlToMarkdown(html);
    if (markdown === null) return;

    e.preventDefault();
    const box = e.currentTarget;
    const next = replaceRange(footer.pages[key], box.selectionStart, box.selectionEnd, markdown);
    setMessage(null);
    setFooter((prev) => ({ ...prev, pages: { ...prev.pages, [key]: next.value } }));
    setPasted((prev) => ({ ...prev, [key]: true }));
    requestAnimationFrame(() => box.setSelectionRange(next.caret, next.caret));
  };

  const handleSave = async () => {
    const problem = validateFooter(footer, limits, categories);
    if (problem) return setMessage({ kind: 'error', text: problem });

    setSaving(true);
    setMessage(null);
    try {
      const res = await saveFooterSettings(footer);
      // The server cleans the links (an @name becomes the full address) and the text
      const saved = completeFooter(res.footer);
      setFooter(saved);
      setSavedJson(JSON.stringify(saved));
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
  const shownPages = visiblePages(footer);
  const categoryOf = (id: string): MerchantCategory | undefined => categories?.find((c) => c.id === id);
  const shopColumn: Array<{ id: string; category: MerchantCategory | undefined }> =
    footer.shop_category_ids.map((id: string) => ({ id, category: categoryOf(id) }));
  const addable = (categories ?? []).filter(
    (c) => c.is_active !== false && !footer.shop_category_ids.includes(c.id)
  );
  const columnFull = footer.shop_category_ids.length >= limits.shop_categories;

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

      <section style={{ ...cardStyle, padding: '24px' }} aria-labelledby="footer-shop-heading">
        <h2 id="footer-shop-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Shop column
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4B5263' }}>
          Up to {limits.shop_categories} of your categories, listed under &quot;Shop&quot; in your footer, in this order.
        </p>

        {categoriesFailed && (
          <p role="alert" style={{ margin: '12px 0 0', fontSize: '14px', color: '#B42318' }}>
            Your categories could not be loaded, so you cannot change this list now. Reload the page to try again.
          </p>
        )}

        {shopColumn.length === 0 ? (
          <p style={{ margin: '16px 0 0', fontSize: '14px', color: '#6B7280' }}>
            No category chosen. The Shop column is not shown.
          </p>
        ) : (
          <ol data-testid="shop-column" style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '10px' }}>
            {shopColumn.map(({ id, category }, index) => (
              <li
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  border: '1px solid #E6E8EC',
                  borderRadius: '18px',
                  padding: '10px 14px',
                  background: category && category.is_active !== false ? '#FFFFFF' : '#F7F8FA',
                }}
              >
                <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: '15px', fontWeight: 500 }}>
                  {category ? category.name : categories ? 'This category no longer exists' : 'Category'}
                  {category && category.is_active === false && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#B54708' }}>
                      switched off, not shown to shoppers
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  style={smallButton}
                  disabled={index === 0}
                  onClick={() => setShopCategories(moveShopCategory(footer.shop_category_ids, id, -1))}
                  aria-label={`Move ${category ? category.name : 'category'} up`}
                >
                  Up
                </button>
                <button
                  type="button"
                  style={smallButton}
                  disabled={index === shopColumn.length - 1}
                  onClick={() => setShopCategories(moveShopCategory(footer.shop_category_ids, id, 1))}
                  aria-label={`Move ${category ? category.name : 'category'} down`}
                >
                  Down
                </button>
                <button
                  type="button"
                  style={smallButton}
                  onClick={() => setShopCategories(removeShopCategory(footer.shop_category_ids, id))}
                  aria-label={`Remove ${category ? category.name : 'category'}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}

        <label style={{ ...labelStyle, marginTop: '16px' }}>
          Add a category
          <select
            value=""
            disabled={columnFull || addable.length === 0 || categories === null}
            onChange={(e) =>
              setShopCategories(addShopCategory(footer.shop_category_ids, e.target.value, limits.shop_categories))
            }
            style={inputStyle}
          >
            <option value="">
              {columnFull
                ? `The column is full (${limits.shop_categories} categories)`
                : addable.length === 0
                  ? 'No other category to add'
                  : 'Choose a category'}
            </option>
            {addable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section style={{ ...cardStyle, padding: '24px' }} aria-labelledby="footer-pages-heading">
        <h2 id="footer-pages-heading" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          Support pages
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4B5263' }}>
          Write the text of each page. A page with no text is left out of your footer.
        </p>
        <div
          data-testid="formatting-tip"
          style={{
            margin: '12px 0 0',
            padding: '12px 16px',
            borderRadius: '14px',
            background: '#F7F8FA',
            border: '1px solid #E6E8EC',
            fontSize: '13px',
            lineHeight: '20px',
            color: '#4B5263',
          }}
        >
          <strong style={{ color: '#1F2937' }}>Tip:</strong> you can paste text written by an AI assistant. Titles, bold
          text, lists and links keep their look. You can also type them yourself: <code># Title</code>,{' '}
          <code>## Section</code>, <code>**bold**</code>, <code>- item</code> (indent a line for a sub-item),{' '}
          <code>1. item</code>, <code>[text](https://...)</code>. A blank line starts a new paragraph. Use{' '}
          <em>Preview</em> to see the result.
        </div>
        <div style={{ display: 'grid', gap: '22px', marginTop: '16px' }}>
          {PAGE_KEYS.map((key) => (
            <div key={key} style={labelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 auto' }}>{PAGE_TITLES[key]}</span>
                <span role="group" aria-label={`${PAGE_TITLES[key]} view`} style={{ display: 'flex', gap: '6px' }}>
                  {(['Edit', 'Preview'] as const).map((mode) => {
                    const active = (mode === 'Preview') === Boolean(previewing[key]);
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${mode} ${PAGE_TITLES[key]}`}
                        onClick={() => setPreviewing((prev) => ({ ...prev, [key]: mode === 'Preview' }))}
                        style={{
                          ...smallButton,
                          background: active ? 'var(--accent)' : '#FFFFFF',
                          color: active ? '#FFFFFF' : '#374151',
                          borderColor: active ? 'var(--accent)' : '#D1D5DB',
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B7280' }}>{PAGE_HINTS[key]}</span>
              {previewing[key] ? (
                <PagePreview text={footer.pages[key]} />
              ) : (
                <textarea
                  value={footer.pages[key]}
                  onChange={(e) => setPage(key, e.target.value)}
                  onPaste={(e) => handlePagePaste(key, e)}
                  rows={8}
                  aria-label={`${PAGE_TITLES[key]} text`}
                  placeholder="Leave empty to hide this page"
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    minHeight: '160px',
                    padding: '12px 17px',
                    borderRadius: '18px',
                    resize: 'vertical',
                    lineHeight: '24px',
                    fontFamily: 'inherit',
                  }}
                />
              )}
              {pasted[key] && !previewing[key] && (
                <span data-testid={`pasted-${key}`} role="status" style={{ fontSize: '12px', color: '#17803F' }}>
                  Your formatting was kept: titles, bold text, lists and links.
                </span>
              )}
              <span style={counterStyle}>
                {footer.pages[key].length} / {limits.page}
              </span>
            </div>
          ))}
        </div>
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
          {(shopColumn.length > 0 || shownPages.length > 0) && (
            <div style={{ margin: '16px 0 0', display: 'flex', gap: '40px', flexWrap: 'wrap', fontSize: '13px' }}>
              {shopColumn.length > 0 && (
                <div data-testid="preview-shop">
                  <p style={{ margin: 0, fontWeight: 700 }}>Shop</p>
                  <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: '4px', color: '#4B5263' }}>
                    {shopColumn.map(({ id, category }) => (
                      <li key={id}>{category ? category.name : '…'}</li>
                    ))}
                  </ul>
                </div>
              )}
              {shownPages.length > 0 && (
                <div data-testid="preview-support">
                  <p style={{ margin: 0, fontWeight: 700 }}>Support</p>
                  <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: '4px', color: '#4B5263' }}>
                    {shownPages.map((key) => (
                      <li key={key} data-page={key}>
                        {PAGE_TITLES[key]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
