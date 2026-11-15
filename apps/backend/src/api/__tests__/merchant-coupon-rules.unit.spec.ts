import {
  couponCampaignDescription,
  couponStatus,
  minOrderProblem,
  normalizeCode,
  parseCouponInput,
  readCouponMetadata,
  toCouponMetadata,
} from "../admin/merchant/coupon-rules"

const NOW = new Date("2026-11-15T12:00:00.000Z")

describe("normalizeCode", () => {
  it("trims and upper-cases", () => {
    expect(normalizeCode("  welcome10 ")).toBe("WELCOME10")
    expect(normalizeCode(5)).toBe("")
  })
})

describe("parseCouponInput", () => {
  it("accepts a percentage coupon with no limits", () => {
    const result = parseCouponInput({ code: "welcome10", kind: "percent", value: 10 }, NOW)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({
        code: "WELCOME10",
        kind: "percent",
        value: 10,
        startsAt: null,
        endsAt: null,
        maxUses: null,
        perCustomer: false,
        minOrder: null,
      })
    }
  })

  it("accepts a fixed amount with every limit", () => {
    const result = parseCouponInput(
      {
        code: "SAVE5",
        kind: "fixed",
        value: "5",
        starts_at: "2026-11-20",
        ends_at: "2026-12-01",
        max_uses: "50",
        per_customer: true,
        min_order: 100,
      },
      NOW
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.value).toBe(5)
      expect(result.value.maxUses).toBe(50)
      expect(result.value.perCustomer).toBe(true)
      expect(result.value.minOrder).toBe(100)
      expect(result.value.startsAt?.toISOString()).toBe("2026-11-19T23:00:00.000Z")
      expect(result.value.endsAt?.toISOString()).toBe("2026-12-01T22:59:59.999Z")
    }
  })

  it.each([
    [{ code: "ab", kind: "percent", value: 10 }, "code"],
    [{ code: "has space", kind: "percent", value: 10 }, "code"],
    [{ code: "OKAY", kind: "other", value: 10 }, "percentage or a fixed"],
    [{ code: "OKAY", kind: "percent", value: 0 }, "whole percentage"],
    [{ code: "OKAY", kind: "percent", value: 95 }, "whole percentage"],
    [{ code: "OKAY", kind: "percent", value: 10.5 }, "whole percentage"],
    [{ code: "OKAY", kind: "fixed", value: -2 }, "more than 0"],
    [{ code: "OKAY", kind: "percent", value: 10, max_uses: 0 }, "number of uses"],
    [{ code: "OKAY", kind: "percent", value: 10, min_order: -1 }, "minimum order"],
    [{ code: "OKAY", kind: "percent", value: 10, ends_at: "2026-11-01" }, "future"],
    [{ code: "OKAY", kind: "percent", value: 10, starts_at: "2026-12-10", ends_at: "2026-12-01" }, "after the start"],
    [{ code: "OKAY", kind: "fixed", value: 50, min_order: 40 }, "lower than the minimum"],
  ])("refuses %j", (body, fragment) => {
    const result = parseCouponInput(body, NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(fragment)
  })
})

describe("couponStatus", () => {
  const day = (d: string) => new Date(`${d}T00:00:00.000Z`)
  it("tells where a coupon stands", () => {
    expect(couponStatus(NOW, null, null, 0, null)).toBe("active")
    expect(couponStatus(NOW, day("2026-11-20"), null, 0, null)).toBe("scheduled")
    expect(couponStatus(NOW, null, day("2026-11-01"), 0, null)).toBe("expired")
    expect(couponStatus(NOW, null, null, 50, 50)).toBe("used_up")
    expect(couponStatus(NOW, null, null, 49, 50)).toBe("active")
  })
})

describe("coupon metadata", () => {
  it("is read back only for the merchant that owns it", () => {
    const meta = toCouponMetadata("sc_1", { minOrder: 100, perCustomer: true })
    expect(readCouponMetadata(meta, "sc_1")).toEqual({ minOrder: 100, perCustomer: true })
    expect(readCouponMetadata(meta, "sc_2")).toBeNull()
    expect(readCouponMetadata({}, "sc_1")).toBeNull()
    expect(readCouponMetadata(null, "sc_1")).toBeNull()
  })

  it("names the campaign after the merchant", () => {
    expect(couponCampaignDescription("sc_1")).toBe("merchant-coupon:sc_1")
  })
})

describe("minOrderProblem", () => {
  it("passes when there is no minimum or the cart reaches it", () => {
    expect(minOrderProblem(null, 10, "tnd")).toBeNull()
    expect(minOrderProblem(100, 100, "tnd")).toBeNull()
    expect(minOrderProblem(100, 120.5, "tnd")).toBeNull()
  })

  it("explains what is missing", () => {
    expect(minOrderProblem(100, 99.99, "tnd")).toBe("This coupon needs an order of at least 100.00 TND.")
  })
})
