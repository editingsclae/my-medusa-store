// How much room a storefront has for what the merchant fills in, as the
// storefront itself declares it. Today that is the number of promo banners: one
// store has 2 places, another 3, another 6. The portal shows exactly that many.
//
// A storefront declares its layout with a layout key. The merchant creates the key
// in the portal and gives it to whoever builds the storefront; the publishable key
// cannot be used for this because it is public. Only a hash of the key is kept.
// No framework imports, so the rules can be unit tested on their own.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { DEFAULT_PROMO_BANNERS, MAX_PROMO_BANNERS } from "./storefront-content"

export const LAYOUT_METADATA_KEY = "storefront_layout"
export const LAYOUT_KEY_HASH_KEY = "storefront_layout_key_hash"
export const LAYOUT_KEY_HEADER = "x-layout-key"

export type StorefrontLayout = {
  // Places for promo banners; 0 means the storefront has none
  promo_banners: number
  // When the storefront said so; missing while the default applies
  declared_at?: string
}

export type LayoutParse = { ok: true; value: { promo_banners: number } } | { ok: false; error: string }

export function parseLayout(input: unknown): LayoutParse {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Send the layout as an object, for example { \"promo_banners\": 3 }" }
  }
  const count = (input as Record<string, unknown>).promo_banners
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > MAX_PROMO_BANNERS) {
    return {
      ok: false,
      error: `promo_banners must be a whole number from 0 to ${MAX_PROMO_BANNERS}`,
    }
  }
  return { ok: true, value: { promo_banners: count } }
}

// What is stored; a damaged entry falls back to the default instead of failing
export function readStoredLayout(metadata: unknown): StorefrontLayout {
  const stored =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)[LAYOUT_METADATA_KEY]
      : undefined
  const raw = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {}
  const parsed = parseLayout(raw)
  if (!parsed.ok) return { promo_banners: DEFAULT_PROMO_BANNERS }
  return {
    promo_banners: parsed.value.promo_banners,
    ...(typeof raw.declared_at === "string" ? { declared_at: raw.declared_at } : {}),
  }
}

// Metadata to save: everything that was there stays
export function withLayout(metadata: unknown, layout: StorefrontLayout): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {}
  return { ...current, [LAYOUT_METADATA_KEY]: layout }
}

export function withLayoutKeyHash(metadata: unknown, hash: string): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {}
  return { ...current, [LAYOUT_KEY_HASH_KEY]: hash }
}

export function hasLayoutKey(metadata: unknown): boolean {
  const hash =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)[LAYOUT_KEY_HASH_KEY]
      : undefined
  return typeof hash === "string" && hash.length > 0
}

export function newLayoutKey(): string {
  return `lk_${randomBytes(24).toString("hex")}`
}

export function hashLayoutKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

// True when `key` is the key whose hash is stored. The comparison takes the
// same time whatever the key looks like.
export function layoutKeyMatches(key: unknown, metadata: unknown): boolean {
  if (typeof key !== "string" || key.length === 0 || key.length > 200) return false
  const stored =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)[LAYOUT_KEY_HASH_KEY]
      : undefined
  if (typeof stored !== "string" || stored.length === 0) return false
  const a = Buffer.from(hashLayoutKey(key))
  const b = Buffer.from(stored)
  return a.length === b.length && timingSafeEqual(a, b)
}

// The key as the header carries it (a header can be a list)
export function keyFromHeader(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" ? first.trim() : undefined
}
