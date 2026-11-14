import {
  discountDescription,
  discountStatus,
  findBlockedProducts,
  parseDiscountInput,
  pickBasePrice,
  readDiscountMetadata,
  salePrice,
  toDiscountMetadata,
  windowsOverlap,
  withoutSalePrices,
} from "../admin/merchant/discount-rules"

const NOW = new Date("2026-11-14T10:00:00Z")

function ok(body: unknown) {
  const parsed = parseDiscountInput(body, NOW)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

function error(body: unknown): string {
  const parsed = parseDiscountInput(body, NOW)
  if (parsed.ok) throw new Error("expected an error")
  return parsed.error
}

describe("parseDiscountInput", () => {
  it("accepts a percentage and products, with no dates", () => {
    const value = ok({ percent: 20, product_ids: ["prod_1", "prod_2"] })
    expect(value.percent).toBe(20)
    expect(value.productIds).toEqual(["prod_1", "prod_2"])
    expect(value.startsAt).toBeNull()
    expect(value.endsAt).toBeNull()
    expect(value.title).toBe("20% off")
  })

  it("takes the percentage as text too and removes repeated products", () => {
    const value = ok({ percent: "10", product_ids: ["a", "a", "b"] })
    expect(value.percent).toBe(10)
    expect(value.productIds).toEqual(["a", "b"])
  })

  it("refuses a percentage that is not a whole number from 1 to 90", () => {
    for (const percent of [0, -5, 91, 100, 12.5, "abc", "", null, undefined, NaN]) {
      expect(error({ percent, product_ids: ["a"] })).toContain("whole percentage from 1 to 90")
    }
  })

  it("needs at least one product and at most 100", () => {
    expect(error({ percent: 10, product_ids: [] })).toBe("Choose at least one product.")
    expect(error({ percent: 10 })).toBe("Choose at least one product.")
    expect(error({ percent: 10, product_ids: ["a", 5] })).toBe("Choose at least one product.")
    const many = Array.from({ length: 101 }, (_, i) => `p${i}`)
    expect(error({ percent: 10, product_ids: many })).toContain("at most 100")
  })

  it("reads a date as the first and the last moment of that day in Tunis", () => {
    const value = ok({ percent: 10, product_ids: ["a"], starts_at: "2026-11-20", ends_at: "2026-11-30" })
    expect(value.startsAt?.toISOString()).toBe("2026-11-19T23:00:00.000Z")
    expect(value.endsAt?.toISOString()).toBe("2026-11-30T22:59:59.999Z")
  })

  it("refuses bad dates, an end in the past and an end before the start", () => {
    expect(error({ percent: 10, product_ids: ["a"], starts_at: "tomorrow" })).toContain("start date")
    expect(error({ percent: 10, product_ids: ["a"], ends_at: 5 })).toContain("end date")
    expect(error({ percent: 10, product_ids: ["a"], ends_at: "2026-11-01" })).toBe("The end date must be in the future.")
    expect(error({ percent: 10, product_ids: ["a"], starts_at: "2026-12-10", ends_at: "2026-12-01" })).toBe(
      "The end date must be after the start date."
    )
  })

  it("treats empty dates as no date", () => {
    const value = ok({ percent: 10, product_ids: ["a"], starts_at: "", ends_at: null })
    expect(value.startsAt).toBeNull()
    expect(value.endsAt).toBeNull()
  })

  it("keeps a name of its own and refuses a very long one", () => {
    expect(ok({ percent: 10, product_ids: ["a"], title: "  Black Friday " }).title).toBe("Black Friday")
    expect(error({ percent: 10, product_ids: ["a"], title: "x".repeat(61) })).toContain("at most 60")
  })

  it("never breaks on a body that is not an object", () => {
    for (const body of [null, undefined, "x", 5, []]) {
      expect(error(body)).toContain("percentage")
    }
  })
})

describe("salePrice", () => {
  it("takes the percentage off and rounds to two decimals", () => {
    expect(salePrice(100, 10)).toBe(90)
    expect(salePrice(100, 20)).toBe(80)
    expect(salePrice(99.99, 20)).toBe(79.99)
    expect(salePrice(19.9, 15)).toBe(16.92)
    expect(salePrice("50", 50)).toBe(25)
  })

  it("gives nothing for a price that cannot be discounted", () => {
    for (const base of [0, -1, "abc", null, undefined, NaN]) {
      expect(salePrice(base, 10)).toBeNull()
    }
    // A price so small that the discount rounds away
    expect(salePrice(0.01, 10)).toBeNull()
  })
})

describe("pickBasePrice", () => {
  it("picks the normal price in the currency and ignores sale prices", () => {
    const prices = [
      { amount: 80, currency_code: "tnd", price_list_id: "plist_1" },
      { amount: 100, currency_code: "TND", price_list_id: null },
      { amount: 30, currency_code: "eur" },
    ]
    expect(pickBasePrice(prices, "tnd")).toBe(100)
    expect(pickBasePrice(prices, "EUR")).toBe(30)
  })

  it("ignores prices that only apply from a quantity, and gives nothing when there is none", () => {
    expect(pickBasePrice([{ amount: 90, currency_code: "tnd", min_quantity: 5 }], "tnd")).toBeNull()
    expect(pickBasePrice([], "tnd")).toBeNull()
    expect(pickBasePrice(undefined, "tnd")).toBeNull()
    expect(pickBasePrice([{ amount: 0, currency_code: "tnd" }], "tnd")).toBeNull()
  })
})

describe("discountStatus", () => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`)

  it("tells scheduled, active and ended apart", () => {
    expect(discountStatus(NOW, null, null)).toBe("active")
    expect(discountStatus(NOW, day("2026-11-10"), day("2026-11-20"))).toBe("active")
    expect(discountStatus(NOW, day("2026-11-20"), null)).toBe("scheduled")
    expect(discountStatus(NOW, null, day("2026-11-01"))).toBe("ended")
  })
})

describe("windowsOverlap and findBlockedProducts", () => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`)

  it("compares periods, where no date means no limit", () => {
    expect(windowsOverlap({ startsAt: null, endsAt: null }, { startsAt: day("2026-12-01"), endsAt: null })).toBe(true)
    expect(
      windowsOverlap(
        { startsAt: day("2026-11-01"), endsAt: day("2026-11-10") },
        { startsAt: day("2026-11-11"), endsAt: day("2026-11-20") }
      )
    ).toBe(false)
    expect(
      windowsOverlap(
        { startsAt: day("2026-11-01"), endsAt: day("2026-11-15") },
        { startsAt: day("2026-11-10"), endsAt: day("2026-11-20") }
      )
    ).toBe(true)
  })

  it("blocks products that already have a discount in the same period", () => {
    const existing = [
      { startsAt: null, endsAt: day("2026-11-30"), productIds: ["a", "b"] },
      { startsAt: day("2026-12-10"), endsAt: day("2026-12-20"), productIds: ["c"] },
    ]
    const window = { startsAt: null, endsAt: null }
    expect(findBlockedProducts(window, ["a", "c", "d"], existing, NOW).sort()).toEqual(["a", "c"])
    // A later period for "a" is fine only when it starts after the first one ends
    expect(
      findBlockedProducts({ startsAt: day("2026-12-01"), endsAt: day("2026-12-05") }, ["a", "b"], existing, NOW)
    ).toEqual([])
  })

  it("ignores discounts that have ended", () => {
    const ended = [{ startsAt: null, endsAt: day("2026-11-01"), productIds: ["a"] }]
    expect(findBlockedProducts({ startsAt: null, endsAt: null }, ["a"], ended, NOW)).toEqual([])
  })
})

