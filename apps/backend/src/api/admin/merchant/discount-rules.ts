// Product discounts: a merchant takes 10% or 20% off chosen products for a while.
// Each discount is one Medusa price list of type "sale", so the storefront gets
// both prices (price_list sale: original_amount 100, calculated_amount 90). No
// framework imports, so the rules can be unit tested on their own.

export const MIN_PERCENT = 1
export const MAX_PERCENT = 90
export const MAX_PRODUCTS = 100
export const MAX_TITLE_LENGTH = 60

// Tunisia has no daylight saving time, so its offset is fixed
const SHOP_OFFSET = "+01:00"

export type DiscountInput = {
  percent: number
  productIds: string[]
  startsAt: Date | null
  endsAt: Date | null
  title: string
}

export type ParsedDiscount = { ok: true; value: DiscountInput } | { ok: false; error: string }

export type DiscountWindow = { startsAt: Date | null; endsAt: Date | null }

export type ExistingDiscount = DiscountWindow & { productIds: string[] }

export type PriceLike = {
  amount?: unknown
  currency_code?: string | null
  price_list_id?: string | null
  min_quantity?: unknown
  max_quantity?: unknown
}

export type DiscountStatus = "scheduled" | "active" | "ended"

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// "2026-11-20" as the first or the last moment of that day in the shop's time.
// A full date and time is taken as it is. Empty means no date. Null = not a date.
function parseMoment(value: unknown, edge: "start" | "end"): Date | null | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string") return null

  const text = value.trim()
  const date = DATE_ONLY.test(text)
    ? new Date(`${text}${edge === "start" ? "T00:00:00.000" : "T23:59:59.999"}${SHOP_OFFSET}`)
    : new Date(text)

  return Number.isNaN(date.getTime()) ? null : date
}

export function parseDiscountInput(body: unknown, now: Date): ParsedDiscount {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>

  const percent = typeof data.percent === "string" && data.percent.trim() !== "" ? Number(data.percent) : data.percent
  if (typeof percent !== "number" || !Number.isInteger(percent) || percent < MIN_PERCENT || percent > MAX_PERCENT) {
    return { ok: false, error: `The discount must be a whole percentage from ${MIN_PERCENT} to ${MAX_PERCENT}.` }
  }

  if (!Array.isArray(data.product_ids) || data.product_ids.some((id) => typeof id !== "string" || !id)) {
    return { ok: false, error: "Choose at least one product." }
  }
  const productIds = [...new Set(data.product_ids as string[])]
  if (productIds.length === 0) {
    return { ok: false, error: "Choose at least one product." }
  }
  if (productIds.length > MAX_PRODUCTS) {
    return { ok: false, error: `A discount can have at most ${MAX_PRODUCTS} products.` }
  }

  const starts = parseMoment(data.starts_at, "start")
  const ends = parseMoment(data.ends_at, "end")
  if (starts === null) return { ok: false, error: "The start date is not a valid date." }
  if (ends === null) return { ok: false, error: "The end date is not a valid date." }

  const startsAt = starts ?? null
  const endsAt = ends ?? null
  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return { ok: false, error: "The end date must be in the future." }
  }
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "The end date must be after the start date." }
  }

  const rawTitle = typeof data.title === "string" ? data.title.trim() : ""
  if (rawTitle.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `The name can be at most ${MAX_TITLE_LENGTH} characters.` }
  }

  return {
    ok: true,
    value: { percent, productIds, startsAt, endsAt, title: rawTitle || `${percent}% off` },
  }
}

// The price after the discount, rounded to two decimals. Null when the discount
// would not make the price lower, or the price is not a usable amount.
export function salePrice(base: unknown, percent: number): number | null {
  const amount = Number(base)
  if (!Number.isFinite(amount) || amount <= 0) return null
  // Worked out in hundredths, so a price like 19.90 never loses a cent to
  // floating point rounding
  const cents = Math.round(amount * 100)
  const sale = Math.round((cents * (100 - percent)) / 100) / 100
  return sale > 0 && sale < amount ? sale : null
}

// The normal price of a variant in a currency. Prices that belong to a price list
// (a sale) or only apply from a quantity are not the normal price.
export function pickBasePrice(prices: PriceLike[] | null | undefined, currency: string): number | null {
  const wanted = currency.toLowerCase()
  for (const price of prices || []) {
    if (!price || price.price_list_id) continue
    if ((price.currency_code || "").toLowerCase() !== wanted) continue
    if (price.min_quantity || price.max_quantity) continue
    const amount = Number(price.amount)
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  return null
}

export function discountStatus(now: Date, startsAt: Date | null, endsAt: Date | null): DiscountStatus {
  if (endsAt && endsAt.getTime() < now.getTime()) return "ended"
  if (startsAt && startsAt.getTime() > now.getTime()) return "scheduled"
  return "active"
}

// Two periods overlap when each starts before the other ends. No date = no limit.
export function windowsOverlap(a: DiscountWindow, b: DiscountWindow): boolean {
  const aStart = a.startsAt ? a.startsAt.getTime() : -Infinity
  const aEnd = a.endsAt ? a.endsAt.getTime() : Infinity
  const bStart = b.startsAt ? b.startsAt.getTime() : -Infinity
  const bEnd = b.endsAt ? b.endsAt.getTime() : Infinity
  return aStart <= bEnd && bStart <= aEnd
}

// Products that already have a discount (not ended) in the same period. One
// product can only have one discount at a time, so the price is never unclear.
export function findBlockedProducts(
  window: DiscountWindow,
  productIds: string[],
  existing: ExistingDiscount[],
  now: Date
): string[] {
  const blocked = new Set<string>()
  for (const discount of existing) {
    if (discountStatus(now, discount.startsAt, discount.endsAt) === "ended") continue
    if (!windowsOverlap(window, discount)) continue
    for (const id of discount.productIds) {
      if (productIds.includes(id)) blocked.add(id)
    }
  }
  return [...blocked]
}

export const DISCOUNT_KIND = "merchant_discount"

// What is stored on the price list, so a merchant's discounts can be found again
export function toDiscountMetadata(input: { merchantId: string; percent: number; productIds: string[]; currencyCode: string }) {
  return {
    kind: DISCOUNT_KIND,
    merchant_id: input.merchantId,
    percent: input.percent,
    product_ids: input.productIds,
    currency_code: input.currencyCode,
  }
}

export function readDiscountMetadata(
  metadata: unknown,
  merchantId: string
): { percent: number; productIds: string[]; currencyCode: string } | null {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as Record<string, unknown>
  if (m.kind !== DISCOUNT_KIND || m.merchant_id !== merchantId) return null
  if (typeof m.percent !== "number" || !Array.isArray(m.product_ids)) return null
  return {
    percent: m.percent,
    productIds: (m.product_ids as unknown[]).filter((id): id is string => typeof id === "string"),
    currencyCode: typeof m.currency_code === "string" ? m.currency_code : "",
  }
}

// The description of the price list. The same text is used to find a merchant's
// discounts in the database, so the merchant's id must be in it exactly like this.
export function discountDescription(merchantId: string): string {
  return `merchant:${merchantId}`
}

// Prices that belong to a price list (a sale) are not the product's own price. The
// merchant screens must keep showing and saving the normal price.
export function withoutSalePrices<T extends { price_list_id?: string | null }>(prices: T[] | null | undefined): T[] {
  return (prices || []).filter((price) => !price?.price_list_id)
}
