import {
  MAX_DESCRIPTION_LENGTH,
  MAX_STORE_NAME_LENGTH,
  emptyFooter,
  normalizeSocialUrl,
  parseFooterContent,
  readStoredFooter,
  toPublicFooter,
  withFooter,
} from "../footer-content"

function url(network: "tiktok" | "facebook" | "instagram", input: unknown) {
  const result = normalizeSocialUrl(network, input)
  return result.ok ? result.url : null
}

describe("normalizeSocialUrl", () => {
  it("accepts no link at all", () => {
    expect(normalizeSocialUrl("tiktok", "")).toEqual({ ok: true, url: "" })
    expect(normalizeSocialUrl("tiktok", "   ")).toEqual({ ok: true, url: "" })
    expect(normalizeSocialUrl("tiktok", undefined)).toEqual({ ok: true, url: "" })
    expect(normalizeSocialUrl("tiktok", null)).toEqual({ ok: true, url: "" })
  })

  it("turns an @name into the page address of each network", () => {
    expect(url("tiktok", "@zara.tn")).toBe("https://www.tiktok.com/@zara.tn")
    expect(url("facebook", "@zarashop")).toBe("https://www.facebook.com/zarashop")
    expect(url("instagram", "@zara_shop")).toBe("https://www.instagram.com/zara_shop")
  })

  it("refuses an @name that is not a name", () => {
    for (const bad of ["@", "@a b", "@zara/evil", "@zara?x=1", "@" + "a".repeat(61)]) {
      expect(url("instagram", bad)).toBe(null)
    }
  })

  it("keeps a full https address and adds https when it is missing", () => {
    expect(url("instagram", "https://www.instagram.com/zara")).toBe("https://www.instagram.com/zara")
    expect(url("instagram", "instagram.com/zara")).toBe("https://instagram.com/zara")
    expect(url("facebook", "www.facebook.com/zara")).toBe("https://www.facebook.com/zara")
  })

  it("changes http to https, keeps the query and drops the #fragment", () => {
    expect(url("facebook", "http://facebook.com/profile.php?id=123#top")).toBe(
      "https://facebook.com/profile.php?id=123"
    )
  })

  it("accepts the network's subdomains and short domains", () => {
    expect(url("facebook", "https://m.facebook.com/zara")).toBe("https://m.facebook.com/zara")
    expect(url("facebook", "https://fb.me/zara")).toBe("https://fb.me/zara")
    expect(url("tiktok", "https://vm.tiktok.com/ZMabc/")).toBe("https://vm.tiktok.com/ZMabc/")
    expect(url("instagram", "https://instagr.am/zara")).toBe("https://instagr.am/zara")
  })

  it("refuses another site and look-alike sites", () => {
    for (const bad of [
      "https://example.com/zara",
      "https://evilfacebook.com/zara",
      "https://facebook.com.evil.com/zara",
      "https://notinstagram.com/zara",
      "https://evil.com/?u=facebook.com/zara",
    ]) {
      expect(url("facebook", bad)).toBe(null)
    }
  })

  it("refuses an address of another network", () => {
    expect(url("instagram", "https://www.facebook.com/zara")).toBe(null)
    expect(url("tiktok", "https://www.instagram.com/zara")).toBe(null)
  })

  it("refuses javascript:, data:, mailto: and other schemes", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,hi",
      "mailto:a@b.co",
      "ftp://facebook.com/zara",
      "//facebook.com/zara",
    ]) {
      expect(url("facebook", bad)).toBe(null)
    }
  })

  it("refuses passwords, ports, spaces and very long text", () => {
    expect(url("facebook", "https://user:pw@facebook.com/zara")).toBe(null)
    expect(url("facebook", "https://user@facebook.com/zara")).toBe(null)
    expect(url("facebook", "https://facebook.com:8080/zara")).toBe(null)
    expect(url("facebook", "https://facebook.com/za ra")).toBe(null)
    expect(url("facebook", "https://facebook.com/" + "a".repeat(300))).toBe(null)
  })

  it("refuses the home page of the network and a bare word", () => {
    expect(url("facebook", "https://facebook.com")).toBe(null)
    expect(url("facebook", "https://www.facebook.com/")).toBe(null)
    expect(url("facebook", "zara")).toBe(null)
    expect(url("facebook", 42)).toBe(null)
  })

  it("explains what to paste", () => {
    const result = normalizeSocialUrl("tiktok", "nope")
    expect(result.ok === false && result.error).toContain("TikTok")
    expect(result.ok === false && result.error).toContain("https://www.tiktok.com/@yourstore")
  })
})

