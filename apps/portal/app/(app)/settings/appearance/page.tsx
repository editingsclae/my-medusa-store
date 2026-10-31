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
  StorefrontContent,
  StorefrontLimits,
} from '@/lib/medusa';

type Section = 'hero_slides' | 'promo_banners';

const DEFAULT_LIMITS: StorefrontLimits = {
  hero_slides: 3,
  promo_banners: 2,
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
    description: 'Up to 2 banners shown side by side near the bottom of your home page.',
    itemName: 'Promo banner',
    labelName: 'Collection name (for example "Electronics")',
    imageTip: 'Best size 800 × 300 px. Keep the main subject on the right side: the text appears on the left.',
    ratio: '8 / 3',
  },
};

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

// The same checks as the backend, so a problem is shown before saving.
function validate(content: StorefrontContent, limits: StorefrontLimits): string | null {
  for (const section of ['hero_slides', 'promo_banners'] as Section[]) {
    const info = SECTION_INFO[section];
    const list = content[section];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const where = `${info.itemName} ${i + 1}`;
      if (!b.image_url) return `${where} needs an image.`;
      if (b.label.trim().length > limits.label) return `${where}: the small text is too long (at most ${limits.label} characters).`;
      if (b.title.trim().length > limits.title) return `${where}: the title is too long (at most ${limits.title} characters).`;
      if (b.text.trim().length > limits.text) return `${where}: the text is too long (at most ${limits.text} characters).`;
      if (b.button_label.trim().length > limits.button_label) {
        return `${where}: the button text is too long (at most ${limits.button_label} characters).`;
      }
      if ((b.link.type === 'category' || b.link.type === 'product') && !b.link.handle) {
        return `${where}: choose the ${b.link.type} to link to.`;
      }
      if (b.button_label.trim() && b.link.type === 'none') {
        return `${where}: choose where the button goes, or remove the button text.`;
      }
    }
  }
  return null;
}

