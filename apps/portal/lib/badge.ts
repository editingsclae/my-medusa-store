// The badge on a product card ("New", "Bestseller"...). No React here, so the rules
// can be tested on their own. The server checks everything again.

import type { MerchantProduct } from './medusa';

export const MAX_BADGE = 16;
export const BADGE_PRESETS = ['New', 'Bestseller', 'Sale', 'Limited'] as const;

// What is kept of what was typed: no extra spaces, at most MAX_BADGE characters
export function tidyBadge(text: string): string {
  return text.replace(/\s+/g, ' ').trimStart().slice(0, MAX_BADGE);
}

// The badge a product has now; empty when it has none
export function badgeFromProduct(product: Pick<MerchantProduct, 'metadata'> | null | undefined): string {
  const value = product?.metadata?.badge;
  return typeof value === 'string' ? tidyBadge(value).trim() : '';
}

export function isPreset(badge: string): boolean {
  return (BADGE_PRESETS as readonly string[]).includes(badge);
}
