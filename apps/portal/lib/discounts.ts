import type { MerchantProduct } from '@/lib/medusa';

// The same arithmetic as the backend: worked out in hundredths, so 19.90 never
// loses a cent to floating point rounding. Used only for the preview; the backend
// decides the real price.
export function discountedPrice(base: number, percent: number): number | null {
  if (!Number.isFinite(base) || base <= 0) return null;
  const cents = Math.round(base * 100);
  const sale = Math.round((cents * (100 - percent)) / 100) / 100;
  return sale > 0 && sale < base ? sale : null;
}

// The lowest and highest normal price of a product in a currency, or null when it
// has none.
export function priceRange(product: MerchantProduct, currencyCode: string): { min: number; max: number } | null {
  const wanted = currencyCode.toLowerCase();
  const amounts: number[] = [];
  for (const variant of product.variants || []) {
    for (const price of variant.prices || []) {
      const amount = Number(price.amount);
      if ((price.currency_code || '').toLowerCase() === wanted && Number.isFinite(amount) && amount > 0) {
        amounts.push(amount);
        break;
      }
    }
  }
  if (amounts.length === 0) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

export function formatAmount(amount: number, currencyCode: string): string {
  return `${amount.toFixed(2)} ${currencyCode.toUpperCase()}`.trim();
}

// "2026-11-20" -> "Nov 20, 2026". The date is shown as written, with no time zone shift.
export function formatDay(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  });
}

export function periodText(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return 'No end date';
  if (startsAt && endsAt) return `${formatDay(startsAt)} to ${formatDay(endsAt)}`;
  if (endsAt) return `Until ${formatDay(endsAt)}`;
  return `From ${formatDay(startsAt)}`;
}
