// The rules of merchant coupons, kept apart from the routes so they can be tested.
// A coupon is a Medusa promotion that only works in the merchant's own sales channel,
// with a campaign next to it that holds its dates and its one-use-per-customer limit.

export const COUPON_KIND = "merchant_coupon"

const MIN_PERCENT = 1
const MAX_PERCENT = 90
const MAX_FIXED = 1_000_000
const MAX_USES = 1_000_000
const MIN_CODE_LENGTH = 3
const MAX_CODE_LENGTH = 30

// Tunisia has no daylight saving time, so its offset is fixed
const SHOP_OFFSET = "+01:00"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export type CouponKind = "percent" | "fixed"

export type CouponInput = {
  code: string
  kind: CouponKind
  value: number
  startsAt: Date | null
  endsAt: Date | null
  maxUses: number | null
  perCustomer: boolean
  minOrder: number | null
}

export type ParsedCoupon = { ok: true; value: CouponInput } | { ok: false; error: string }

export type CouponStatus = "scheduled" | "active" | "expired" | "used_up"

// What a shopper types is often in lower case or has spaces around it
export function normalizeCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : ""
}

function parseMoment(value: unknown, edge: "start" | "end"): Date | null | undefined {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value !== "string") return null
  const text = value.trim()
  const date = DATE_ONLY.test(text)
    ? new Date(`${text}${edge === "start" ? "T00:00:00.000" : "T23:59:59.999"}${SHOP_OFFSET}`)
    : new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// Three decimals, the smallest unit of the dinar is the millime
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function parseCouponInput(body: unknown, now: Date): ParsedCoupon {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>

  const code = normalizeCode(data.code)
  if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH || !/^[A-Z0-9_-]+$/.test(code)) {
    return {
      ok: false,
      error: `The code must be ${MIN_CODE_LENGTH} to ${MAX_CODE_LENGTH} characters: letters, numbers, - or _.`,
    }
  }

  if (data.kind !== "percent" && data.kind !== "fixed") {
    return { ok: false, error: "Choose a percentage or a fixed amount." }
  }
  const kind: CouponKind = data.kind

  const rawValue = parseNumber(data.value)
  let value: number
  if (kind === "percent") {
    if (rawValue === null || !Number.isInteger(rawValue) || rawValue < MIN_PERCENT || rawValue > MAX_PERCENT) {
      return { ok: false, error: `The discount must be a whole percentage from ${MIN_PERCENT} to ${MAX_PERCENT}.` }
    }
    value = rawValue
  } else {
    if (rawValue === null || rawValue <= 0 || rawValue > MAX_FIXED) {
      return { ok: false, error: "Enter the amount to take off, more than 0." }
    }
    value = round3(rawValue)
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

  let maxUses: number | null = null
  if (data.max_uses !== undefined && data.max_uses !== null && data.max_uses !== "") {
    const n = parseNumber(data.max_uses)
    if (n === null || !Number.isInteger(n) || n < 1 || n > MAX_USES) {
      return { ok: false, error: "The number of uses must be a whole number of 1 or more." }
    }
    maxUses = n
  }

  let minOrder: number | null = null
  if (data.min_order !== undefined && data.min_order !== null && data.min_order !== "") {
    const n = parseNumber(data.min_order)
    if (n === null || n <= 0 || n > MAX_FIXED) {
      return { ok: false, error: "The minimum order must be more than 0." }
    }
    minOrder = round3(n)
  }
  if (kind === "fixed" && minOrder !== null && value >= minOrder) {
    return { ok: false, error: "The amount off must be lower than the minimum order." }
  }

  return {
    ok: true,
    value: {
      code,
      kind,
      value,
      startsAt,
      endsAt,
      maxUses,
      perCustomer: data.per_customer === true,
      minOrder,
    },
  }
}

export function couponStatus(
  now: Date,
  startsAt: Date | null,
  endsAt: Date | null,
  used: number,
  maxUses: number | null
): CouponStatus {
  if (endsAt && endsAt.getTime() < now.getTime()) return "expired"
  if (maxUses !== null && used >= maxUses) return "used_up"
  if (startsAt && startsAt.getTime() > now.getTime()) return "scheduled"
  return "active"
}

// The campaign carries the owner, so a merchant's coupons can be found again
export function couponCampaignDescription(merchantId: string): string {
  return `merchant-coupon:${merchantId}`
}

export type CouponMetadata = { minOrder: number | null; perCustomer: boolean }

export function toCouponMetadata(merchantId: string, input: Pick<CouponInput, "minOrder" | "perCustomer">) {
  return {
    kind: COUPON_KIND,
    merchant_id: merchantId,
    min_order: input.minOrder,
    per_customer: input.perCustomer,
  }
}

// Read back only for the merchant that owns it
export function readCouponMetadata(meta: unknown, merchantId: string): CouponMetadata | null {
  if (!meta || typeof meta !== "object") return null
  const m = meta as Record<string, unknown>
  if (m.kind !== COUPON_KIND || m.merchant_id !== merchantId) return null
  const minOrder = typeof m.min_order === "number" && m.min_order > 0 ? m.min_order : null
  return { minOrder, perCustomer: m.per_customer === true }
}

// The least a cart must be worth for the coupon, from the cart's own numbers.
// Returns the message to show, or null when the cart is enough.
export function minOrderProblem(minOrder: number | null, cartSubtotal: number, currency: string): string | null {
  if (minOrder === null) return null
  if (cartSubtotal + 1e-9 >= minOrder) return null
  return `This coupon needs an order of at least ${minOrder.toFixed(2)} ${currency.toUpperCase()}.`
}
