// The rules of the Home sections settings, without React so they can be tested
// on their own. The server checks everything again.

import type { HomeSectionsSettings } from './medusa';

export const MAX_TITLE = 40;

// Moves the item at `index` one place up (-1) or down (1)
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function isDirty(saved: HomeSectionsSettings | null, draft: HomeSectionsSettings | null): boolean {
  if (!saved || !draft) return false;
  return JSON.stringify(saved) !== JSON.stringify(draft);
}

// How many featured products are over what the storefront has room for
export function featuredOver(chosen: number, room: number): number {
  return Math.max(0, chosen - room);
}

// What a section does, in words the merchant understands
export function sectionHelp(key: string, count: number, windows: { best_sellers_days: number; trending_days: number }): string {
  const minimum = Math.min(3, count);
  switch (key) {
    case 'new_arrivals':
      return 'Your newest products. Nothing to fill in.';
    case 'best_sellers':
      return `The products you sold the most in the last ${windows.best_sellers_days} days (all your orders while you have few sales). Hidden until at least ${minimum} products have sold.`;
    case 'trending':
      return `The products you sold the most in the last ${windows.trending_days} days. Hidden until at least ${minimum} products have sold in that time.`;
    default:
      return 'The products you choose. Hidden until you choose at least one.';
  }
}

export function validateSettings(draft: HomeSectionsSettings): string | null {
  for (const [key, setting] of Object.entries(draft.sections)) {
    if (setting.title.trim().length > MAX_TITLE) {
      return `The title of ${key.replace('_', ' ')} is too long (at most ${MAX_TITLE} characters).`;
    }
  }
  return null;
}
