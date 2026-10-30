import {
  MAX_BUTTON_LENGTH,
  MAX_HERO_SLIDES,
  MAX_LABEL_LENGTH,
  MAX_PROMO_BANNERS,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  emptyContent,
  isValidImageUrl,
  parseLink,
  parseStorefrontContent,
  readStoredContent,
  toPublicContent,
  withStorefrontContent,
} from "../storefront-content"

const IMAGE = "https://files.example.com/static/banner-1.jpg"

function slide(extra: Record<string, unknown> = {}) {
  return { image_url: IMAGE, ...extra }
}

function parse(input: unknown) {
  return parseStorefrontContent(input)
}

describe("isValidImageUrl", () => {
  it("accepts http and https addresses", () => {
    expect(isValidImageUrl("https://files.example.com/a.jpg")).toBe(true)
    expect(isValidImageUrl("http://localhost:9000/static/a.jpg")).toBe(true)
  })

  it("refuses other protocols", () => {
    expect(isValidImageUrl("javascript:alert(1)")).toBe(false)
    expect(isValidImageUrl("data:image/png;base64,AAAA")).toBe(false)
    expect(isValidImageUrl("file:///etc/passwd")).toBe(false)
    expect(isValidImageUrl("ftp://example.com/a.jpg")).toBe(false)
  })

  it("refuses text that is not an address", () => {
    expect(isValidImageUrl("")).toBe(false)
    expect(isValidImageUrl("not a url")).toBe(false)
    expect(isValidImageUrl("/static/a.jpg")).toBe(false)
    expect(isValidImageUrl(undefined)).toBe(false)
    expect(isValidImageUrl(null)).toBe(false)
    expect(isValidImageUrl(5)).toBe(false)
  })

  it("refuses an address with spaces or a very long one", () => {
    expect(isValidImageUrl("https://example.com/a b.jpg")).toBe(false)
    expect(isValidImageUrl("https://example.com/" + "a".repeat(2000))).toBe(false)
  })
})

describe("parseLink", () => {
  it("gives no link when none is sent", () => {
    expect(parseLink(undefined)).toEqual({ type: "none" })
    expect(parseLink(null)).toEqual({ type: "none" })
    expect(parseLink({})).toEqual({ type: "none" })
  })

  it("accepts shop and none without a handle, and drops a handle they do not use", () => {
    expect(parseLink({ type: "shop" })).toEqual({ type: "shop" })
    expect(parseLink({ type: "shop", handle: "shirts" })).toEqual({ type: "shop" })
    expect(parseLink({ type: "none", handle: "x" })).toEqual({ type: "none" })
  })

  it("needs a handle for a category or a product", () => {
    expect(parseLink({ type: "category", handle: "shirts" })).toEqual({
      type: "category",
      handle: "shirts",
    })
    expect(parseLink({ type: "product", handle: " red-shirt " })).toEqual({
      type: "product",
      handle: "red-shirt",
    })
    expect(parseLink({ type: "category" })).toBe(null)
    expect(parseLink({ type: "product", handle: "" })).toBe(null)
  })

  it("accepts handles with the merchant prefix that contains two dashes", () => {
    expect(parseLink({ type: "category", handle: "sc_01abc--electronics" })).toEqual({
      type: "category",
      handle: "sc_01abc--electronics",
    })
  })

  it("refuses handles that could be an address or a path", () => {
    expect(parseLink({ type: "category", handle: "https://evil.com" })).toBe(null)
    expect(parseLink({ type: "category", handle: "../admin" })).toBe(null)
    expect(parseLink({ type: "product", handle: "a/b" })).toBe(null)
    expect(parseLink({ type: "product", handle: "javascript:alert(1)" })).toBe(null)
    expect(parseLink({ type: "product", handle: "a".repeat(161) })).toBe(null)
  })

  it("refuses an unknown type or a link that is not an object", () => {
    expect(parseLink({ type: "url", handle: "x" })).toBe(null)
    expect(parseLink({ type: 5 })).toBe(null)
    expect(parseLink("shop")).toBe(null)
  })
})

