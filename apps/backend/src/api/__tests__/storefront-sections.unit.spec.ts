import {
  BEST_SELLERS_DAYS,
  MAX_SECTION_PRODUCTS,
  SECTIONS_METADATA_KEY,
  TRENDING_DAYS,
  buildSections,
  defaultSettings,
  parseSectionDeclarations,
  parseSettings,
  rankBySales,
  readStoredDeclarations,
  readStoredSettings,
  withSettings,
  type SalesLine,
  type SectionDeclaration,
} from "../storefront-sections"
import { parseLayout, readStoredLayout } from "../storefront-layout"

const NOW = Date.parse("2026-11-07T12:00:00.000Z")
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()
const sale = (product_id: string, quantity: number, days: number): SalesLine => ({
  product_id,
  quantity,
  created_at: daysAgo(days),
})

describe("parseSectionDeclarations", () => {
  it("accepts the four sections in the storefront's order", () => {
    const input = [
      { key: "new_arrivals", count: 8 },
      { key: "best_sellers", count: 4 },
      { key: "trending", count: 4 },
      { key: "featured", count: 4 },
    ]
    expect(parseSectionDeclarations(input)).toEqual({ ok: true, value: input })
    expect(parseSectionDeclarations([])).toEqual({ ok: true, value: [] })
  })

  it("refuses an unknown key, a repeated key and a bad count", () => {
    expect(parseSectionDeclarations([{ key: "sale", count: 4 }]).ok).toBe(false)
    expect(parseSectionDeclarations([{ key: "trending", count: 4 }, { key: "trending", count: 4 }]).ok).toBe(false)
    for (const bad of [0, -1, 2.5, "4", null, undefined, MAX_SECTION_PRODUCTS + 1]) {
      expect(parseSectionDeclarations([{ key: "featured", count: bad }]).ok).toBe(false)
    }
    for (const bad of ["x", {}, null, 4]) {
      expect(parseSectionDeclarations(bad).ok).toBe(false)
    }
    expect(parseSectionDeclarations(["featured"]).ok).toBe(false)
  })

  it("refuses more sections than there are kinds", () => {
    const five = ["new_arrivals", "best_sellers", "trending", "featured", "new_arrivals"].map((key) => ({ key, count: 4 }))
    expect(parseSectionDeclarations(five).ok).toBe(false)
  })
})

describe("readStoredDeclarations", () => {
  it("keeps the good entries of a damaged list", () => {
    const stored = [{ key: "featured", count: 4 }, { key: "nope", count: 2 }, { key: "trending", count: 0 }, { key: "featured", count: 6 }]
    expect(readStoredDeclarations(stored)).toEqual([{ key: "featured", count: 4 }])
  })
  it("is empty for anything that is not a list", () => {
    for (const bad of [undefined, null, "x", 3, {}]) expect(readStoredDeclarations(bad)).toEqual([])
  })
})

describe("the layout carries the sections", () => {
  it("parseLayout keeps the old shape when no sections are sent", () => {
    expect(parseLayout({ promo_banners: 2 })).toEqual({ ok: true, value: { promo_banners: 2 } })
  })
  it("parseLayout returns valid sections and refuses bad ones", () => {
    const sections = [{ key: "new_arrivals", count: 8 }]
    expect(parseLayout({ promo_banners: 2, sections })).toEqual({ ok: true, value: { promo_banners: 2, sections } })
    expect(parseLayout({ promo_banners: 2, sections: [{ key: "x", count: 1 }] }).ok).toBe(false)
  })
  it("readStoredLayout reads them, and has none until declared", () => {
    const sections = [{ key: "featured", count: 4 }]
    expect(readStoredLayout({ storefront_layout: { promo_banners: 2, sections } }).sections).toEqual(sections)
    expect(readStoredLayout({ storefront_layout: { promo_banners: 2 } })).toEqual({ promo_banners: 2 })
  })
})

describe("rankBySales", () => {
  it("puts the most units first and adds up a product's lines", () => {
    const lines = [sale("a", 1, 1), sale("b", 2, 1), sale("a", 2, 2), sale("c", 1, 3)]
    expect(rankBySales(lines, { now: NOW })).toEqual(["a", "b", "c"])
  })

  it("counts only what is inside the window", () => {
    const lines = [sale("old", 10, 20), sale("new", 1, 2)]
    expect(rankBySales(lines, { now: NOW, days: TRENDING_DAYS })).toEqual(["new"])
    expect(rankBySales(lines, { now: NOW })).toEqual(["old", "new"])
  })

  it("breaks a tie with the more recent sale, then by id", () => {
    expect(rankBySales([sale("a", 1, 5), sale("b", 1, 1)], { now: NOW })).toEqual(["b", "a"])
    expect(rankBySales([sale("b", 1, 1), sale("a", 1, 1)], { now: NOW })).toEqual(["a", "b"])
  })

  it("ignores products that are not allowed, empty ids, zero units and sales in the future", () => {
    const lines = [sale("a", 1, 1), sale("gone", 5, 1), sale("", 5, 1), sale("z", 0, 1), sale("f", 5, -2)]
    expect(rankBySales(lines, { now: NOW, allowed: new Set(["a", "z", "f"]) })).toEqual(["a"])
  })

  it("ignores a line with a broken date or a broken quantity", () => {
    const lines: SalesLine[] = [
      { product_id: "a", quantity: 1, created_at: "not a date" },
      { product_id: "b", quantity: Number.NaN, created_at: daysAgo(1) },
      sale("c", 1, 1),
    ]
    expect(rankBySales(lines, { now: NOW })).toEqual(["c"])
  })
})