describe("parseFooterContent", () => {
  const valid = {
    store_name: "Zara Fashion",
    description: "Clothes for every day.",
    social: {
      tiktok: { url: "@zara", enabled: true },
      facebook: { url: "https://facebook.com/zara", enabled: false },
      instagram: { url: "", enabled: false },
    },
  }

  it("accepts a complete footer and stores clean links", () => {
    const result = parseFooterContent(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.store_name).toBe("Zara Fashion")
      expect(result.value.social.tiktok).toEqual({ url: "https://www.tiktok.com/@zara", enabled: true })
      // a switched off network keeps its link
      expect(result.value.social.facebook).toEqual({ url: "https://facebook.com/zara", enabled: false })
      expect(result.value.social.instagram).toEqual({ url: "", enabled: false })
    }
  })

  it("accepts an empty footer", () => {
    const result = parseFooterContent({})
    expect(result).toEqual({ ok: true, value: emptyFooter() })
  })

  it("collapses whitespace in the name and description", () => {
    const result = parseFooterContent({ store_name: "  Zara \n  Fashion ", description: "a\n\n b   c" })
    expect(result.ok && result.value.store_name).toBe("Zara Fashion")
    expect(result.ok && result.value.description).toBe("a b c")
  })

  it("checks the length limits exactly", () => {
    expect(parseFooterContent({ store_name: "a".repeat(MAX_STORE_NAME_LENGTH) }).ok).toBe(true)
    expect(parseFooterContent({ store_name: "a".repeat(MAX_STORE_NAME_LENGTH + 1) }).ok).toBe(false)
    expect(parseFooterContent({ description: "a".repeat(MAX_DESCRIPTION_LENGTH) }).ok).toBe(true)
    expect(parseFooterContent({ description: "a".repeat(MAX_DESCRIPTION_LENGTH + 1) }).ok).toBe(false)
  })

  it("needs a link for a network that is switched on", () => {
    const result = parseFooterContent({ social: { instagram: { url: "", enabled: true } } })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain("Instagram")
    expect(!result.ok && result.error).toContain("switch it off")
  })

  it("switches a network on only for a real true", () => {
    for (const enabled of ["true", 1, "yes", null, undefined]) {
      const result = parseFooterContent({ social: { tiktok: { url: "@zara", enabled } } })
      expect(result.ok && result.value.social.tiktok.enabled).toBe(false)
    }
  })

  it("refuses a link that is not on the network", () => {
    const result = parseFooterContent({ social: { facebook: { url: "https://evil.com/x", enabled: true } } })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain("Facebook")
  })

  it("refuses wrong shapes", () => {
    expect(parseFooterContent(null).ok).toBe(false)
    expect(parseFooterContent([]).ok).toBe(false)
    expect(parseFooterContent("x").ok).toBe(false)
    expect(parseFooterContent({ social: [] }).ok).toBe(false)
    expect(parseFooterContent({ social: null }).ok).toBe(false)
    expect(parseFooterContent({ social: { tiktok: "@zara" } }).ok).toBe(false)
    expect(parseFooterContent({ social: { tiktok: null } }).ok).toBe(false)
  })

  it("ignores networks it does not know", () => {
    const result = parseFooterContent({ social: { twitter: { url: "https://x.com/zara", enabled: true } } })
    expect(result).toEqual({ ok: true, value: emptyFooter() })
  })

  it("refuses everything when one part is wrong", () => {
    const result = parseFooterContent({
      ...valid,
      social: { ...valid.social, instagram: { url: "javascript:alert(1)", enabled: false } },
    })
    expect(result.ok).toBe(false)
  })
})

describe("readStoredFooter", () => {
  it("gives an empty footer when nothing is stored or it is damaged", () => {
    expect(readStoredFooter(undefined)).toEqual(emptyFooter())
    expect(readStoredFooter(null)).toEqual(emptyFooter())
    expect(readStoredFooter({})).toEqual(emptyFooter())
    expect(readStoredFooter({ footer: "x" })).toEqual(emptyFooter())
    expect(readStoredFooter({ footer: [] })).toEqual(emptyFooter())
  })

  it("keeps the good parts and drops the bad ones", () => {
    const stored = readStoredFooter({
      footer: {
        store_name: "Zara",
        description: "a".repeat(MAX_DESCRIPTION_LENGTH + 1),
        social: {
          tiktok: { url: "https://www.tiktok.com/@zara", enabled: true },
          facebook: { url: "https://evil.com/x", enabled: true },
          instagram: { url: "", enabled: true },
        },
      },
    })
    expect(stored.store_name).toBe("Zara")
    expect(stored.description).toBe("")
    expect(stored.social.tiktok.enabled).toBe(true)
    expect(stored.social.facebook).toEqual({ url: "", enabled: false })
    // switched on without a link counts as off
    expect(stored.social.instagram).toEqual({ url: "", enabled: false })
  })
})

describe("toPublicFooter", () => {
  it("returns only the networks that are on, in a fixed order", () => {
    const footer = emptyFooter()
    footer.social.instagram = { url: "https://www.instagram.com/z", enabled: true }
    footer.social.tiktok = { url: "https://www.tiktok.com/@z", enabled: true }
    footer.social.facebook = { url: "https://www.facebook.com/z", enabled: false }
    expect(toPublicFooter(footer).social_links).toEqual([
      { network: "tiktok", url: "https://www.tiktok.com/@z" },
      { network: "instagram", url: "https://www.instagram.com/z" },
    ])
  })

  it("never returns a network that is on without a link", () => {
    const footer = emptyFooter()
    footer.social.tiktok = { url: "", enabled: true }
    expect(toPublicFooter(footer).social_links).toEqual([])
  })

  it("gives null for empty text and keeps text that is there", () => {
    expect(toPublicFooter(emptyFooter())).toEqual({ store_name: null, description: null, social_links: [] })
    const footer = emptyFooter()
    footer.store_name = "Zara"
    footer.description = "Hello"
    const result = toPublicFooter(footer)
    expect(result.store_name).toBe("Zara")
    expect(result.description).toBe("Hello")
  })
})

describe("withFooter", () => {
  it("changes only the footer key of the metadata", () => {
    const footer = emptyFooter()
    footer.store_name = "Zara"
    const metadata = withFooter({ storefront: { hero_slides: [1] }, other: "x" }, footer)
    expect(metadata.storefront).toEqual({ hero_slides: [1] })
    expect(metadata.other).toBe("x")
    expect((metadata.footer as any).store_name).toBe("Zara")
  })

  it("works when there is no metadata yet", () => {
    expect(Object.keys(withFooter(null, emptyFooter()))).toEqual(["footer"])
    expect(Object.keys(withFooter(undefined, emptyFooter()))).toEqual(["footer"])
  })
})