describe("parseStorefrontContent", () => {
  it("accepts empty content", () => {
    expect(parse({})).toEqual({ ok: true, value: emptyContent() })
    expect(parse({ hero_slides: [], promo_banners: [] })).toEqual({
      ok: true,
      value: emptyContent(),
    })
  })

  it("accepts a slide with only an image and fills in the rest", () => {
    const result: any = parse({ hero_slides: [slide()] })
    expect(result.ok).toBe(true)
    const banner = result.value.hero_slides[0]
    expect(banner).toMatchObject({
      enabled: true,
      image_url: IMAGE,
      label: "",
      title: "",
      text: "",
      button_label: "",
      link: { type: "none" },
    })
    expect(typeof banner.id).toBe("string")
    expect(banner.id.length).toBeGreaterThan(0)
  })

  it("keeps all the fields of a full banner", () => {
    const result: any = parse({
      hero_slides: [
        slide({
          id: "s1",
          label: "Best prices",
          title: "Upgrade your life",
          text: "Top brands",
          button_label: "Shop now",
          link: { type: "category", handle: "phones" },
          enabled: true,
        }),
      ],
    })
    expect(result.value.hero_slides[0]).toEqual({
      id: "s1",
      enabled: true,
      image_url: IMAGE,
      label: "Best prices",
      title: "Upgrade your life",
      text: "Top brands",
      button_label: "Shop now",
      link: { type: "category", handle: "phones" },
    })
  })

  it("collapses whitespace in the texts", () => {
    const result: any = parse({ hero_slides: [slide({ title: "  Big   sale \n now " })] })
    expect(result.value.hero_slides[0].title).toBe("Big sale now")
  })

  it("keeps a banner that is switched off", () => {
    const result: any = parse({ promo_banners: [slide({ enabled: false })] })
    expect(result.value.promo_banners[0].enabled).toBe(false)
  })

  it("accepts the maximum number of slides and promo banners", () => {
    const slides = Array.from({ length: MAX_HERO_SLIDES }, () => slide())
    const promos = Array.from({ length: MAX_PROMO_BANNERS }, () => slide())
    const result: any = parse({ hero_slides: slides, promo_banners: promos })
    expect(result.ok).toBe(true)
    expect(result.value.hero_slides).toHaveLength(MAX_HERO_SLIDES)
    expect(result.value.promo_banners).toHaveLength(MAX_PROMO_BANNERS)
  })

  it("refuses too many slides or promo banners", () => {
    const slides = Array.from({ length: MAX_HERO_SLIDES + 1 }, () => slide())
    const promos = Array.from({ length: MAX_PROMO_BANNERS + 1 }, () => slide())
    expect(parse({ hero_slides: slides }).ok).toBe(false)
    expect(parse({ promo_banners: promos }).ok).toBe(false)
  })

  it("refuses a banner without an image and says which one", () => {
    const result: any = parse({ hero_slides: [slide(), { title: "No image" }] })
    expect(result.ok).toBe(false)
    expect(result.error).toBe("Slide 2 needs an image")

    const promo: any = parse({ promo_banners: [{ image_url: "javascript:alert(1)" }] })
    expect(promo.error).toBe("Promo banner 1 needs an image")
  })

  it("refuses texts that are too long and names the field", () => {
    const cases: Array<[string, number, string]> = [
      ["label", MAX_LABEL_LENGTH, "small text"],
      ["title", MAX_TITLE_LENGTH, "title"],
      ["text", MAX_TEXT_LENGTH, "text"],
      ["button_label", MAX_BUTTON_LENGTH, "button text"],
    ]
    for (const [field, max, name] of cases) {
      const extra: Record<string, unknown> = { [field]: "x".repeat(max + 1) }
      if (field === "button_label") extra.link = { type: "shop" }
      const result: any = parse({ hero_slides: [slide(extra)] })
      expect(result.ok).toBe(false)
      expect(result.error).toContain(`the ${name} is too long`)

      const exact: Record<string, unknown> = { [field]: "x".repeat(max) }
      if (field === "button_label") exact.link = { type: "shop" }
      expect(parse({ hero_slides: [slide(exact)] }).ok).toBe(true)
    }
  })

  it("refuses a button that goes nowhere", () => {
    const result: any = parse({ hero_slides: [slide({ button_label: "Shop now" })] })
    expect(result.ok).toBe(false)
    expect(result.error).toContain("choose where the button goes")
  })

  it("allows a link without button text", () => {
    const result: any = parse({ hero_slides: [slide({ link: { type: "shop" } })] })
    expect(result.ok).toBe(true)
    expect(result.value.hero_slides[0].link).toEqual({ type: "shop" })
  })

  it("refuses a link that is not valid", () => {
    const result: any = parse({
      hero_slides: [slide({ link: { type: "category", handle: "https://evil.com" } })],
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain("link that is not valid")
  })

  it("refuses input that is not shaped right", () => {
    expect(parse(null).ok).toBe(false)
    expect(parse("banners").ok).toBe(false)
    expect(parse([]).ok).toBe(false)
    expect(parse({ hero_slides: "x" }).ok).toBe(false)
    expect(parse({ hero_slides: [null] }).ok).toBe(false)
    expect(parse({ hero_slides: ["x"] }).ok).toBe(false)
    expect(parse({ hero_slides: [[]] }).ok).toBe(false)
  })

  it("keeps a valid id and replaces an invalid one", () => {
    const result: any = parse({
      hero_slides: [slide({ id: "keep_1" }), slide({ id: "bad id!" }), slide({ id: 5 })],
    })
    expect(result.value.hero_slides[0].id).toBe("keep_1")
    expect(result.value.hero_slides[1].id).not.toBe("bad id!")
    expect(result.value.hero_slides[2].id).not.toBe(5)
    expect(result.value.hero_slides[1].id).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("does not let one section's problem pass because the other is fine", () => {
    const result: any = parse({ hero_slides: [slide()], promo_banners: [{}] })
    expect(result.ok).toBe(false)
  })
})

describe("readStoredContent", () => {
  it("gives empty content when nothing is stored", () => {
    expect(readStoredContent(undefined)).toEqual(emptyContent())
    expect(readStoredContent(null)).toEqual(emptyContent())
    expect(readStoredContent({})).toEqual(emptyContent())
    expect(readStoredContent({ storefront: "x" })).toEqual(emptyContent())
    expect(readStoredContent({ storefront: [] })).toEqual(emptyContent())
  })

  it("reads what was saved", () => {
    const saved: any = parse({
      hero_slides: [slide({ id: "a", title: "One" })],
      promo_banners: [slide({ id: "b", label: "Phones" })],
    })
    const read = readStoredContent({ storefront: saved.value, other: 1 })
    expect(read).toEqual(saved.value)
  })

  it("drops damaged entries instead of failing", () => {
    const read = readStoredContent({
      storefront: {
        hero_slides: [null, { title: "no image" }, slide({ id: "ok" }), "x"],
        promo_banners: "broken",
      },
    })
    expect(read.hero_slides.map((b) => b.id)).toEqual(["ok"])
    expect(read.promo_banners).toEqual([])
  })

  it("never returns more than the maximum", () => {
    const many = Array.from({ length: 10 }, (_, i) => slide({ id: `s${i}` }))
    const read = readStoredContent({ storefront: { hero_slides: many, promo_banners: many } })
    expect(read.hero_slides).toHaveLength(MAX_HERO_SLIDES)
    expect(read.promo_banners).toHaveLength(MAX_PROMO_BANNERS)
  })
})

describe("toPublicContent", () => {
  it("leaves out banners that are switched off", () => {
    const saved: any = parse({
      hero_slides: [slide({ id: "a" }), slide({ id: "b", enabled: false })],
      promo_banners: [slide({ id: "c", enabled: false })],
    })
    const pub = toPublicContent(saved.value)
    expect(pub.hero_slides.map((b) => b.id)).toEqual(["a"])
    expect(pub.promo_banners).toEqual([])
  })
})

describe("withStorefrontContent", () => {
  it("keeps the other metadata and replaces only the storefront key", () => {
    const content = emptyContent()
    expect(withStorefrontContent({ other: 1, storefront: { old: true } }, content)).toEqual({
      other: 1,
      storefront: content,
    })
  })

  it("works when there is no metadata yet", () => {
    const content = emptyContent()
    expect(withStorefrontContent(undefined, content)).toEqual({ storefront: content })
    expect(withStorefrontContent(null, content)).toEqual({ storefront: content })
    expect(withStorefrontContent("x", content)).toEqual({ storefront: content })
  })
})