describe("discount metadata", () => {
  it("is read back only for the merchant that owns it", () => {
    const meta = toDiscountMetadata({ merchantId: "sc_1", percent: 20, productIds: ["a"], currencyCode: "tnd" })
    expect(readDiscountMetadata(meta, "sc_1")).toEqual({ percent: 20, productIds: ["a"], currencyCode: "tnd" })
    expect(readDiscountMetadata(meta, "sc_2")).toBeNull()
  })

  it("rejects things that are not a merchant discount", () => {
    for (const meta of [null, undefined, "x", {}, { kind: "other", merchant_id: "sc_1" }, { kind: "merchant_discount", merchant_id: "sc_1" }]) {
      expect(readDiscountMetadata(meta, "sc_1")).toBeNull()
    }
  })

  it("has a description that holds the merchant id", () => {
    expect(discountDescription("sc_1")).toBe("merchant:sc_1")
  })
})

describe("withoutSalePrices", () => {
  it("drops the prices of price lists", () => {
    const prices = [{ id: "1", price_list_id: "plist_1" }, { id: "2", price_list_id: null }, { id: "3" }]
    expect(withoutSalePrices(prices).map((p) => p.id)).toEqual(["2", "3"])
    expect(withoutSalePrices(undefined)).toEqual([])
  })
})