describe("settings", () => {
  it("are all on with the usual titles until the merchant changes something", () => {
    const settings = readStoredSettings(undefined)
    expect(settings).toEqual(defaultSettings())
    expect(settings.sections.best_sellers).toEqual({ enabled: true, title: "Best Sellers" })
    expect(settings.featured_ids).toEqual([])
  })

  it("read what was saved and repair a damaged entry", () => {
    const stored = {
      [SECTIONS_METADATA_KEY]: {
        sections: { trending: { enabled: false, title: "  Hot   now " }, featured: "x", best_sellers: { enabled: "no", title: 5 } },
        featured_ids: ["p1", "p1", 7, "", "p2"],
      },
    }
    const settings = readStoredSettings(stored)
    expect(settings.sections.trending).toEqual({ enabled: false, title: "Hot now" })
    expect(settings.sections.featured).toEqual({ enabled: true, title: "Featured Products" })
    expect(settings.sections.best_sellers).toEqual({ enabled: true, title: "Best Sellers" })
    expect(settings.featured_ids).toEqual(["p1", "p2"])
  })

  it("withSettings keeps the rest of the metadata", () => {
    const saved: any = withSettings({ other: 1 }, defaultSettings())
    expect(saved.other).toBe(1)
    expect(saved[SECTIONS_METADATA_KEY].featured_ids).toEqual([])
  })
})

describe("parseSettings", () => {
  it("accepts a title, a switch and featured products within the room", () => {
    const result: any = parseSettings(
      { sections: { trending: { enabled: false, title: "Hot" } }, featured_ids: ["a", "b"] },
      4
    )
    expect(result.ok).toBe(true)
    expect(result.value.sections.trending).toEqual({ enabled: false, title: "Hot" })
    expect(result.value.sections.featured.enabled).toBe(true)
    expect(result.value.featured_ids).toEqual(["a", "b"])
  })

  it("an empty title goes back to the usual one", () => {
    const result: any = parseSettings({ sections: { featured: { title: "   " } } }, 4)
    expect(result.value.sections.featured.title).toBe("Featured Products")
  })

  it("keeps what the request leaves out", () => {
    const current = readStoredSettings({
      [SECTIONS_METADATA_KEY]: { sections: { trending: { enabled: false, title: "Hot" } }, featured_ids: ["a"] },
    })
    const result: any = parseSettings({ sections: { featured: { enabled: false } } }, 4, current)
    expect(result.value.sections.trending).toEqual({ enabled: false, title: "Hot" })
    expect(result.value.featured_ids).toEqual(["a"])
    expect(result.value.sections.featured.enabled).toBe(false)
  })

  it("refuses more featured products than the storefront has room for, and says how many to remove", () => {
    const result: any = parseSettings({ featured_ids: ["a", "b", "c"] }, 2)
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Your storefront has room for 2 featured products. Remove 1 to be able to save.")
    expect((parseSettings({ featured_ids: ["a", "b"] }, 1) as any).error).toBe(
      "Your storefront has room for 1 featured product. Remove 1 to be able to save."
    )
    expect((parseSettings({ featured_ids: ["a"] }, 0) as any).error).toBe("Your storefront has no place for Featured Products")
  })

  it("does not stop other changes when the stored featured list is over the room", () => {
    const current = { ...defaultSettings(), featured_ids: ["a", "b", "c"] }
    expect(parseSettings({ sections: { trending: { enabled: false } } }, 1, current).ok).toBe(true)
  })

  it("refuses anything malformed", () => {
    for (const bad of [null, "x", 3, []]) expect(parseSettings(bad, 4).ok).toBe(false)
    expect(parseSettings({ sections: { sale: { enabled: true } } }, 4).ok).toBe(false)
    expect(parseSettings({ sections: { featured: "on" } }, 4).ok).toBe(false)
    expect(parseSettings({ sections: { featured: { enabled: "yes" } } }, 4).ok).toBe(false)
    expect(parseSettings({ sections: { featured: { title: 5 } } }, 4).ok).toBe(false)
    expect(parseSettings({ sections: { featured: { title: "x".repeat(41) } } }, 4).ok).toBe(false)
    expect(parseSettings({ featured_ids: "a" }, 4).ok).toBe(false)
    expect(parseSettings({ featured_ids: ["a", 3] }, 4).ok).toBe(false)
    expect(parseSettings({ featured_ids: [""] }, 4).ok).toBe(false)
  })
})

