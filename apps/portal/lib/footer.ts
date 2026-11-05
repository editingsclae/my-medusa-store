// Small rules for the footer settings page. Only types are imported, so they can
// be tested on their own.

import type { FooterContent, FooterLimits, FooterNetwork, FooterPageKey } from './medusa';

export const NETWORKS: FooterNetwork[] = ['tiktok', 'facebook', 'instagram'];

export const NETWORK_NAMES: Record<FooterNetwork, string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

export const NETWORK_PLACEHOLDERS: Record<FooterNetwork, string> = {
  tiktok: 'https://www.tiktok.com/@yourstore or @yourstore',
  facebook: 'https://www.facebook.com/yourstore or @yourstore',
  instagram: 'https://www.instagram.com/yourstore or @yourstore',
};

export const PAGE_KEYS: FooterPageKey[] = ['contact', 'shipping', 'returns', 'privacy', 'terms'];

export const PAGE_TITLES: Record<FooterPageKey, string> = {
  contact: 'Contact Us',
  shipping: 'Shipping',
  returns: 'Returns',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

export const PAGE_HINTS: Record<FooterPageKey, string> = {
  contact: 'How shoppers can reach you: phone, email, address, opening hours.',
  shipping: 'Where you deliver, how long it takes and what it costs.',
  returns: 'How a shopper can return or exchange a product.',
  privacy: 'What you do with your customers’ information.',
  terms: 'The rules for buying from your store.',
};

export const DEFAULT_LIMITS: FooterLimits = {
  store_name: 60,
  description: 200,
  social_url: 300,
  networks: NETWORKS,
  shop_categories: 5,
  page: 20000,
  pages: PAGE_KEYS.map((key) => ({ key, title: PAGE_TITLES[key] })),
};

export function emptyFooter(): FooterContent {
  return {
    store_name: '',
    description: '',
    social: {
      tiktok: { url: '', enabled: false },
      facebook: { url: '', enabled: false },
      instagram: { url: '', enabled: false },
    },
    shop_category_ids: [],
    pages: { contact: '', shipping: '', returns: '', privacy: '', terms: '' },
  };
}

export type FooterTab = 'about' | 'social' | 'shop' | 'pages' | 'preview';

export type FooterProblem = { message: string; tab: FooterTab; pageKey?: FooterPageKey };

// `categories` is null while the list is not loaded: the server then checks the
// categories. The first problem with where it is (which tab, and which page), or
// null when the footer can be saved. The server checks the links themselves; this
// only catches what is easy to see here.
export function findFooterProblem(
  footer: FooterContent,
  limits: FooterLimits,
  categories: Array<{ id: string }> | null = null
): FooterProblem | null {
  if (footer.store_name.trim().length > limits.store_name) {
    return { tab: 'about', message: `The store name can have at most ${limits.store_name} characters.` };
  }
  if (footer.description.trim().length > limits.description) {
    return { tab: 'about', message: `The description can have at most ${limits.description} characters.` };
  }
  for (const network of NETWORKS) {
    const link = footer.social[network];
    if (link.url.length > limits.social_url) {
      return { tab: 'social', message: `${NETWORK_NAMES[network]}: the link is too long.` };
    }
    if (link.enabled && link.url.trim() === '') {
      return { tab: 'social', message: `${NETWORK_NAMES[network]}: add the link, or switch it off.` };
    }
  }
  if (footer.shop_category_ids.length > limits.shop_categories) {
    return { tab: 'shop', message: `The Shop column can have at most ${limits.shop_categories} categories.` };
  }
  if (categories) {
    for (const id of footer.shop_category_ids) {
      if (!categories.some((c) => c.id === id)) {
        return { tab: 'shop', message: 'A category of the Shop column no longer exists. Remove it from the list.' };
      }
    }
  }
  for (const key of PAGE_KEYS) {
    if (footer.pages[key].trim().length > limits.page) {
      return { tab: 'pages', pageKey: key, message: `${PAGE_TITLES[key]} can have at most ${limits.page} characters.` };
    }
  }
  return null;
}

// Only the message, for callers that do not need to know where the problem is
export function validateFooter(
  footer: FooterContent,
  limits: FooterLimits,
  categories: Array<{ id: string }> | null = null
): string | null {
  return findFooterProblem(footer, limits, categories)?.message ?? null;
}

// The networks the footer will show: switched on and with a link
export function visibleNetworks(footer: FooterContent): FooterNetwork[] {
  return NETWORKS.filter((n) => footer.social[n].enabled && footer.social[n].url.trim() !== '');
}

// The support pages the footer will link to: only the ones with text
export function visiblePages(footer: FooterContent): FooterPageKey[] {
  return PAGE_KEYS.filter((key) => footer.pages[key].trim() !== '');
}

// Adds a category at the end of the Shop column. Nothing changes when it is
// already there or the column is full.
export function addShopCategory(ids: string[], id: string, max: number): string[] {
  if (id === '' || ids.includes(id) || ids.length >= max) return ids;
  return [...ids, id];
}

export function removeShopCategory(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

// Moves a category one place up (-1) or down (1). Nothing changes at the ends.
export function moveShopCategory(ids: string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next[from] = ids[to];
  next[to] = id;
  return next;
}
