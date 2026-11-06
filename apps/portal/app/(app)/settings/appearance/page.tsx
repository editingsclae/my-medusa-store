'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMerchantCategories,
  getMerchantMe,
  getMerchantProducts,
  getStorefrontContent,
  saveStorefrontContent,
  uploadMerchantMedia,
  BannerLinkType,
  MerchantCategory,
  MerchantProduct,
  StorefrontBanner,
  StorefrontCategoryTile,
  StorefrontContent,
  StorefrontLayoutInfo,
  StorefrontLimits,
} from '@/lib/medusa';
import { CollapsibleRow, RowBadge } from '@/components/settings/CollapsibleRow';
import { SaveBar } from '@/components/settings/SaveBar';
import LayoutKeyCard from '@/components/settings/LayoutKeyCard';
import { SettingsTabs, panelProps } from '@/components/settings/SettingsTabs';
import {
  cardStyle,
  dangerSmallButton,
  iconButton,
  inputStyle,
  labelStyle,
  pillButton,
  sectionHintStyle,
  sectionTitleStyle,
  smallButton,
} from '@/components/settings/styles';

type Section = 'hero_slides' | 'promo_banners';
type Tab = Section | 'category_tiles';

// Where a problem is, so the page can open it for the merchant
type Problem = { message: string; tab: Tab; id: string };

const DEFAULT_LIMITS: StorefrontLimits = {
  hero_slides: 3,
  promo_banners: 2,
  category_tiles: 8,
  label: 40,
  title: 60,
  text: 140,
  button_label: 24,
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SECTION_INFO: Record<
  Section,
  { heading: string; description: string; itemName: string; labelName: string; imageTip: string; ratio: string }
> = {
  hero_slides: {
    heading: 'Hero slider',
    description:
      'The large banner at the top of your home page. Add up to 3 slides; shoppers see them one after the other.',
    itemName: 'Slide',
    labelName: 'Small text above the title (for example "New season")',
    imageTip: 'Best size 1600 × 500 px. Keep the main subject on the right side: the text appears on the left.',
    ratio: '16 / 5',
  },
  promo_banners: {
    heading: 'Promo banners',
    description: 'Banners shown on your home page, usually near the bottom.',
    itemName: 'Promo banner',
    labelName: 'Collection name (for example "Electronics")',
    imageTip: 'Best size 800 × 300 px. Keep the main subject on the right side: the text appears on the left.',
    ratio: '8 / 3',
  },
};


function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyBanner(): StorefrontBanner {
  return {
    id: newId(),
    enabled: true,
    image_url: '',
    label: '',
    title: '',
    text: '',
    button_label: '',
    link: { type: 'none' },
  };
}

function emptyTile(): StorefrontCategoryTile {
  return { id: newId(), category_id: '', image_url: '' };
}

// The same checks as the backend, so a problem is shown before saving.
// `categories` is null while the list is not loaded: the server then checks them.
// The first problem found, with where it is, or null when the page can be saved.
function findProblem(
  content: StorefrontContent,
  limits: StorefrontLimits,
  categories: MerchantCategory[] | null
): Problem | null {
  for (const section of ['hero_slides', 'promo_banners'] as Section[]) {
    const info = SECTION_INFO[section];
    const list = content[section];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const where = `${info.itemName} ${i + 1}`;
      const problem = (message: string): Problem => ({ message, tab: section, id: b.id });
      if (!b.image_url) return problem(`${where} needs an image.`);
      if (b.label.trim().length > limits.label) {
        return problem(`${where}: the small text is too long (at most ${limits.label} characters).`);
      }
      if (b.title.trim().length > limits.title) {
        return problem(`${where}: the title is too long (at most ${limits.title} characters).`);
      }
      if (b.text.trim().length > limits.text) {
        return problem(`${where}: the text is too long (at most ${limits.text} characters).`);
      }
      if (b.button_label.trim().length > limits.button_label) {
        return problem(`${where}: the button text is too long (at most ${limits.button_label} characters).`);
      }
      if ((b.link.type === 'category' || b.link.type === 'product') && !b.link.handle) {
        return problem(`${where}: choose the ${b.link.type} to link to.`);
      }
      if (b.button_label.trim() && b.link.type === 'none') {
        return problem(`${where}: choose where the button goes, or remove the button text.`);
      }
    }
  }

  const used = new Set<string>();
  for (let i = 0; i < content.category_tiles.length; i++) {
    const tile = content.category_tiles[i];
    const where = `Category ${i + 1}`;
    const problem = (message: string): Problem => ({ message, tab: 'category_tiles', id: tile.id });
    if (!tile.category_id) return problem(`${where}: choose a category.`);
    if (categories && !categories.some((c) => c.id === tile.category_id)) {
      return problem(`${where}: the category no longer exists. Choose another one or remove it.`);
    }
    if (used.has(tile.category_id)) {
      return problem(`${where}: this category is already shown. Each category can appear once.`);
    }
    used.add(tile.category_id);
    if (!tile.image_url) return problem(`${where} needs an image.`);
  }
  return null;
}

