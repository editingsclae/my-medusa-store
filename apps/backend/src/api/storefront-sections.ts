// The product sections of a storefront's home page: New Arrivals, Best Sellers,
// Trending Now and Featured Products.
//
// A storefront declares which of these it has, in which order and how many products
// each shows (see storefront-layout.ts). The merchant can switch a section off,
// rename it, and choose the Featured products. The products of the other sections
// are worked out here from the store's own orders, so nothing has to be filled in.
//
// The answer is a list of product ids per section; the storefront loads the products
// itself, so prices, stock and variants stay exactly as everywhere else.
// No framework imports, so the rules can be unit tested on their own.

export const SECTION_KEYS = ["new_arrivals", "best_sellers", "trending", "featured"] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const SECTION_TITLES: Record<SectionKey, string> = {
  new_arrivals: "New Arrivals",
  best_sellers: "Best Sellers",
  trending: "Trending Now",
  featured: "Featured Products",
}

// How many products one section can show at most
export const MAX_SECTION_PRODUCTS = 24
export const MAX_SECTION_TITLE = 40

// Best Sellers: the last 90 days; a store with few sales in that time is ranked
// over all its orders instead. Trending Now: the last 14 days only.
export const BEST_SELLERS_DAYS = 90
export const TRENDING_DAYS = 14

// A ranked section with fewer products than this is left out rather than shown
// half empty (or smaller when the storefront has less room than this)
export const MIN_RANKED_PRODUCTS = 3

export const SECTIONS_METADATA_KEY = "storefront_sections"

const DAY_MS = 24 * 60 * 60 * 1000

export type SectionDeclaration = { key: SectionKey; count: number }

export type SectionSetting = { enabled: boolean; title: string }

export type SectionSettings = {
  sections: Record<SectionKey, SectionSetting>
  featured_ids: string[]
}

export type SalesLine = { product_id: string; quantity: number; created_at: string | Date }

export type PublicSection = { key: SectionKey; title: string; product_ids: string[] }

const isSectionKey = (value: unknown): value is SectionKey =>
  typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

// What a storefront sends: [{ key, count }, ...]. The order is the order on the page.
export type DeclarationParse = { ok: true; value: SectionDeclaration[] } | { ok: false; error: string }

export function parseSectionDeclarations(input: unknown): DeclarationParse {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'sections must be a list, for example [{ "key": "new_arrivals", "count": 8 }]' }
  }
  if (input.length > SECTION_KEYS.length) {
    return { ok: false, error: `sections can list at most ${SECTION_KEYS.length} sections` }
  }
  const seen = new Set<string>()
  const value: SectionDeclaration[] = []
  for (const entry of input) {
    if (!isRecord(entry) || !isSectionKey(entry.key)) {
      return { ok: false, error: `Every section needs a key: ${SECTION_KEYS.join(", ")}` }
    }
    if (seen.has(entry.key)) {
      return { ok: false, error: `The section ${entry.key} is listed twice` }
    }
    seen.add(entry.key)
    const count = entry.count
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_SECTION_PRODUCTS) {
      return { ok: false, error: `${entry.key}: count must be a whole number from 1 to ${MAX_SECTION_PRODUCTS}` }
    }
    value.push({ key: entry.key, count })
  }
  return { ok: true, value }
}

// What was stored; a damaged entry is left out instead of failing
export function readStoredDeclarations(input: unknown): SectionDeclaration[] {
  const parsed = parseSectionDeclarations(input)
  if (parsed.ok) return parsed.value
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const value: SectionDeclaration[] = []
  for (const entry of input) {
    const one = parseSectionDeclarations([entry])
    if (one.ok && !seen.has(one.value[0].key) && value.length < SECTION_KEYS.length) {
      seen.add(one.value[0].key)
      value.push(one.value[0])
    }
  }
  return value
}

export function defaultSettings(): SectionSettings {
  return {
    sections: {
      new_arrivals: { enabled: true, title: SECTION_TITLES.new_arrivals },
      best_sellers: { enabled: true, title: SECTION_TITLES.best_sellers },
      trending: { enabled: true, title: SECTION_TITLES.trending },
      featured: { enabled: true, title: SECTION_TITLES.featured },
    },
    featured_ids: [],
  }
}

const cleanTitle = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback
  const text = value.replace(/\s+/g, " ").trim().slice(0, MAX_SECTION_TITLE)
  return text === "" ? fallback : text
}

const cleanIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id === "string" && id.trim() !== "") seen.add(id.trim())
  }
  return [...seen].slice(0, MAX_SECTION_PRODUCTS)
}

// What is stored for a merchant; anything missing or damaged is the default
export function readStoredSettings(metadata: unknown): SectionSettings {
  const base = defaultSettings()
  const stored = isRecord(metadata) ? metadata[SECTIONS_METADATA_KEY] : undefined
  if (!isRecord(stored)) return base
  const sections = isRecord(stored.sections) ? stored.sections : {}
  for (const key of SECTION_KEYS) {
    const one = sections[key]
    if (!isRecord(one)) continue
    base.sections[key] = {
      enabled: typeof one.enabled === "boolean" ? one.enabled : true,
      title: cleanTitle(one.title, SECTION_TITLES[key]),
    }
  }
  base.featured_ids = cleanIds(stored.featured_ids)
  return base
}