type BannerCardProps = {
  section: Section;
  banner: StorefrontBanner;
  index: number;
  count: number;
  limits: StorefrontLimits;
  categories: MerchantCategory[];
  products: MerchantProduct[];
  uploading: boolean;
  onChange: (patch: Partial<StorefrontBanner>) => void;
  onUpload: (file: File) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

function BannerCard({
  section,
  banner,
  index,
  count,
  limits,
  categories,
  products,
  uploading,
  onChange,
  onUpload,
  onMove,
  onRemove,
}: BannerCardProps) {
  const info = SECTION_INFO[section];
  const fileInput = useRef<HTMLInputElement>(null);
  const linkable = products.filter((p) => p.handle);

  const setLinkType = (type: BannerLinkType) => {
    onChange({ link: type === 'category' || type === 'product' ? { type, handle: '' } : { type } });
  };

  return (
    <li
      style={{
        border: '1px solid #E6E8EC',
        borderRadius: '18px',
        padding: '16px',
        background: banner.enabled ? '#FFFFFF' : '#F7F8FA',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <strong style={{ fontSize: '16px', flex: '1 1 auto' }}>
          {info.itemName} {index + 1}
        </strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={banner.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          Show on my store
        </label>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={{ ...smallButton, opacity: index === 0 ? 0.5 : 1 }}>
          Move up
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          style={{ ...smallButton, opacity: index === count - 1 ? 0.5 : 1 }}
        >
          Move down
        </button>
        <button type="button" onClick={onRemove} style={{ ...smallButton, color: '#B42318', borderColor: '#F5B5B5' }}>
          Remove
        </button>
      </div>

      {/* Image */}
      <div>
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
            width: '100%',
            aspectRatio: info.ratio,
            borderRadius: '14px',
            overflow: 'hidden',
            border: banner.image_url ? '1px solid #E5E7EB' : '2px dashed #D1D5DB',
            background: '#F9FAFB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {banner.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.image_url}
              alt={`${info.itemName} ${index + 1} preview`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '14px', color: '#6B7280' }}>No image yet</span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            style={{ ...smallButton, opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? 'Uploading...' : banner.image_url ? 'Replace image' : 'Upload image'}
          </button>
          <span style={{ fontSize: '12px', color: '#6B7280', flex: '1 1 240px' }}>{info.imageTip}</span>
        </div>
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <label style={{ ...labelStyle, flex: '1 1 240px' }}>
          {info.labelName}
          <input
            value={banner.label}
            maxLength={limits.label}
            onChange={(e) => onChange({ label: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: '1 1 240px' }}>
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

      {/* Button and link */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <label style={{ ...labelStyle, flex: '1 1 180px' }}>
          Button text
          <input
            value={banner.button_label}
            maxLength={limits.button_label}
            placeholder="Shop now"
            onChange={(e) => onChange({ button_label: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ ...labelStyle, flex: '1 1 180px' }}>
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
          <label style={{ ...labelStyle, flex: '1 1 220px' }}>
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
          <label style={{ ...labelStyle, flex: '1 1 220px' }}>
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
    </li>
  );
}

export default function AppearanceSettingsPage() {
  const [checking, setChecking] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [content, setContent] = useState<StorefrontContent>({ hero_slides: [], promo_banners: [] });
  const [savedJson, setSavedJson] = useState('');
  const [limits, setLimits] = useState<StorefrontLimits>(DEFAULT_LIMITS);
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [products, setProducts] = useState<MerchantProduct[]>([]);

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
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your banners.');
    } finally {
      setLoading(false);
    }
    // The link pickers are optional: without them a banner can still link to the shop
    getMerchantCategories()
      .then((res) => setCategories(res.categories || []))
      .catch(() => setCategories([]));
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

  const updateBanner = (section: Section, id: string, patch: Partial<StorefrontBanner>) => {
    setMessage(null);
    setContent((prev) => ({
      ...prev,
      [section]: prev[section].map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  const addBanner = (section: Section) => {
    setMessage(null);
    setContent((prev) => ({ ...prev, [section]: [...prev[section], emptyBanner()] }));
  };

  const removeBanner = (section: Section, id: string) => {
    setMessage(null);
    setContent((prev) => ({ ...prev, [section]: prev[section].filter((b) => b.id !== id) }));
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

  const uploadImage = async (section: Section, id: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      return setMessage({ kind: 'error', text: 'Please choose an image file (PNG, JPG, WEBP).' });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return setMessage({ kind: 'error', text: 'This image is too large. Please use one under 5 MB.' });
    }

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
    const problem = validate(content, limits);
    if (problem) return setMessage({ kind: 'error', text: problem });

    setSaving(true);
    setMessage(null);
    try {
      const res = await saveStorefrontContent(content);
      setContent(res.storefront);
      setSavedJson(JSON.stringify(res.storefront));
      setMessage({ kind: 'ok', text: 'Saved. Your store shows the new banners right away.' });
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

  const sections: Section[] = ['hero_slides', 'promo_banners'];

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

      {sections.map((section) => {
        const info = SECTION_INFO[section];
        const list = content[section];
        const max = limits[section];

        return (
          <section key={section} style={{ ...cardStyle, padding: '24px' }} aria-labelledby={`${section}-heading`}>
            <h2 id={`${section}-heading`} style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              {info.heading}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4B5263' }}>{info.description}</p>

            {list.length === 0 ? (
              <p style={{ margin: '16px 0 0', fontSize: '14px', color: '#4B5263' }}>
                {section === 'hero_slides'
                  ? 'No slides yet. Your store shows a simple welcome banner until you add one.'
                  : 'No promo banners yet. Nothing is shown in this place on your store.'}
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: '14px' }}>
                {list.map((banner, index) => (
                  <BannerCard
                    key={banner.id}
                    section={section}
                    banner={banner}
                    index={index}
                    count={list.length}
                    limits={limits}
                    categories={categories}
                    products={products}
                    uploading={uploadingId === banner.id}
                    onChange={(patch) => updateBanner(section, banner.id, patch)}
                    onUpload={(file) => uploadImage(section, banner.id, file)}
                    onMove={(direction) => moveBanner(section, banner.id, direction)}
                    onRemove={() => removeBanner(section, banner.id)}
                  />
                ))}
              </ul>
            )}

            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                disabled={list.length >= max}
                onClick={() => addBanner(section)}
                style={{ ...pillButton, border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#374151', opacity: list.length >= max ? 0.5 : 1 }}
              >
                {list.length >= max ? `Maximum of ${max} reached` : `Add ${info.itemName.toLowerCase()}`}
              </button>
            </div>
          </section>
        );
      })}

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
          disabled={saving || uploadingId !== null || !dirty}
          onClick={handleSave}
          style={{
            ...pillButton,
            border: 0,
            background: 'var(--accent)',
            color: '#FFFFFF',
            opacity: saving || uploadingId !== null || !dirty ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <span style={{ fontSize: '14px', color: dirty ? '#B54708' : '#6B7280' }}>
          {uploadingId !== null ? 'Uploading an image...' : dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
      </div>
    </div>
  );
}
