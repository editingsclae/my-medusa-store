// What a merchant shows in the footer of its storefront: a store name, a short
// description and links to TikTok, Facebook and Instagram, each of which can be
// switched on or off. Kept in the metadata of the merchant's sales channel (key
// "footer"). No framework imports, so the rules can be unit tested on their own.
//
// It also holds the "Shop" column of the footer (up to 5 of the merchant's
// categories, in the merchant's order) and the text of five support pages
// (contact, shipping, returns, privacy, terms), plain text with paragraphs.
// A support page with no text is not offered to shoppers.
//
// A social link is never a free URL: it has to be on the network's own site, so
// a footer cannot send shoppers to another site. A merchant may also type just
// "@name".

export const FOOTER_METADATA_KEY = "footer"

export const NETWORKS = ["tiktok", "facebook", "instagram"] as const
export type Network = (typeof NETWORKS)[number]

export const NETWORK_NAMES: Record<Network, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
}

export const MAX_STORE_NAME_LENGTH = 60
export const MAX_DESCRIPTION_LENGTH = 200
export const MAX_SOCIAL_URL_LENGTH = 300
export const MAX_SHOP_CATEGORIES = 5
export const MAX_PAGE_LENGTH = 10000

export const PAGE_KEYS = ["contact", "shipping", "returns", "privacy", "terms"] as const
export type PageKey = (typeof PAGE_KEYS)[number]

export const PAGE_TITLES: Record<PageKey, string> = {
  contact: "Contact Us",
  shipping: "Shipping",
  returns: "Returns",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
}

const CATEGORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

// The sites a link may point to (the site itself and its subdomains: www, m...)
const NETWORK_DOMAINS: Record<Network, string[]> = {
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
  instagram: ["instagram.com", "instagr.am"],
}

const EXAMPLES: Record<Network, string> = {
  tiktok: "https://www.tiktok.com/@yourstore",
  facebook: "https://www.facebook.com/yourstore",
  instagram: "https://www.instagram.com/yourstore",
}

export type SocialLink = {
  // A full https link on the network's site, or "" when there is none
  url: string
  enabled: boolean
}

export type FooterContent = {
  // Empty means the storefront uses its own name
  store_name: string
  // Empty means the storefront uses its own line
  description: string
  social: Record<Network, SocialLink>
  // Up to MAX_SHOP_CATEGORIES category ids, in the order the merchant chose
  shop_category_ids: string[]
  // Plain text, paragraphs separated by a blank line. Empty means no page.
  pages: Record<PageKey, string>
}

// A category of the "Shop" column: handle is the public category handle, so a
// storefront links to /c/<handle>.
export type PublicShopCategory = { id: string; name: string; handle: string }

// What a storefront receives: only the networks that are switched on and have a
// link, in the order of NETWORKS. Empty text comes as null. `pages` lists only
// the support pages that have text, in the order of PAGE_KEYS; the text itself
// is read with publicPage.
export type PublicFooter = {
  store_name: string | null
  description: string | null
  social_links: Array<{ network: Network; url: string }>
  shop_categories: PublicShopCategory[]
  pages: Array<{ slug: PageKey; title: string }>
}

export type PublicPage = { slug: PageKey; title: string; text: string }

export type ParseResult =
  | { ok: true; value: FooterContent }
  | { ok: false; error: string }

export function emptyFooter(): FooterContent {
  return {
    store_name: "",
    description: "",
    social: {
      tiktok: { url: "", enabled: false },
      facebook: { url: "", enabled: false },
      instagram: { url: "", enabled: false },
    },
    shop_category_ids: [],
    pages: { contact: "", shipping: "", returns: "", privacy: "", terms: "" },
  }
}

// Whitespace is collapsed. Anything that is not text becomes an empty string.
function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

// Page text keeps its line breaks. Control characters and trailing spaces go,
// and more than one blank line in a row becomes one.
function cleanPageText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,60}$/

function profileUrl(network: Network, handle: string): string {
  switch (network) {
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`
    case "facebook":
      return `https://www.facebook.com/${handle}`
    default:
      return `https://www.instagram.com/${handle}`
  }
}