describe("buildSections", () => {
  const declared: SectionDeclaration[] = [
    { key: "new_arrivals", count: 3 },
    { key: "best_sellers", count: 3 },
    { key: "trending", count: 3 },
    { key: "featured", count: 2 },
  ]
  const newest = ["p1", "p2", "p3", "p4", "p5"]
  const sales: SalesLine[] = [
    sale("p5", 5, 100), // only in all orders
    sale("p4", 1, 30),
    sale("p3", 2, 30),
    sale("p2", 3, 30),
    sale("p1", 1, 3),
    sale("p2", 1, 2),
    sale("p3", 1, 1),
  ]
  const base = { declared, settings: defaultSettings(), newest, sales, now: NOW }
  const byKey = (sections: ReturnType<typeof buildSections>, key: string) => sections.find((s) => s.key === key)

  it("follows the storefront's order and trims each section to its count", () => {
    const sections = buildSections({ ...base, settings: { ...defaultSettings(), featured_ids: ["p4", "p1", "p2"] } })
    expect(sections.map((s) => s.key)).toEqual(["new_arrivals", "best_sellers", "trending", "featured"])
    expect(byKey(sections, "new_arrivals")!.product_ids).toEqual(["p1", "p2", "p3"])
    expect(byKey(sections, "featured")!.product_ids).toEqual(["p4", "p1"])
  })

  it("ranks Best Sellers over the last 90 days", () => {
    const sections = buildSections(base)
    // p2: 4, p3: 3, p4: 1 and p1: 1 inside 90 days; p5 sold only long ago
    expect(byKey(sections, "best_sellers")!.product_ids).toEqual(["p2", "p3", "p1"])
    expect(BEST_SELLERS_DAYS).toBe(90)
  })

  it("ranks Best Sellers over all orders when the last 90 days have too few products", () => {
    const few = [sale("p5", 5, 100), sale("p4", 3, 100), sale("p3", 2, 100), sale("p2", 1, 10)]
    const sections = buildSections({ ...base, sales: few })
    expect(byKey(sections, "best_sellers")!.product_ids).toEqual(["p5", "p4", "p3"])
  })

  it("ranks Trending Now over the last 14 days only", () => {
    // p1, p2 and p3 each sold 1 unit in the last 14 days; the latest sale comes first
    expect(byKey(buildSections(base), "trending")!.product_ids).toEqual(["p3", "p2", "p1"])
    const busy = [sale("p1", 3, 1), sale("p2", 2, 2), sale("p3", 1, 3), sale("p4", 9, 40)]
    expect(byKey(buildSections({ ...base, sales: busy }), "trending")!.product_ids).toEqual(["p1", "p2", "p3"])
    expect(TRENDING_DAYS).toBe(14)
  })

  it("leaves out a ranked section with too few products, but not when the storefront has less room", () => {
    const two = [sale("p1", 3, 1), sale("p2", 2, 2)]
    expect(byKey(buildSections({ ...base, sales: two }), "trending")).toBe(undefined)
    const small = buildSections({ ...base, declared: [{ key: "trending", count: 2 }], sales: two })
    expect(small.map((s) => s.key)).toEqual(["trending"])
  })

  it("leaves out Featured when nothing is chosen, and drops products that are not for sale", () => {
    expect(byKey(buildSections(base), "featured")).toBe(undefined)
    const sections = buildSections({ ...base, settings: { ...defaultSettings(), featured_ids: ["deleted", "p3"] } })
    expect(byKey(sections, "featured")!.product_ids).toEqual(["p3"])
  })

  it("leaves out a section the merchant switched off and uses the merchant's title", () => {
    const settings = defaultSettings()
    settings.sections.new_arrivals = { enabled: false, title: "New Arrivals" }
    settings.sections.best_sellers = { enabled: true, title: "Top picks" }
    const sections = buildSections({ ...base, settings })
    expect(byKey(sections, "new_arrivals")).toBe(undefined)
    expect(byKey(sections, "best_sellers")!.title).toBe("Top picks")
  })

  it("never shows a product that is no longer for sale in a ranked section", () => {
    const sections = buildSections({ ...base, newest: ["p1", "p3", "p4"] })
    for (const section of sections) expect(section.product_ids.includes("p2")).toBe(false)
  })

  it("shows only the sections the storefront declared", () => {
    const sections = buildSections({ ...base, declared: [{ key: "new_arrivals", count: 2 }] })
    expect(sections).toEqual([{ key: "new_arrivals", title: "New Arrivals", product_ids: ["p1", "p2"] }])
    expect(buildSections({ ...base, declared: [] })).toEqual([])
  })

  it("is empty for a store without products", () => {
    expect(buildSections({ ...base, newest: [], sales: [] })).toEqual([])
  })
})
