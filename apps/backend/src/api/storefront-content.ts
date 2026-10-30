// The banners a merchant shows on the landing page of its storefront: up to 3
// hero slides and up to 2 promo banners. They are kept in the metadata of the
// merchant's sales channel (key "storefront"). No framework imports, so the
// rules can be unit tested on their own.
//
// A banner is an image plus optional text and a link. A link is never a free
// URL: it points at the shop, a category or a product of the same storefront,
// so a banner cannot send shoppers to another site.

export const STOREFRONT_METADATA_KEY = "storefront"

export const MAX_HERO_SLIDES = 3
export const MAX_PROMO_BANNERS = 2

export const MAX_LABEL_LENGTH = 40
export const MAX_TITLE_LENGTH = 60
export const MAX_TEXT_LENGTH = 140
export const MAX_BUTTON_LENGTH = 24
const MAX_IMAGE_URL_LENGTH = 2000
const MAX_HANDLE_LENGTH = 160

export const LINK_TYPES = ["none", "shop", "category", "product"] as const
export type LinkType = (typeof LINK_TYPES)[number]

export type BannerLink = {
  type: LinkType
  handle?: string
}

export type Banner = {
  id: string
  enabled: boolean
  image_url: string
  // Small text above the title: a badge or a collection name
  label: string
  title: string
  text: string
  button_label: string
  link: BannerLink
}

export type StorefrontContent = {
  hero_slides: Banner[]
  promo_banners: Banner[]
}

export type ParseResult =
  | { ok: true; value: StorefrontContent }
  | { ok: false; error: string }

type Section = "hero_slides" | "promo_banners"

const SECTION_NAMES: Record<Section, string> = {
  hero_slides: "Slide",
  promo_banners: "Promo banner",
}

const MAX_ITEMS: Record<Section, number> = {
  hero_slides: MAX_HERO_SLIDES,
  promo_banners: MAX_PROMO_BANNERS,
}

export function emptyContent(): StorefrontContent {
  return { hero_slides: [], promo_banners: [] }
}

// Whitespace is collapsed. Anything that is not text becomes an empty string.
function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

// Only http(s) addresses: no javascript:, data: or file: addresses.
export function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) {
    return false
  }
  if (/\s/.test(value)) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

export function parseLink(input: unknown): BannerLink | null {
  if (input === undefined || input === null) {
    return { type: "none" }
  }
  if (typeof input !== "object") {
    return null
  }

  const raw = input as { type?: unknown; handle?: unknown }
  const type = raw.type === undefined ? "none" : raw.type
  if (typeof type !== "string" || !(LINK_TYPES as readonly string[]).includes(type)) {
    return null
  }

  if (type === "none" || type === "shop") {
    return { type: type as LinkType }
  }

  const handle = typeof raw.handle === "string" ? raw.handle.trim() : ""
  if (handle.length === 0 || handle.length > MAX_HANDLE_LENGTH || !HANDLE_PATTERN.test(handle)) {
    return null
  }
  return { type: type as LinkType, handle }
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function parseId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : newId()
}

const TEXT_LIMITS: Array<[keyof Banner, number, string]> = [
  ["label", MAX_LABEL_LENGTH, "small text"],
  ["title", MAX_TITLE_LENGTH, "title"],
  ["text", MAX_TEXT_LENGTH, "text"],
  ["button_label", MAX_BUTTON_LENGTH, "button text"],
]

function parseBanner(
  input: unknown,
  section: Section,
  index: number
): { banner: Banner } | { error: string } {
  const where = `${SECTION_NAMES[section]} ${index + 1}`

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { error: `${where} is not valid` }
  }
  const raw = input as Record<string, unknown>

  if (!isValidImageUrl(raw.image_url)) {
    return { error: `${where} needs an image` }
  }

  const link = parseLink(raw.link)
  if (!link) {
    return { error: `${where} has a link that is not valid` }
  }

  const banner: Banner = {
    id: parseId(raw.id),
    enabled: raw.enabled === false ? false : true,
    image_url: raw.image_url,
    label: cleanText(raw.label),
    title: cleanText(raw.title),
    text: cleanText(raw.text),
    button_label: cleanText(raw.button_label),
    link,
  }

  for (const [field, max, name] of TEXT_LIMITS) {
    if ((banner[field] as string).length > max) {
      return { error: `${where}: the ${name} is too long (at most ${max} characters)` }
    }
  }

  // A button needs somewhere to go. A link without button text is allowed: the
  // whole banner is then the link.
  if (banner.button_label !== "" && link.type === "none") {
    return { error: `${where}: choose where the button goes, or remove the button text` }
  }

  return { banner }
}

// The content sent by the portal. It has to be complete and valid: a single
// problem refuses everything, so a half saved page is never shown to shoppers.
export function parseStorefrontContent(input: unknown): ParseResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Send the banners as an object" }
  }
  const raw = input as Record<string, unknown>
  const content = emptyContent()

  for (const section of ["hero_slides", "promo_banners"] as Section[]) {
    const list = raw[section] === undefined ? [] : raw[section]
    if (!Array.isArray(list)) {
      return { ok: false, error: `${section} must be a list` }
    }
    if (list.length > MAX_ITEMS[section]) {
      return {
        ok: false,
        error: `At most ${MAX_ITEMS[section]} ${SECTION_NAMES[section].toLowerCase()}s are allowed`,
      }
    }

    for (let i = 0; i < list.length; i++) {
      const parsed = parseBanner(list[i], section, i)
      if ("error" in parsed) {
        return { ok: false, error: parsed.error }
      }
      content[section].push(parsed.banner)
    }
  }

  return { ok: true, value: content }
}

// What is stored in the sales channel metadata. Old or damaged entries are
// dropped instead of failing, so one bad entry never breaks a storefront.
export function readStoredContent(metadata: unknown): StorefrontContent {
  const stored =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)[STOREFRONT_METADATA_KEY]
      : undefined
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return emptyContent()
  }

  const raw = stored as Record<string, unknown>
  const content = emptyContent()

  for (const section of ["hero_slides", "promo_banners"] as Section[]) {
    const list = Array.isArray(raw[section]) ? (raw[section] as unknown[]) : []
    for (let i = 0; i < list.length && content[section].length < MAX_ITEMS[section]; i++) {
      const parsed = parseBanner(list[i], section, i)
      if ("banner" in parsed) {
        content[section].push(parsed.banner)
      }
    }
  }

  return content
}

// What a storefront receives: only the banners that are switched on.
export function toPublicContent(content: StorefrontContent): StorefrontContent {
  return {
    hero_slides: content.hero_slides.filter((b) => b.enabled),
    promo_banners: content.promo_banners.filter((b) => b.enabled),
  }
}

// Metadata to save: everything that was there stays, only "storefront" changes.
export function withStorefrontContent(
  metadata: unknown,
  content: StorefrontContent
): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  return { ...current, [STOREFRONT_METADATA_KEY]: content }
}