// The picture of an item, small enough to sit in a row. `round` is for category tiles.
function Thumb({ url, alt, ratio, width, round }: { url: string; alt: string; ratio?: string; width: number; round?: boolean }) {
  return (
    <span
      style={{
        flex: '0 0 auto',
        width: `${width}px`,
        aspectRatio: round ? '1 / 1' : ratio,
        borderRadius: round ? '50%' : '8px',
        overflow: 'hidden',
        border: url ? '1px solid #E5E7EB' : '2px dashed #D1D5DB',
        boxSizing: 'border-box',
        background: '#F9FAFB',
        display: 'inline-block',
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
    </span>
  );
}

// Moving an item up or down, kept in the row so it works without opening it
function MoveButtons({ name, index, count, onMove }: { name: string; index: number; count: number; onMove: (d: -1 | 1) => void }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label={`Move ${name} up`}
        style={{ ...iconButton, opacity: index === 0 ? 0.4 : 1 }}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        aria-label={`Move ${name} down`}
        style={{ ...iconButton, opacity: index === count - 1 ? 0.4 : 1 }}
      >
        ↓
      </button>
    </>
  );
}

// The picture field: a preview with the button to choose a new one
function ImagePicker({
  url,
  alt,
  ratio,
  round,
  tip,
  uploading,
  onUpload,
}: {
  url: string;
  alt: string;
  ratio: string;
  round?: boolean;
  tip?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'grid', gap: '10px', alignContent: 'start', justifyItems: round ? 'center' : 'stretch' }}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
      <div
        style={{
          position: 'relative',
          width: round ? '96px' : '100%',
          aspectRatio: round ? '1 / 1' : ratio,
          borderRadius: round ? '50%' : '14px',
          overflow: 'hidden',
          border: url ? '1px solid #E5E7EB' : '2px dashed #D1D5DB',
          boxSizing: 'border-box',
          background: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '0 8px' }}>No image yet</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          style={{ ...smallButton, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? 'Uploading...' : url ? 'Replace image' : 'Upload image'}
        </button>
        {tip && <span style={{ fontSize: '12px', color: '#6B7280', flex: '1 1 160px' }}>{tip}</span>}
      </div>
    </div>
  );
}

type BannerRowProps = {
  section: Section;
  banner: StorefrontBanner;
  index: number;
  count: number;
  open: boolean;
  limits: StorefrontLimits;
  categories: MerchantCategory[];
  products: MerchantProduct[];
  uploading: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<StorefrontBanner>) => void;
  onUpload: (file: File) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

