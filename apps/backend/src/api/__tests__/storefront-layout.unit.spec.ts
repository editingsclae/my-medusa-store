import {
  LAYOUT_KEY_HASH_KEY,
  hasLayoutKey,
  hashLayoutKey,
  keyFromHeader,
  layoutKeyMatches,
  newLayoutKey,
  parseLayout,
  readStoredLayout,
  withLayout,
  withLayoutKeyHash,
} from "../storefront-layout"
import { DEFAULT_PROMO_BANNERS, MAX_PROMO_BANNERS } from "../storefront-content"

describe("parseLayout", () => {
  it("accepts a whole number of promo banners from 0 up to the highest allowed", () => {
    expect(parseLayout({ promo_banners: 0 })).toEqual({ ok: true, value: { promo_banners: 0 } })
    expect(parseLayout({ promo_banners: 6 })).toEqual({ ok: true, value: { promo_banners: 6 } })
    expect(parseLayout({ promo_banners: 12 }).ok).toBe(true)
    expect(MAX_PROMO_BANNERS).toBe(12)
  })

  it("refuses anything else", () => {
    for (const bad of [-1, 13, 2.5, "3", null, undefined, NaN, Infinity]) {
      expect(parseLayout({ promo_banners: bad }).ok).toBe(false)
    }
    for (const bad of [null, "x", 3, [], {}]) {
      expect(parseLayout(bad).ok).toBe(false)
    }
  })

  it("says how many are allowed", () => {
    const result: any = parseLayout({ promo_banners: 20 })
    expect(result.error).toBe("promo_banners must be a whole number from 0 to 12")
  })
})

describe("readStoredLayout", () => {
  it("is the default until the storefront has declared something", () => {
    expect(readStoredLayout(undefined)).toEqual({ promo_banners: DEFAULT_PROMO_BANNERS })
    expect(readStoredLayout({})).toEqual({ promo_banners: 2 })
    expect(DEFAULT_PROMO_BANNERS).toBe(2)
  })

  it("reads what was declared, with the time", () => {
    const stored = { storefront_layout: { promo_banners: 5, declared_at: "2026-11-07T10:00:00.000Z" } }
    expect(readStoredLayout(stored)).toEqual({ promo_banners: 5, declared_at: "2026-11-07T10:00:00.000Z" })
  })

  it("falls back to the default for a damaged entry", () => {
    for (const bad of ["x", 7, [], { promo_banners: "5" }, { promo_banners: 99 }, { promo_banners: -2 }]) {
      expect(readStoredLayout({ storefront_layout: bad })).toEqual({ promo_banners: 2 })
    }
  })

  it("keeps 0 as a real answer", () => {
    expect(readStoredLayout({ storefront_layout: { promo_banners: 0 } }).promo_banners).toBe(0)
  })
})

describe("saving metadata", () => {
  it("keeps everything else in the metadata", () => {
    const metadata = { storefront: { hero_slides: [] }, other: 1 }
    const saved: any = withLayout(metadata, { promo_banners: 4, declared_at: "t" })
    expect(saved.other).toBe(1)
    expect(saved.storefront).toEqual({ hero_slides: [] })
    expect(saved.storefront_layout).toEqual({ promo_banners: 4, declared_at: "t" })
    const withKey: any = withLayoutKeyHash(saved, "abc")
    expect(withKey.storefront_layout.promo_banners).toBe(4)
    expect(withKey[LAYOUT_KEY_HASH_KEY]).toBe("abc")
  })

  it("starts from nothing when there is no metadata", () => {
    expect(withLayout(null, { promo_banners: 1 })).toEqual({ storefront_layout: { promo_banners: 1 } })
    expect(withLayoutKeyHash(undefined, "h")).toEqual({ [LAYOUT_KEY_HASH_KEY]: "h" })
  })
})

describe("layout keys", () => {
  it("makes a long random key every time", () => {
    const a = newLayoutKey()
    const b = newLayoutKey()
    expect(a).not.toBe(b)
    expect(a.startsWith("lk_")).toBe(true)
    expect(a.length).toBe(3 + 48)
  })

  it("keeps only a hash, and the key matches it", () => {
    const key = newLayoutKey()
    const metadata = withLayoutKeyHash({}, hashLayoutKey(key))
    expect(JSON.stringify(metadata).includes(key)).toBe(false)
    expect(layoutKeyMatches(key, metadata)).toBe(true)
    expect(hasLayoutKey(metadata)).toBe(true)
  })

  it("refuses another key, an old key, and anything that is not a key", () => {
    const key = newLayoutKey()
    const metadata = withLayoutKeyHash({}, hashLayoutKey(key))
    expect(layoutKeyMatches(newLayoutKey(), metadata)).toBe(false)
    expect(layoutKeyMatches(key + "x", metadata)).toBe(false)
    expect(layoutKeyMatches("", metadata)).toBe(false)
    expect(layoutKeyMatches(undefined, metadata)).toBe(false)
    expect(layoutKeyMatches(123, metadata)).toBe(false)
    expect(layoutKeyMatches("x".repeat(500), metadata)).toBe(false)
    // a new key replaces the old one
    const newer = withLayoutKeyHash(metadata, hashLayoutKey("lk_new"))
    expect(layoutKeyMatches(key, newer)).toBe(false)
    expect(layoutKeyMatches("lk_new", newer)).toBe(true)
  })

  it("refuses everything while no key was created", () => {
    expect(hasLayoutKey({})).toBe(false)
    expect(hasLayoutKey(null)).toBe(false)
    expect(layoutKeyMatches("lk_anything", {})).toBe(false)
    expect(layoutKeyMatches("lk_anything", null)).toBe(false)
    expect(layoutKeyMatches("lk_anything", { [LAYOUT_KEY_HASH_KEY]: "" })).toBe(false)
  })

  it("does not accept the hash itself as the key", () => {
    const key = newLayoutKey()
    const hash = hashLayoutKey(key)
    expect(layoutKeyMatches(hash, withLayoutKeyHash({}, hash))).toBe(false)
  })
})

describe("keyFromHeader", () => {
  it("takes the first value of a list and trims it", () => {
    expect(keyFromHeader(" lk_a ")).toBe("lk_a")
    expect(keyFromHeader(["lk_a", "lk_b"])).toBe("lk_a")
    expect(keyFromHeader(undefined)).toBe(undefined)
    expect(keyFromHeader(5)).toBe(undefined)
  })
})
