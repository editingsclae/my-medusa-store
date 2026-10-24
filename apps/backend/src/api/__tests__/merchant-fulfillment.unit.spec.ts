import {
  buildShippingPrices,
  normalizeCountries,
  parseShippingAmount,
} from "../admin/merchant/fulfillment"

describe("normalizeCountries", () => {
  it("defaults to Tunisia when nothing is given", () => {
    expect(normalizeCountries(undefined)).toEqual({ countries: ["tn"], invalid: [] })
    expect(normalizeCountries("")).toEqual({ countries: ["tn"], invalid: [] })
    expect(normalizeCountries([])).toEqual({ countries: ["tn"], invalid: [] })
  })

  it("lowercases, trims and de-duplicates a list", () => {
    expect(normalizeCountries([" TN ", "fr", "tn"])).toEqual({ countries: ["tn", "fr"], invalid: [] })
  })

  it("accepts a comma separated string", () => {
    expect(normalizeCountries("tn, FR")).toEqual({ countries: ["tn", "fr"], invalid: [] })
  })

  it("reports codes that are not two letters", () => {
    const result = normalizeCountries(["tn", "tunisia", "1", 5])
    expect(result.countries).toEqual(["tn"])
    expect(result.invalid).toEqual(["tunisia", "1", "5"])
  })

  it("does not fall back to the default when every given code is invalid", () => {
    const result = normalizeCountries(["xx1"])
    expect(result.countries).toEqual([])
    expect(result.invalid).toEqual(["xx1"])
  })

  it("uses a custom fallback", () => {
    expect(normalizeCountries(undefined, ["fr"])).toEqual({ countries: ["fr"], invalid: [] })
  })
})

describe("parseShippingAmount", () => {
  it("treats a missing price as free shipping", () => {
    expect(parseShippingAmount(undefined)).toBe(0)
    expect(parseShippingAmount(null)).toBe(0)
    expect(parseShippingAmount("")).toBe(0)
  })

  it("reads numbers and numeric strings", () => {
    expect(parseShippingAmount(7)).toBe(7)
    expect(parseShippingAmount("7.5")).toBe(7.5)
    expect(parseShippingAmount(0)).toBe(0)
  })

  it("rejects negative and non numeric values", () => {
    expect(parseShippingAmount(-1)).toBe(null)
    expect(parseShippingAmount("abc")).toBe(null)
    expect(parseShippingAmount(NaN)).toBe(null)
  })
})

describe("buildShippingPrices", () => {
  it("prices the currency and every region that uses it", () => {
    const regions = [
      { id: "reg_tn", currency_code: "tnd" },
      { id: "reg_eu", currency_code: "eur" },
      { id: "reg_tn2", currency_code: "TND" },
    ]
    expect(buildShippingPrices(7, "TND", regions)).toEqual([
      { currency_code: "tnd", amount: 7 },
      { region_id: "reg_tn", amount: 7 },
      { region_id: "reg_tn2", amount: 7 },
    ])
  })

  it("adds no region price when no region uses the currency", () => {
    expect(buildShippingPrices(0, "tnd", [{ id: "reg_eu", currency_code: "eur" }])).toEqual([
      { currency_code: "tnd", amount: 0 },
    ])
  })

  it("copes with a region that has no currency", () => {
    expect(buildShippingPrices(3, "tnd", [{ id: "r", currency_code: null }])).toEqual([
      { currency_code: "tnd", amount: 3 },
    ])
  })
})
