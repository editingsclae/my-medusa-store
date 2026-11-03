// Small rules for the footer settings page. Only types are imported, so they can
// be tested on their own.

import type { FooterContent, FooterLimits, FooterNetwork } from './medusa';

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

export const DEFAULT_LIMITS: FooterLimits = {
  store_name: 60,
  description: 200,
  social_url: 300,
  networks: NETWORKS,
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
  };
}

// A message for the merchant, or null when the footer can be saved. The server
// checks the links themselves; this only catches what is easy to see here.
export function validateFooter(footer: FooterContent, limits: FooterLimits): string | null {
  if (footer.store_name.trim().length > limits.store_name) {
    return `The store name can have at most ${limits.store_name} characters.`;
  }
  if (footer.description.trim().length > limits.description) {
    return `The description can have at most ${limits.description} characters.`;
  }
  for (const network of NETWORKS) {
    const link = footer.social[network];
    if (link.url.length > limits.social_url) {
      return `${NETWORK_NAMES[network]}: the link is too long.`;
    }
    if (link.enabled && link.url.trim() === '') {
      return `${NETWORK_NAMES[network]}: add the link, or switch it off.`;
    }
  }
  return null;
}

// The networks the footer will show: switched on and with a link
export function visibleNetworks(footer: FooterContent): FooterNetwork[] {
  return NETWORKS.filter((n) => footer.social[n].enabled && footer.social[n].url.trim() !== '');
}