function hostIsOn(hostname: string, domains: string[]): boolean {
  const host = hostname.toLowerCase()
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

export type UrlResult = { ok: true; url: string } | { ok: false; error: string }

// A link as typed: "" (no link), "@name", "instagram.com/name" or a full address.
// The result is a clean https address on the network's own site: no password,
// port or #fragment, and never javascript:, data: or another site.
export function normalizeSocialUrl(network: Network, input: unknown): UrlResult {
  const fail: UrlResult = {
    ok: false,
    error: `${NETWORK_NAMES[network]}: paste the link of your page (for example ${EXAMPLES[network]}) or your @name`,
  }

  if (input === undefined || input === null) {
    return { ok: true, url: "" }
  }
  if (typeof input !== "string") {
    return fail
  }
  const text = input.trim()
  if (text === "") {
    return { ok: true, url: "" }
  }
  // A leading "/" would be a path or a protocol relative address, not a page name
  if (/\s/.test(text) || text.length > MAX_SOCIAL_URL_LENGTH || text.startsWith("/")) {
    return fail
  }

  if (text.startsWith("@")) {
    const handle = text.slice(1)
    return HANDLE_PATTERN.test(handle) ? { ok: true, url: profileUrl(network, handle) } : fail
  }

  let candidate = text
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (!/^https?:\/\//i.test(candidate)) {
      return fail
    }
  } else {
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return fail
  }

  if (url.username !== "" || url.password !== "" || url.port !== "") {
    return fail
  }
  if (!hostIsOn(url.hostname, NETWORK_DOMAINS[network])) {
    return fail
  }
  // The home page of the network is not a page of the store
  if (url.pathname.length <= 1) {
    return fail
  }

  return { ok: true, url: `https://${url.host}${url.pathname}${url.search}` }
}

// The footer sent by the portal. It has to be complete and valid: a single
// problem refuses everything, so a half saved footer is never shown to shoppers.
//
// `current` is what is stored. A part that is left out of `input` (the shop
// categories, the pages) stays as it is, so a portal page that was opened before
// those parts existed does not erase them.
export function parseFooterContent(
  input: unknown,
  current: FooterContent = emptyFooter()
): ParseResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Send the footer as an object" }
  }
  const raw = input as Record<string, unknown>

  const store_name = cleanText(raw.store_name)
  if (store_name.length > MAX_STORE_NAME_LENGTH) {
    return {
      ok: false,
      error: `The store name is too long (at most ${MAX_STORE_NAME_LENGTH} characters)`,
    }
  }

  const description = cleanText(raw.description)
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `The description is too long (at most ${MAX_DESCRIPTION_LENGTH} characters)`,
    }
  }

  const social = raw.social === undefined ? {} : raw.social
  if (social === null || typeof social !== "object" || Array.isArray(social)) {
    return { ok: false, error: "social must be an object" }
  }

  const value: FooterContent = {
    store_name,
    description,
    social: emptyFooter().social,
    shop_category_ids: current.shop_category_ids,
    pages: current.pages,
  }

  if (raw.shop_category_ids !== undefined) {
    const ids = raw.shop_category_ids
    if (!Array.isArray(ids)) {
      return { ok: false, error: "shop_category_ids must be a list" }
    }
    if (ids.length > MAX_SHOP_CATEGORIES) {
      return {
        ok: false,
        error: `Pick at most ${MAX_SHOP_CATEGORIES} categories for the Shop column`,
      }
    }
    for (const id of ids) {
      if (typeof id !== "string" || !CATEGORY_ID_PATTERN.test(id)) {
        return { ok: false, error: "A category of the Shop column is not valid" }
      }
    }
    if (new Set(ids).size !== ids.length) {
      return { ok: false, error: "A category can be in the Shop column only once" }
    }
    value.shop_category_ids = [...(ids as string[])]
  }

  if (raw.pages !== undefined) {
    const pages = raw.pages
    if (pages === null || typeof pages !== "object" || Array.isArray(pages)) {
      return { ok: false, error: "pages must be an object" }
    }
    value.pages = { ...current.pages }
    for (const key of PAGE_KEYS) {
      const text = (pages as Record<string, unknown>)[key]
      if (text === undefined) {
        continue
      }
      if (typeof text !== "string") {
        return { ok: false, error: `${PAGE_TITLES[key]}: send the text of the page` }
      }
      const cleaned = cleanPageText(text)
      if (cleaned.length > MAX_PAGE_LENGTH) {
        return {
          ok: false,
          error: `${PAGE_TITLES[key]} is too long (at most ${MAX_PAGE_LENGTH} characters)`,
        }
      }
      value.pages[key] = cleaned
    }
  }

  for (const network of NETWORKS) {
    const entry = (social as Record<string, unknown>)[network]
    if (entry === undefined) {
      continue
    }
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: `${NETWORK_NAMES[network]} is not valid` }
    }
    const rawEntry = entry as { url?: unknown; enabled?: unknown }

    const parsed = normalizeSocialUrl(network, rawEntry.url)
    if (!parsed.ok) {
      return { ok: false, error: parsed.error }
    }

    // Only an explicit true switches a network on
    const enabled = rawEntry.enabled === true
    if (enabled && parsed.url === "") {
      return {
        ok: false,
        error: `${NETWORK_NAMES[network]}: add the link, or switch it off`,
      }
    }
    value.social[network] = { url: parsed.url, enabled }
  }

  return { ok: true, value }
}