export type SettingsParse = { ok: true; value: SectionSettings } | { ok: false; error: string }

// What the portal sends: { sections: { <key>: { enabled, title } }, featured_ids: [...] }.
// `featuredLimit` is the room the storefront has for Featured Products. What the
// request leaves out stays as it is in `current`.
export function parseSettings(
  input: unknown,
  featuredLimit: number,
  current: SectionSettings = defaultSettings()
): SettingsParse {
  if (!isRecord(input)) {
    return { ok: false, error: "Send the settings as an object: { sections, featured_ids }" }
  }
  const value: SectionSettings = {
    sections: { ...current.sections },
    featured_ids: [...current.featured_ids],
  }
  const sections = input.sections
  if (sections !== undefined) {
    if (!isRecord(sections)) return { ok: false, error: "sections must be an object" }
    for (const key of Object.keys(sections)) {
      if (!isSectionKey(key)) return { ok: false, error: `Unknown section: ${key}` }
      const one = sections[key]
      if (!isRecord(one)) return { ok: false, error: `${key}: send { enabled, title }` }
      if (one.enabled !== undefined && typeof one.enabled !== "boolean") {
        return { ok: false, error: `${key}: enabled must be true or false` }
      }
      if (one.title !== undefined) {
        if (typeof one.title !== "string") return { ok: false, error: `${key}: title must be text` }
        if (one.title.trim().length > MAX_SECTION_TITLE) {
          return { ok: false, error: `${key}: the title is too long (at most ${MAX_SECTION_TITLE} characters)` }
        }
      }
      value.sections[key] = {
        enabled: one.enabled !== false,
        title: cleanTitle(one.title, SECTION_TITLES[key]),
      }
    }
  }
  const featured = input.featured_ids
  if (featured !== undefined) {
    if (!Array.isArray(featured) || featured.some((id) => typeof id !== "string" || id.trim() === "")) {
      return { ok: false, error: "featured_ids must be a list of product ids" }
    }
    const ids = cleanIds(featured)
    if (ids.length > featuredLimit) {
      return {
        ok: false,
        error:
          featuredLimit === 0
            ? "Your storefront has no place for Featured Products"
            : `Your storefront has room for ${featuredLimit} featured product${featuredLimit === 1 ? "" : "s"}. Remove ${ids.length - featuredLimit} to be able to save.`,
      }
    }
    value.featured_ids = ids
  }
  return { ok: true, value }
}

// Metadata to save: everything that was there stays
export function withSettings(metadata: unknown, settings: SectionSettings): Record<string, unknown> {
  const current = isRecord(metadata) ? metadata : {}
  return { ...current, [SECTIONS_METADATA_KEY]: settings }
}

// Product ids by units sold, most first. A sale only counts when it is inside the
// window; of two products with the same units, the one sold more recently comes first.
export function rankBySales(
  lines: SalesLine[],
  options: { now: number; days?: number; allowed?: Set<string> }
): string[] {
  const from = options.days === undefined ? -Infinity : options.now - options.days * DAY_MS
  const totals = new Map<string, { units: number; last: number }>()
  for (const line of lines) {
    if (typeof line.product_id !== "string" || line.product_id === "") continue
    if (options.allowed && !options.allowed.has(line.product_id)) continue
    const at = new Date(line.created_at).getTime()
    if (!Number.isFinite(at) || at < from || at > options.now) continue
    const units = Number(line.quantity)
    if (!Number.isFinite(units) || units <= 0) continue
    const current = totals.get(line.product_id) ?? { units: 0, last: 0 }
    totals.set(line.product_id, { units: current.units + units, last: Math.max(current.last, at) })
  }
  return [...totals.entries()]
    .sort((a, b) => b[1].units - a[1].units || b[1].last - a[1].last || a[0].localeCompare(b[0]))
    .map(([id]) => id)
}

export type SectionInput = {
  declared: SectionDeclaration[]
  settings: SectionSettings
  // The store's published products, newest first
  newest: string[]
  sales: SalesLine[]
  now: number
}

// The sections to show, in the order the storefront declared them. A section is left
// out when the merchant switched it off or when it has too few products to look right.
export function buildSections(input: SectionInput): PublicSection[] {
  const { declared, settings, newest, sales, now } = input
  const allowed = new Set(newest)
  const result: PublicSection[] = []

  for (const { key, count } of declared) {
    const setting = settings.sections[key]
    if (!setting.enabled) continue

    let ids: string[] = []
    if (key === "new_arrivals") {
      ids = newest
    } else if (key === "featured") {
      ids = settings.featured_ids.filter((id) => allowed.has(id))
    } else if (key === "trending") {
      ids = rankBySales(sales, { now, days: TRENDING_DAYS, allowed })
    } else {
      const minimum = Math.min(MIN_RANKED_PRODUCTS, count)
      const recent = rankBySales(sales, { now, days: BEST_SELLERS_DAYS, allowed })
      ids = recent.length >= minimum ? recent : rankBySales(sales, { now, allowed })
    }

    const minimum = key === "trending" || key === "best_sellers" ? Math.min(MIN_RANKED_PRODUCTS, count) : 1
    const product_ids = ids.slice(0, count)
    if (product_ids.length < minimum) continue
    result.push({ key, title: setting.title, product_ids })
  }
  return result
}