function BannerRow({
  section,
  banner,
  index,
  count,
  open,
  limits,
  categories,
  products,
  uploading,
  onToggle,
  onChange,
  onUpload,
  onMove,
  onRemove,
}: BannerRowProps) {
  const info = SECTION_INFO[section];
  const name = `${info.itemName} ${index + 1}`;
  const linkable = products.filter((p) => p.handle);

  const setLinkType = (type: BannerLinkType) => {
    onChange({ link: type === 'category' || type === 'product' ? { type, handle: '' } : { type } });
  };

  const badges: RowBadge[] = [];
  if (!banner.image_url) badges.push({ text: 'Needs an image', tone: 'warn' });
  if (!banner.enabled) badges.push({ text: 'Hidden', tone: 'muted' });

  return (
    <CollapsibleRow
      id={`${section}-${banner.id}`}
      open={open}
      onToggle={onToggle}
      title={banner.title.trim() || name}
      subtitle={banner.title.trim() ? name : 'No title yet'}
      thumb={<Thumb url={banner.image_url} alt="" ratio={info.ratio} width={section === 'hero_slides' ? 96 : 80} />}
      badges={badges}
      tone={banner.enabled ? 'normal' : 'muted'}
      actions={
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={banner.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              aria-label={`Show ${name} on my store`}
            />
            Show
          </label>
          <MoveButtons name={name} index={index} count={count} onMove={onMove} />
        </>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ flex: '1 1 280px', maxWidth: '440px', minWidth: 0 }}>
          <ImagePicker
            url={banner.image_url}
            alt={`${name} preview`}
            ratio={info.ratio}
            tip={info.imageTip}
            uploading={uploading}
            onUpload={onUpload}
          />
        </div>

        <div style={{ flex: '2 1 320px', display: 'grid', gap: '12px', alignContent: 'start', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <label style={{ ...labelStyle, flex: '1 1 200px' }}>
              {info.labelName}
              <input
                value={banner.label}
                maxLength={limits.label}
                onChange={(e) => onChange({ label: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flex: '1 1 200px' }}>
              Title
              <input
                value={banner.title}
                maxLength={limits.title}
                onChange={(e) => onChange({ title: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Text under the title
            <input
              value={banner.text}
              maxLength={limits.text}
              onChange={(e) => onChange({ text: e.target.value })}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <label style={{ ...labelStyle, flex: '1 1 160px' }}>
              Button text
              <input
                value={banner.button_label}
                maxLength={limits.button_label}
                placeholder="Shop now"
                onChange={(e) => onChange({ button_label: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flex: '1 1 160px' }}>
              Link goes to
              <select
                value={banner.link.type}
                onChange={(e) => setLinkType(e.target.value as BannerLinkType)}
                style={inputStyle}
              >
                <option value="none">No link</option>
                <option value="shop">All products (Shop)</option>
                <option value="category">A category</option>
                <option value="product">A product</option>
              </select>
            </label>
            {banner.link.type === 'category' && (
              <label style={{ ...labelStyle, flex: '1 1 200px' }}>
                Category
                <select
                  value={banner.link.handle || ''}
                  onChange={(e) => onChange({ link: { type: 'category', handle: e.target.value } })}
                  style={inputStyle}
                >
                  <option value="">Choose a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.handle}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {banner.link.type === 'product' && (
              <label style={{ ...labelStyle, flex: '1 1 200px' }}>
                Product
                <select
                  value={banner.link.handle || ''}
                  onChange={(e) => onChange({ link: { type: 'product', handle: e.target.value } })}
                  style={inputStyle}
                >
                  <option value="">Choose a product</option>
                  {linkable.map((p) => (
                    <option key={p.id} value={p.handle}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} style={dangerSmallButton}>
          Remove {info.itemName.toLowerCase()}
        </button>
      </div>
    </CollapsibleRow>
  );
}

type TileRowProps = {
  tile: StorefrontCategoryTile;
  index: number;
  count: number;
  open: boolean;
  options: MerchantCategory[];
  categories: MerchantCategory[];
  categoryMissing: boolean;
  uploading: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<StorefrontCategoryTile>) => void;
  onUpload: (file: File) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

function TileRow({
  tile,
  index,
  count,
  open,
  options,
  categories,
  categoryMissing,
  uploading,
  onToggle,
  onChange,
  onUpload,
  onMove,
  onRemove,
}: TileRowProps) {
  const name = `Category ${index + 1}`;
  const chosen = categories.find((c) => c.id === tile.category_id);

  const badges: RowBadge[] = [];
  if (categoryMissing) badges.push({ text: 'Category deleted', tone: 'error' });
  if (!tile.image_url) badges.push({ text: 'Needs an image', tone: 'warn' });

  return (
    <CollapsibleRow
      id={`tile-${tile.id}`}
      open={open}
      onToggle={onToggle}
      title={chosen ? chosen.name : tile.category_id ? 'Deleted category' : 'Choose a category'}
      subtitle={name}
      thumb={<Thumb url={tile.image_url} alt="" width={44} round />}
      badges={badges}
      tone={categoryMissing ? 'error' : 'normal'}
      actions={<MoveButtons name={name} index={index} count={count} onMove={onMove} />}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '20px' }}>
        <div style={{ flex: '0 0 auto' }}>
          <ImagePicker
            url={tile.image_url}
            alt={`${name} preview`}
            ratio="1 / 1"
            round
            uploading={uploading}
            onUpload={onUpload}
          />
        </div>

        <div style={{ flex: '1 1 240px', display: 'grid', gap: '6px', minWidth: 0 }}>
          <label style={labelStyle}>
            {name}
            <select
              value={categoryMissing ? '' : tile.category_id}
              onChange={(e) => onChange({ category_id: e.target.value })}
              style={inputStyle}
            >
              <option value="">Choose a category</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active === false ? ' (switched off)' : ''}
                </option>
              ))}
            </select>
          </label>
          {categoryMissing && (
            <span role="alert" style={{ fontSize: '12px', color: '#B42318' }}>
              The category you chose before was deleted. Choose another one or remove this tile.
            </span>
          )}
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Best image size 400 × 400 px, square: it is shown as a circle.
          </span>
        </div>
      </div>

      <div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} style={dangerSmallButton}>
          Remove
        </button>
      </div>
    </CollapsibleRow>
  );
}

const messageBox = (kind: 'error' | 'muted'): React.CSSProperties => ({
  margin: '16px 0 0',
  fontSize: '14px',
  color: kind === 'error' ? '#B42318' : '#4B5263',
});

export default function AppearanceSettingsPage() {
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [content, setContent] = useState<StorefrontContent>({
    hero_slides: [],
    promo_banners: [],
    category_tiles: [],
  });
  const [savedJson, setSavedJson] = useState('');
  const [limits, setLimits] = useState<StorefrontLimits>(DEFAULT_LIMITS);
  // What the storefront declared about its layout (null until loaded)
  const [layout, setLayout] = useState<StorefrontLayoutInfo | null>(null);
  // null until the list is loaded
  const [categories, setCategories] = useState<MerchantCategory[] | null>(null);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [products, setProducts] = useState<MerchantProduct[]>([]);

  // One section is shown at a time, and one item of it is open
  const [tab, setTab] = useState<Tab>('hero_slides');
  const [openId, setOpenId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await getStorefrontContent();
      setContent(res.storefront);
      setSavedJson(JSON.stringify(res.storefront));
      setLimits({ ...DEFAULT_LIMITS, ...res.limits });
      setLayout(res.layout ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your store appearance.');
    } finally {
      setLoading(false);
    }
    // The link pickers are optional: without them a banner can still link to the shop
    setCategoriesFailed(false);
    getMerchantCategories()
      .then((res) => setCategories(res.categories || []))
      .catch(() => setCategoriesFailed(true));
    getMerchantProducts({ limit: 100 })
      .then((res) => setProducts(res.products || []))
      .catch(() => setProducts([]));
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

  const dirty = JSON.stringify(content) !== savedJson;

  const toggleOpen = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const changeTab = (next: Tab) => {
    setTab(next);
    setOpenId(null);
  };

  const updateBanner = (section: Section, id: string, patch: Partial<StorefrontBanner>) => {
    setMessage(null);
    setContent((prev) => ({
      ...prev,
      [section]: prev[section].map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  const addBanner = (section: Section) => {
    const banner = emptyBanner();
    setMessage(null);
    setContent((prev) => ({ ...prev, [section]: [...prev[section], banner] }));
    // The new item opens, ready to be filled
    setOpenId(banner.id);
  };

  const removeBanner = (section: Section, id: string) => {
    setMessage(null);
    setContent((prev) => ({ ...prev, [section]: prev[section].filter((b) => b.id !== id) }));
    setOpenId((prev) => (prev === id ? null : prev));
  };

  const moveBanner = (section: Section, id: string, direction: -1 | 1) => {
    setMessage(null);
    setContent((prev) => {
      const list = [...prev[section]];
      const from = list.findIndex((b) => b.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= list.length) return prev;
      [list[from], list[to]] = [list[to], list[from]];
      return { ...prev, [section]: list };
    });
  };

  const updateTile = (id: string, patch: Partial<StorefrontCategoryTile>) => {
    setMessage(null);
    setContent((prev) => ({
      ...prev,
      category_tiles: prev.category_tiles.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const addTile = () => {
    const tile = emptyTile();
    setMessage(null);
    setContent((prev) => ({ ...prev, category_tiles: [...prev.category_tiles, tile] }));
    setOpenId(tile.id);
  };

  const removeTile = (id: string) => {
    setMessage(null);
    setContent((prev) => ({ ...prev, category_tiles: prev.category_tiles.filter((t) => t.id !== id) }));
    setOpenId((prev) => (prev === id ? null : prev));
  };

  const moveTile = (id: string, direction: -1 | 1) => {
    setMessage(null);
    setContent((prev) => {
      const list = [...prev.category_tiles];
      const from = list.findIndex((t) => t.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= list.length) return prev;
      [list[from], list[to]] = [list[to], list[from]];
      return { ...prev, category_tiles: list };
    });
  };

  // Shared by banners and tiles
  const checkImage = (file: File): string | null => {
    if (!file.type.startsWith('image/')) return 'Please choose an image file (PNG, JPG, WEBP).';
    if (file.size > MAX_IMAGE_BYTES) return 'This image is too large. Please use one under 5 MB.';
    return null;
  };

  const uploadTileImage = async (id: string, file: File) => {
    const problem = checkImage(file);
    if (problem) return setMessage({ kind: 'error', text: problem });

    setUploadingId(id);
    setMessage(null);
    try {
      const { url } = await uploadMerchantMedia(file);
      updateTile(id, { image_url: url });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not upload the image.' });
    } finally {
      setUploadingId(null);
    }
  };

  const uploadImage = async (section: Section, id: string, file: File) => {
    const problem = checkImage(file);
    if (problem) return setMessage({ kind: 'error', text: problem });

    setUploadingId(id);
    setMessage(null);
    try {
      const { url } = await uploadMerchantMedia(file);
      updateBanner(section, id, { image_url: url });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not upload the image.' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async () => {
    const problem = findProblem(content, limits, categories);
    if (problem) {
      // Take the merchant to the item that needs attention
      setTab(problem.tab);
      setOpenId(problem.id);
      return setMessage({ kind: 'error', text: problem.message });
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await saveStorefrontContent(content);
      setContent(res.storefront);
      setSavedJson(JSON.stringify(res.storefront));
      setMessage({ kind: 'ok', text: 'Saved. Your store shows the changes right away.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading...</div>
    );
  }

  if (isPlatformAdmin) {
    return (
      <section style={{ ...cardStyle, padding: '32px 24px' }} role="status">
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Settings belong to each merchant</h2>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#4B5263' }}>
          The banners of a store are managed by the merchant who owns it. Sign in with a merchant account to change
          them.
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

  const addButton = (label: string, disabled: boolean, onClick: () => void) => (
    <div style={{ marginTop: '16px' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        style={{
          ...pillButton,
          border: '1px solid #D1D5DB',
          background: '#FFFFFF',
          color: '#374151',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
      </button>
    </div>
  );

  const renderBannerSection = (section: Section) => {
    const info = SECTION_INFO[section];
    const list = content[section];
    const max = limits[section];

    return (
      <div {...panelProps('appearance', section)} style={{ padding: '20px 24px 24px' }}>
        <h2 id={`${section}-heading`} style={sectionTitleStyle}>
          {info.heading}
        </h2>
        <p style={sectionHintStyle}>{info.description}</p>

        {section === 'promo_banners' && (
          <p style={messageBox('muted')} data-testid="promo-places">
            {max === 0
              ? 'Your storefront has no place for promo banners.'
              : layout?.declared === false
                ? `Your storefront has not said yet how many promo banners it has, so ${max} places are available.`
                : `Your storefront has ${max} promo banner ${max === 1 ? 'place' : 'places'}.`}
          </p>
        )}
        {section === 'promo_banners' && list.length > max && (
          <p role="alert" style={messageBox('error')}>
            You have {list.length} promo banners but your storefront has room for {max}. Only the first {max} that are
            switched on are shown. Remove {list.length - max} to be able to save.
          </p>
        )}

        {list.length === 0 ? (
          <p style={messageBox('muted')}>
            {section === 'hero_slides'
              ? 'No slides yet. Your store shows a simple welcome banner until you add one.'
              : 'No promo banners yet. Nothing is shown in this place on your store.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '10px' }}>
            {list.map((banner, index) => (
              <BannerRow
                key={banner.id}
                section={section}
                banner={banner}
                index={index}
                count={list.length}
                open={openId === banner.id}
                limits={limits}
                categories={categories || []}
                products={products}
                uploading={uploadingId === banner.id}
                onToggle={() => toggleOpen(banner.id)}
                onChange={(patch) => updateBanner(section, banner.id, patch)}
                onUpload={(file) => uploadImage(section, banner.id, file)}
                onMove={(direction) => moveBanner(section, banner.id, direction)}
                onRemove={() => removeBanner(section, banner.id)}
              />
            ))}
          </ul>
        )}

        {!(section === 'promo_banners' && max === 0) &&
          addButton(
            list.length >= max ? `Maximum of ${max} reached` : `Add ${info.itemName.toLowerCase()}`,
            list.length >= max,
            () => addBanner(section)
          )}

        {section === 'promo_banners' && <LayoutKeyCard
            layout={layout}
            onKeyCreated={() => setLayout((prev) => (prev ? { ...prev, key_set: true } : prev))}
          />}
      </div>
    );
  };

  const renderTilesSection = () => (
    <div {...panelProps('appearance', 'category_tiles')} style={{ padding: '20px 24px 24px' }}>
      <h2 id="category-tiles-heading" style={sectionTitleStyle}>
        Shop by category
      </h2>
      <p style={sectionHintStyle}>
        Round pictures of your main categories, shown right under the slider on your home page. Add up to{' '}
        {limits.category_tiles}; pick the ones you want shoppers to find first.
      </p>

      {categoriesFailed ? (
        <p role="alert" style={messageBox('error')}>
          Your categories could not be loaded, so tiles cannot be edited right now.{' '}
          <button type="button" onClick={load} style={smallButton}>
            Try again
          </button>
        </p>
      ) : categories === null ? (
        <p style={messageBox('muted')}>Loading your categories...</p>
      ) : categories.length === 0 ? (
        <p style={messageBox('muted')}>
          You have no categories yet. Create categories first (Categories in the menu), then come back to add their
          pictures.
        </p>
      ) : (
        <>
          {content.category_tiles.length === 0 ? (
            <p style={messageBox('muted')}>
              No tiles yet. Your store shows all your categories as simple text cards until you add some.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '10px' }}>
              {content.category_tiles.map((tile, index) => {
                const exists = !tile.category_id || categories.some((c) => c.id === tile.category_id);
                // A category already used by another tile is not offered again
                const options = categories.filter(
                  (c) =>
                    c.id === tile.category_id ||
                    !content.category_tiles.some((other) => other.id !== tile.id && other.category_id === c.id)
                );
                return (
                  <TileRow
                    key={tile.id}
                    tile={tile}
                    index={index}
                    count={content.category_tiles.length}
                    open={openId === tile.id}
                    options={options}
                    categories={categories}
                    categoryMissing={!exists}
                    uploading={uploadingId === tile.id}
                    onToggle={() => toggleOpen(tile.id)}
                    onChange={(patch) => updateTile(tile.id, patch)}
                    onUpload={(file) => uploadTileImage(tile.id, file)}
                    onMove={(direction) => moveTile(tile.id, direction)}
                    onRemove={() => removeTile(tile.id)}
                  />
                );
              })}
            </ul>
          )}

          {(() => {
            const full = content.category_tiles.length >= limits.category_tiles;
            const noneLeft = content.category_tiles.length >= categories.length;
            return addButton(
              full
                ? `Maximum of ${limits.category_tiles} reached`
                : noneLeft
                  ? 'All your categories are added'
                  : 'Add category',
              full || noneLeft,
              addTile
            );
          })()}
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <section style={{ ...cardStyle, margin: '0 16px 0 24px', overflow: 'hidden' }} aria-label="Store appearance">
        <SettingsTabs<Tab>
          idPrefix="appearance"
          label="Parts of your home page"
          active={tab}
          onChange={changeTab}
          tabs={[
            { id: 'hero_slides', label: 'Hero slider', badge: `${content.hero_slides.length} / ${limits.hero_slides}` },
            {
              id: 'category_tiles',
              label: 'Shop by category',
              badge: `${content.category_tiles.length} / ${limits.category_tiles}`,
            },
            {
              id: 'promo_banners',
              label: 'Promo banners',
              badge: `${content.promo_banners.length} / ${limits.promo_banners}`,
            },
          ]}
        />
        {tab === 'hero_slides' && renderBannerSection('hero_slides')}
        {tab === 'category_tiles' && renderTilesSection()}
        {tab === 'promo_banners' && renderBannerSection('promo_banners')}
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        busyText={uploadingId !== null ? 'Uploading an image...' : null}
        message={message}
        onSave={handleSave}
      />
    </div>
  );
}
