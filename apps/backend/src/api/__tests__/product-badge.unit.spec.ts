import {
  BADGE_METADATA_KEY,
  BADGE_PRESETS,
  MAX_BADGE_LENGTH,
  parseBadge,
  readBadge,
  withBadge,
} from "../product-badge"

describe("parseBadge", () => {
  it("accepts the presets and a short text of the merchant's own", () => {
    for (const preset of BADGE_PRESETS) expect(parseBadge(preset)).toEqual({ ok: true, value: preset })
    expect(parseBadge("-20%")).toEqual({ ok: true, value: "-20%" })
    expect(parseBadge("Eid offer")).toEqual({ ok: true, value: "Eid offer" })
    expect(parseBadge("عرض خاص")).toEqual({ ok: true, value: "عرض خاص" })
  })

  it("means no badge for empty, spaces only, null and undefined", () => {
    for (const none of ["", "   ", "\n\t", null, undefined]) expect(parseBadge(none)).toEqual({ ok: true, value: "" })
  })

  it("tidies spaces and removes control characters", () => {
    expect(parseBadge("  New   arrival ")).toEqual({ ok: true, value: "New arrival" })
    expect(parseBadge("Sa\u0000le\u0007")).toEqual({ ok: true, value: "Sa le" })
  })

  it("accepts exactly the longest and refuses one more", () => {
    expect(MAX_BADGE_LENGTH).toBe(16)
    expect(parseBadge("x".repeat(16)).ok).toBe(true)
    const result: any = parseBadge("x".repeat(17))
    expect(result.ok).toBe(false)
    expect(result.message).toBe("The badge is too long (at most 16 characters)")
  })

  it("counts the length after tidying", () => {
    expect(parseBadge("  " + "x".repeat(16) + "  ").ok).toBe(true)
  })

  it("refuses anything that is not text", () => {
    for (const bad of [5, true, {}, [], ["New"]]) expect(parseBadge(bad).ok).toBe(false)
  })
})

describe("readBadge", () => {
  it("reads the stored badge", () => {
    expect(readBadge({ [BADGE_METADATA_KEY]: "Sale" })).toBe("Sale")
    expect(readBadge({ badge: "  New " })).toBe("New")
  })
  it("is empty without one, or when the entry is damaged", () => {
    for (const bad of [undefined, null, "x", 3, [], {}, { badge: 7 }, { badge: "x".repeat(40) }, { badge: "" }]) {
      expect(readBadge(bad)).toBe("")
    }
  })
})

describe("withBadge", () => {
  it("keeps the rest of the metadata", () => {
    expect(withBadge({ other: 1 }, "New")).toEqual({ other: 1, badge: "New" })
    expect(withBadge(undefined, "New")).toEqual({ badge: "New" })
    expect(withBadge(null, "New")).toEqual({ badge: "New" })
  })
  it("clears with an empty text, not by leaving the key out", () => {
    expect(withBadge({ other: 1, badge: "Sale" }, "")).toEqual({ other: 1, badge: "" })
  })
})