// What is stored in the sales channel metadata. Old or damaged parts are dropped
// instead of failing, so one bad entry never breaks a storefront.
export function readStoredFooter(metadata: unknown): FooterContent {
  const stored =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)[FOOTER_METADATA_KEY]
      : undefined
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return emptyFooter()
  }

  const raw = stored as Record<string, unknown>
  const content = emptyFooter()

  const name = cleanText(raw.store_name)
  content.store_name = name.length <= MAX_STORE_NAME_LENGTH ? name : ""
  const description = cleanText(raw.description)
  content.description = description.length <= MAX_DESCRIPTION_LENGTH ? description : ""

  const social =
    raw.social && typeof raw.social === "object" && !Array.isArray(raw.social)
      ? (raw.social as Record<string, unknown>)
      : {}
  for (const network of NETWORKS) {
    const entry = social[network]
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue
    }
    const rawEntry = entry as { url?: unknown; enabled?: unknown }
    const parsed = normalizeSocialUrl(network, rawEntry.url)
    if (parsed.ok) {
      content.social[network] = {
        url: parsed.url,
        enabled: rawEntry.enabled === true && parsed.url !== "",
      }
    }
  }

  if (Array.isArray(raw.shop_category_ids)) {
    const seen = new Set<string>()
    for (const id of raw.shop_category_ids) {
      if (
        typeof id === "string" &&
        CATEGORY_ID_PATTERN.test(id) &&
        !seen.has(id) &&
        seen.size < MAX_SHOP_CATEGORIES
      ) {
        seen.add(id)
      }
    }
    content.shop_category_ids = [...seen]
  }

  const pages =
    raw.pages && typeof raw.pages === "object" && !Array.isArray(raw.pages)
      ? (raw.pages as Record<string, unknown>)
      : {}
  for (const key of PAGE_KEYS) {
    const text = pages[key]
    if (typeof text === "string") {
      const cleaned = cleanPageText(text)
      content.pages[key] = cleaned.length <= MAX_PAGE_LENGTH ? cleaned : ""
    }
  }
  return content
}

// The shop categories a storefront may show: only those that are still one of
// the merchant's public categories (active, not internal). One that was deleted
// or switched off is left out. Order is the merchant's order.
export function publicShopCategories(
  ids: string[],
  categories: Array<{ id: string; name: string; handle: string }>
): PublicShopCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const result: PublicShopCategory[] = []
  for (const id of ids) {
    const category = byId.get(id)
    if (category) {
      result.push({ id: category.id, name: category.name, handle: category.handle })
    }
  }
  return result
}

// One support page with its text, or null when the slug is not a page or the
// merchant has not written it.
export function publicPage(content: FooterContent, slug: string): PublicPage | null {
  const key = PAGE_KEYS.find((candidate) => candidate === slug)
  if (!key || content.pages[key] === "") {
    return null
  }
  return { slug: key, title: PAGE_TITLES[key], text: content.pages[key] }
}

export function toPublicFooter(
  content: FooterContent,
  visibleCategories: Array<{ id: string; name: string; handle: string }> = []
): PublicFooter {
  return {
    store_name: content.store_name === "" ? null : content.store_name,
    description: content.description === "" ? null : content.description,
    social_links: NETWORKS.filter(
      (network) => content.social[network].enabled && content.social[network].url !== ""
    ).map((network) => ({ network, url: content.social[network].url })),
    shop_categories: publicShopCategories(content.shop_category_ids, visibleCategories),
    pages: PAGE_KEYS.filter((key) => content.pages[key] !== "").map((key) => ({
      slug: key,
      title: PAGE_TITLES[key],
    })),
  }
}

// Metadata to save: everything that was there stays, only "footer" changes.
export function withFooter(metadata: unknown, content: FooterContent): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  return { ...current, [FOOTER_METADATA_KEY]: content }
}
