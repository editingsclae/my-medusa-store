import {
  MAX_NAME_LENGTH,
  MAX_PRICE,
  buildPriceUpdate,
  buildRulesForEnabled,
  findOwnedOption,
  isOptionEnabled,
  leavesNoEnabledOption,
  parseOptionName,
  parsePrice,
  readOptionPrice,
  serializeOption,
} from "../admin/merchant/delivery-options"

const enabledRule = (value = "true") => ({
  id: "r_enabled",
  attribute: "enabled_in_store",
  operator: "eq",
  values: [{ value }],
})
const returnRule = { id: "r_return", attribute: "is_return", operator: "eq", values: [{ value: "false" }] }

// The shape of a provisioned option: one price in the currency and one per
// region that uses it
const option = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Option ${id}`,
  price_type: "flat",
  provider_id: "manual_manual",
  prices: [
    { id: "p_cur", amount: 7, currency_code: "tnd", price_rules: [] },
    {
      id: "p_reg",
      amount: 7,
      currency_code: "tnd",
      price_rules: [{ attribute: "region_id", operator: "eq", value: "reg_tn" }],
    },
  ],
  rules: [enabledRule(), returnRule],
  ...extra,
})

describe("parseOptionName", () => {
  it("trims and collapses whitespace", () => {
    expect(parseOptionName("  Express   delivery ")).toBe("Express delivery")
  })

  it("rejects empty, blank, too long and non strings", () => {
    expect(parseOptionName("")).toBe(null)
    expect(parseOptionName("   ")).toBe(null)
    expect(parseOptionName("x".repeat(MAX_NAME_LENGTH + 1))).toBe(null)
    expect(parseOptionName(undefined)).toBe(null)
    expect(parseOptionName(5)).toBe(null)
  })

  it("accepts the longest allowed name", () => {
    expect(parseOptionName("x".repeat(MAX_NAME_LENGTH))).toBe("x".repeat(MAX_NAME_LENGTH))
  })
})

describe("parsePrice", () => {
  it("reads numbers and numeric strings", () => {
    expect(parsePrice(7)).toBe(7)
    expect(parsePrice("7.5")).toBe(7.5)
    expect(parsePrice(" 12 ")).toBe(12)
  })

  it("accepts a comma as the decimal mark", () => {
    expect(parsePrice("7,5")).toBe(7.5)
  })

  it("allows zero for free delivery", () => {
    expect(parsePrice(0)).toBe(0)
    expect(parsePrice("0")).toBe(0)
  })

  it("requires a price: missing or blank is not free delivery", () => {
    expect(parsePrice(undefined)).toBe(null)
    expect(parsePrice(null)).toBe(null)
    expect(parsePrice("")).toBe(null)
    expect(parsePrice("  ")).toBe(null)
  })

  it("rejects negative, non numeric, infinite and too large values", () => {
    expect(parsePrice(-1)).toBe(null)
    expect(parsePrice("abc")).toBe(null)
    expect(parsePrice(NaN)).toBe(null)
    expect(parsePrice(Infinity)).toBe(null)
    expect(parsePrice(MAX_PRICE + 1)).toBe(null)
    expect(parsePrice(MAX_PRICE)).toBe(MAX_PRICE)
  })

  it("keeps three decimals, as dinars have", () => {
    expect(parsePrice("7.12345")).toBe(7.123)
    expect(parsePrice("9.52")).toBe(9.52)
  })
})

describe("readOptionPrice", () => {
  it("reads the plain price in the store currency", () => {
    expect(readOptionPrice(option("a") as any, "TND")).toBe(7)
  })

  it("ignores region rows and cart total rows", () => {
    const only = option("a", {
      prices: [
        {
          id: "p_reg",
          amount: 99,
          currency_code: "tnd",
          price_rules: [{ attribute: "region_id", value: "reg_tn" }],
        },
        {
          id: "p_free",
          amount: 0,
          currency_code: "tnd",
          price_rules: [{ attribute: "item_total", operator: "gte", value: 150 }],
        },
        { id: "p_cur", amount: "8.5", currency_code: "tnd", price_rules: [] },
      ],
    })
    expect(readOptionPrice(only as any, "tnd")).toBe(8.5)
  })

  it("returns null when there is no plain price row", () => {
    expect(readOptionPrice(option("a", { prices: [] }) as any, "tnd")).toBe(null)
    expect(readOptionPrice(option("a", { prices: null }) as any, "tnd")).toBe(null)
  })
})

describe("isOptionEnabled", () => {
  it("is enabled when the enabled_in_store rule is true", () => {
    expect(isOptionEnabled(option("a") as any)).toBe(true)
  })

  it("is disabled only when the rule is an explicit false", () => {
    expect(isOptionEnabled(option("a", { rules: [enabledRule("false"), returnRule] }) as any)).toBe(false)
  })

  it("is enabled when the option has no such rule", () => {
    expect(isOptionEnabled(option("a", { rules: [returnRule] }) as any)).toBe(true)
    expect(isOptionEnabled(option("a", { rules: null }) as any)).toBe(true)
  })

  it("reads a rule that carries a plain value instead of values", () => {
    const rule = { id: "r", attribute: "enabled_in_store", operator: "eq", value: "false" }
    expect(isOptionEnabled(option("a", { rules: [rule] }) as any)).toBe(false)
  })
})

describe("serializeOption", () => {
  it("shows name, price, currency and state", () => {
    expect(serializeOption(option("a") as any, "TND")).toEqual({
      id: "a",
      name: "Option a",
      price: 7,
      currency_code: "tnd",
      enabled: true,
      is_flat: true,
    })
  })

  it("marks a calculated option so the page can lock its price", () => {
    expect(serializeOption(option("a", { price_type: "calculated" }) as any, "tnd").is_flat).toBe(false)
  })
})

describe("buildPriceUpdate", () => {
  it("gives every plain and region row the new amount and keeps their ids", () => {
    expect(buildPriceUpdate(option("a").prices as any, 9.5, "TND")).toEqual([
      { id: "p_cur", currency_code: "tnd", amount: 9.5 },
      { id: "p_reg", region_id: "reg_tn", amount: 9.5 },
    ])
  })

  it("keeps a free-above-an-amount row exactly as it is", () => {
    const prices = [
      ...option("a").prices,
      {
        id: "p_free",
        amount: 0,
        currency_code: "tnd",
        price_rules: [{ attribute: "item_total", operator: "gte", value: "150" }],
      },
    ]
    const result = buildPriceUpdate(prices as any, 12, "tnd")
    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({
      id: "p_free",
      currency_code: "tnd",
      amount: 0,
      rules: [{ attribute: "item_total", operator: "gte", value: 150 }],
    })
    expect(result[0]).toEqual({ id: "p_cur", currency_code: "tnd", amount: 12 })
  })

  it("adds a currency price when the option has none, so it is never left without a price", () => {
    expect(buildPriceUpdate([], 5, "TND")).toEqual([{ currency_code: "tnd", amount: 5 }])
  })

  it("adds a currency price when only region rows exist", () => {
    const regionOnly = [option("a").prices[1]]
    expect(buildPriceUpdate(regionOnly as any, 5, "tnd")).toEqual([
      { id: "p_reg", region_id: "reg_tn", amount: 5 },
      { currency_code: "tnd", amount: 5 },
    ])
  })

  it("sets a zero price for free delivery", () => {
    expect(buildPriceUpdate(option("a").prices as any, 0, "tnd")[0]).toEqual({
      id: "p_cur",
      currency_code: "tnd",
      amount: 0,
    })
  })
})

describe("buildRulesForEnabled", () => {
  it("switches only enabled_in_store and keeps every other rule", () => {
    expect(buildRulesForEnabled([enabledRule(), returnRule] as any, false)).toEqual([
      { id: "r_enabled", attribute: "enabled_in_store", operator: "eq", value: "false" },
      { id: "r_return", attribute: "is_return", operator: "eq", value: "false" },
    ])
  })

  it("switches it back on", () => {
    expect(buildRulesForEnabled([enabledRule("false"), returnRule] as any, true)[0]).toEqual({
      id: "r_enabled",
      attribute: "enabled_in_store",
      operator: "eq",
      value: "true",
    })
  })

  it("adds the rule when the option had none", () => {
    expect(buildRulesForEnabled([returnRule] as any, false)).toEqual([
      { id: "r_return", attribute: "is_return", operator: "eq", value: "false" },
      { attribute: "enabled_in_store", operator: "eq", value: "false" },
    ])
    expect(buildRulesForEnabled([], true)).toEqual([
      { attribute: "enabled_in_store", operator: "eq", value: "true" },
    ])
  })

  it("keeps a rule with several values as a list", () => {
    const multi = { id: "r_m", attribute: "customer_group", operator: "in", values: [{ value: "a" }, { value: "b" }] }
    expect(buildRulesForEnabled([multi] as any, true)[0]).toEqual({
      id: "r_m",
      attribute: "customer_group",
      operator: "in",
      value: ["a", "b"],
    })
  })
})

describe("findOwnedOption", () => {
  const mine = [option("so_1"), option("so_2")] as any

  it("finds an option in the merchant's own list", () => {
    expect(findOwnedOption(mine, "so_2")?.id).toBe("so_2")
  })

  it("does not find an id that is not in the list, such as another merchant's option", () => {
    expect(findOwnedOption(mine, "so_other")).toBe(undefined)
  })

  it("does not find anything for a value that is not a string", () => {
    expect(findOwnedOption(mine, undefined)).toBe(undefined)
    expect(findOwnedOption(mine, ["so_1"])).toBe(undefined)
    expect(findOwnedOption(mine, { id: "so_1" })).toBe(undefined)
  })
})

describe("leavesNoEnabledOption", () => {
  const off = (id: string) => option(id, { rules: [enabledRule("false"), returnRule] })

  it("never blocks an option that stays enabled", () => {
    expect(leavesNoEnabledOption([option("a")] as any, "a", true)).toBe(false)
  })

  it("blocks switching off or deleting the only enabled option", () => {
    expect(leavesNoEnabledOption([option("a")] as any, "a", false)).toBe(true)
  })

  it("blocks it when the other options are all switched off", () => {
    expect(leavesNoEnabledOption([option("a"), off("b")] as any, "a", false)).toBe(true)
  })

  it("allows it when another option is still enabled", () => {
    expect(leavesNoEnabledOption([option("a"), option("b")] as any, "a", false)).toBe(false)
  })

  it("allows deleting a disabled option while one is enabled", () => {
    expect(leavesNoEnabledOption([option("a"), off("b")] as any, "b", false)).toBe(false)
  })
})
