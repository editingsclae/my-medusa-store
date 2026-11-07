// The badge on a product card ("New", "Bestseller", "Sale"...): a short text the
// merchant chooses for one product. It is kept in the product's own metadata, so it
// belongs to that merchant only (Medusa's product tags are shared by all merchants).
// No framework imports, so the rules can be unit tested on their own.

export const BADGE_METADATA_KEY = "badge"
export const MAX_BADGE_LENGTH = 16

// The portal offers these; the merchant can also type their own short text
export const BADGE_PRESETS = ["New", "Bestseller", "Sale", "Limited"] as const

export type BadgeParse = { ok: true; value: string } | { ok: false; message: string }

// What a merchant sends: text, or empty / null for no badge. Extra spaces are
// removed; a badge that is too long is refused, not cut, so the merchant sees it.
export function parseBadge(input: unknown): BadgeParse {
  if (input === null || input === undefined) return { ok: true, value: "" }
  if (typeof input !== "string") return { ok: false, message: "badge must be text" }
  const text = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  if (text.length > MAX_BADGE_LENGTH) {
    return { ok: false, message: `The badge is too long (at most ${MAX_BADGE_LENGTH} characters)` }
  }
  return { ok: true, value: text }
}

// The badge stored on a product; "" when there is none or the entry is damaged
export function readBadge(metadata: unknown): string {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return ""
  const parsed = parseBadge((metadata as Record<string, unknown>)[BADGE_METADATA_KEY])
  return parsed.ok ? parsed.value : ""
}

// Metadata to save: everything that was there stays. With no badge the key is set to
// "" instead of left out, so the result is the same whether Medusa merges metadata or
// replaces it, and the old badge cannot survive.
export function withBadge(metadata: unknown, badge: string): Record<string, unknown> {
  const current =
    metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  return { ...current, [BADGE_METADATA_KEY]: badge }
}
