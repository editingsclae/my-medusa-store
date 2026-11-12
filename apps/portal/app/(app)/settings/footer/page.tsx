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
  findFooterProblem,
  moveShopCategory,
  removeShopCategory,
  visibleNetworks,
  visiblePages,
} from '@/lib/footer';
import type { FooterTab } from '@/lib/footer';
import { CollapsibleRow, RowBadge } from '@/components/settings/CollapsibleRow';
import { SaveBar } from '@/components/settings/SaveBar';
import { SettingsTabs, panelProps } from '@/components/settings/SettingsTabs';
import { Skeleton, LoadingRegion } from '@/components/ui/Skeleton';
import {
  cardStyle,
  counterStyle,
  iconButton,
  inputStyle,
  labelStyle,
  sectionHintStyle,
  sectionTitleStyle,
  smallButton,
} from '@/components/settings/styles';

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
      <div style={box} data-testid="page-preview">
        <LoadingRegion label="Loading the preview" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Skeleton width="45%" height={24} />
          <Skeleton width="100%" height={16} />
          <Skeleton width="90%" height={16} />
          <Skeleton width="75%" height={16} />
        </LoadingRegion>
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
  // One section is shown at a time, and one support page is open
  const [tab, setTab] = useState<FooterTab>('about');
  const [openPage, setOpenPage] = useState<FooterPageKey | null>(null);

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
    const problem = findFooterProblem(footer, limits, categories);
    if (problem) {
      // Take the merchant to the part that needs attention
      setTab(problem.tab);
      if (problem.pageKey) setOpenPage(problem.pageKey);
      return setMessage({ kind: 'error', text: problem.message });
    }

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

  if (checking || loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid #E6E8EC' }}>
            <Skeleton width={110} height={40} radius={20} />
            <Skeleton width={100} height={40} radius={20} />
            <Skeleton width={80} height={40} radius={20} />
            <Skeleton width={130} height={40} radius={20} />
          </div>
          <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton width={180} height={24} />
            <Skeleton width={320} height={14} />
            <div style={{ display: 'grid', gap: '16px', marginTop: '8px', maxWidth: '640px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton width={100} height={14} />
                <Skeleton width="100%" height={44} radius={22} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton width={100} height={14} />
                <Skeleton width="100%" height={88} radius={16} />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
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


  const pageBadges = (key: FooterPageKey): RowBadge[] =>
    footer.pages[key].trim() === ''
      ? [{ text: 'Hidden', tone: 'muted' }]
      : [{ text: 'Shown', tone: 'ok' }];

  const pad: React.CSSProperties = { padding: '20px 24px 24px' };

  const aboutPanel = (
    <div {...panelProps('footer', 'about')} style={pad}>
      <h2 id="footer-about-heading" style={sectionTitleStyle}>
        About your store
      </h2>
      <p style={sectionHintStyle}>The name and the short text shown at the bottom of every page of your store.</p>
      <div style={{ display: 'grid', gap: '16px', marginTop: '16px', maxWidth: '640px' }}>
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
    </div>
  );

  const socialPanel = (
    <div {...panelProps('footer', 'social')} style={pad}>
      <h2 id="footer-social-heading" style={sectionTitleStyle}>
        Social media
      </h2>
      <p style={sectionHintStyle}>
        Paste the link of your page, or just your @name. Switch a network off to hide it from your footer without losing
        the link.
      </p>
      <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '10px' }}>
        {NETWORKS.map((network) => {
          const link = footer.social[network];
          const empty = link.url.trim() === '';
          return (
            <li
              key={network}
              style={{
                border: '1px solid #E6E8EC',
                borderRadius: '18px',
                padding: '10px 14px',
                background: link.enabled ? '#FFFFFF' : '#F7F8FA',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px 14px',
              }}
            >
              <strong style={{ fontSize: '15px', flex: '0 0 96px' }}>{NETWORK_NAMES[network]}</strong>
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={link.url}
                onChange={(e) => setLink(network, { url: e.target.value })}
                placeholder={NETWORK_PLACEHOLDERS[network]}
                aria-label={`${NETWORK_NAMES[network]} link`}
                style={{ ...inputStyle, flex: '1 1 260px', width: 'auto' }}
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: empty ? 0.55 : 1,
                  flex: '0 0 auto',
                }}
              >
                <input
                  type="checkbox"
                  checked={link.enabled}
                  disabled={empty}
                  onChange={(e) => setLink(network, { enabled: e.target.checked })}
                  aria-label={`Show ${NETWORK_NAMES[network]} in my footer`}
                />
                Show
              </label>
              {empty && (
                <span style={{ flex: '1 1 100%', fontSize: '12px', color: '#6B7280' }}>
                  Add the link to be able to switch it on.
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const shopPanel = (
    <div {...panelProps('footer', 'shop')} style={pad}>
      <h2 id="footer-shop-heading" style={sectionTitleStyle}>
        Shop column
      </h2>
      <p style={sectionHintStyle}>
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
          {shopColumn.map(({ id, category }, index) => {
            const name = category ? category.name : 'category';
            const off = category && category.is_active === false;
            return (
              <CollapsibleRow
                key={id}
                id={`shop-${id}`}
                open={false}
                onToggle={() => undefined}
                title={category ? category.name : categories ? 'This category no longer exists' : 'Category'}
                subtitle={off ? 'Switched off, not shown to shoppers' : undefined}
                tone={category && !off ? 'normal' : 'muted'}
                actions={
                  <>
                    <button
                      type="button"
                      style={{ ...iconButton, opacity: index === 0 ? 0.4 : 1 }}
                      disabled={index === 0}
                      onClick={() => setShopCategories(moveShopCategory(footer.shop_category_ids, id, -1))}
                      aria-label={`Move ${name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      style={{ ...iconButton, opacity: index === shopColumn.length - 1 ? 0.4 : 1 }}
                      disabled={index === shopColumn.length - 1}
                      onClick={() => setShopCategories(moveShopCategory(footer.shop_category_ids, id, 1))}
                      aria-label={`Move ${name} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      style={{ ...smallButton, color: '#B42318', borderColor: '#F5B5B5' }}
                      onClick={() => setShopCategories(removeShopCategory(footer.shop_category_ids, id))}
                      aria-label={`Remove ${name}`}
                    >
                      Remove
                    </button>
                  </>
                }
              />
            );
          })}
        </ol>
      )}

      <label style={{ ...labelStyle, marginTop: '16px', maxWidth: '420px' }}>
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
    </div>
  );

  const pagesPanel = (
    <div {...panelProps('footer', 'pages')} style={pad}>
      <h2 id="footer-pages-heading" style={sectionTitleStyle}>
        Support pages
      </h2>
      <p style={sectionHintStyle}>
        Write the text of each page. A page with no text is left out of your footer.
      </p>
      <details
        data-testid="formatting-tip"
        style={{
          margin: '12px 0 0',
          padding: '10px 16px',
          borderRadius: '14px',
          background: '#F7F8FA',
          border: '1px solid #E6E8EC',
          fontSize: '13px',
          lineHeight: '20px',
          color: '#4B5263',
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#1F2937' }}>
          Tip: you can paste text written by an AI assistant
        </summary>
        <p style={{ margin: '8px 0 0' }}>
          Titles, bold text, lists and links keep their look. You can also type them yourself: <code># Title</code>,{' '}
          <code>## Section</code>, <code>**bold**</code>, <code>- item</code> (indent a line for a sub-item),{' '}
          <code>1. item</code>, <code>[text](https://...)</code>. A blank line starts a new paragraph. Use{' '}
          <em>Preview</em> to see the result.
        </p>
      </details>
      <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '10px' }}>
        {PAGE_KEYS.map((key) => (
          <CollapsibleRow
            key={key}
            id={`page-${key}`}
            open={openPage === key}
            onToggle={() => setOpenPage((prev) => (prev === key ? null : key))}
            title={PAGE_TITLES[key]}
            subtitle={
              footer.pages[key].trim() === ''
                ? 'Empty: left out of your footer'
                : `${footer.pages[key].length.toLocaleString('en-US')} characters`
            }
            badges={pageBadges(key)}
          >
            <div style={labelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 auto', fontSize: '12px', fontWeight: 400, color: '#6B7280' }}>
                  {PAGE_HINTS[key]}
                </span>
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
          </CollapsibleRow>
        ))}
      </ul>
    </div>
  );

  const previewPanel = (
    <div {...panelProps('footer', 'preview')} style={pad}>
      <h2 id="footer-preview-heading" style={sectionTitleStyle}>
        Preview
      </h2>
      <p style={{ ...sectionHintStyle, margin: '4px 0 16px' }}>
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
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <section style={{ ...cardStyle, margin: '0 16px 0 24px', overflow: 'hidden' }} aria-label="Store footer">
        <SettingsTabs<FooterTab>
          idPrefix="footer"
          label="Parts of your footer"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'about', label: 'About' },
            { id: 'social', label: 'Social media', badge: `${shown.length} / ${NETWORKS.length}` },
            { id: 'shop', label: 'Shop column', badge: `${shopColumn.length} / ${limits.shop_categories}` },
            { id: 'pages', label: 'Support pages', badge: `${shownPages.length} / ${PAGE_KEYS.length}` },
            { id: 'preview', label: 'Preview' },
          ]}
        />
        {tab === 'about' && aboutPanel}
        {tab === 'social' && socialPanel}
        {tab === 'shop' && shopPanel}
        {tab === 'pages' && pagesPanel}
        {tab === 'preview' && previewPanel}
      </section>

      <SaveBar dirty={dirty} saving={saving} message={message} onSave={handleSave} />
    </div>
  );
}
