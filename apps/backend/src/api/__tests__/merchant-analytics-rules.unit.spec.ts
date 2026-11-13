import {
  ANALYTICS_TIMEZONE,
  dayKey,
  lastDayKeys,
  parseDays,
  periodStart,
  summarizeOrders,
  topProducts,
} from "../admin/merchant/analytics-rules"

const NOW = new Date("2026-11-13T10:00:00Z")

function order(extra: Record<string, unknown> = {}): any {
  return {
    total: 100,
    status: "pending",
    created_at: "2026-11-13T08:00:00Z",
    fulfillments: [],
    items: [],
    ...extra,
  }
}

describe("parseDays", () => {
  it("accepts 7, 30 and 90, also as text", () => {
    expect(parseDays(7)).toBe(7)
    expect(parseDays("30")).toBe(30)
    expect(parseDays(["90"])).toBe(90)
  })

  it("falls back to 7 for anything else", () => {
    for (const bad of [undefined, null, "", "abc", 0, 1, 365, -7, "30days", {}]) {
      expect(parseDays(bad)).toBe(7)
    }
  })
})

describe("dayKey", () => {
  it("cuts the day in the shop's time zone, not in UTC", () => {
    // 23:30 UTC on the 12th is 00:30 on the 13th in Tunis
    expect(ANALYTICS_TIMEZONE).toBe("Africa/Tunis")
    expect(dayKey("2026-11-12T23:30:00Z")).toBe("2026-11-13")
    expect(dayKey("2026-11-12T22:30:00Z")).toBe("2026-11-12")
  })

  it("gives empty text for values that are not dates", () => {
    for (const bad of [undefined, null, "", "not a date"]) {
      expect(dayKey(bad)).toBe("")
    }
  })
})

describe("lastDayKeys", () => {
  it("lists the days oldest first and ends today", () => {
    expect(lastDayKeys(3, NOW)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13"])
    expect(lastDayKeys(30, NOW)).toHaveLength(30)
    expect(new Set(lastDayKeys(90, NOW)).size).toBe(90)
  })
})

describe("periodStart", () => {
  it("starts one day before the first day of the period", () => {
    expect(periodStart(7, NOW).toISOString()).toBe("2026-11-05T10:00:00.000Z")
  })
})

describe("summarizeOrders", () => {
  it("counts canceled orders in nothing", () => {
    const s = summarizeOrders(
      [order({ total: 100 }), order({ total: 500, status: "canceled" })],
      7,
      NOW
    )
    expect(s.total_sales).toBe(100)
    expect(s.total_orders).toBe(1)
    expect(s.all_time_sales).toBe(100)
    expect(s.all_time_orders).toBe(1)
    expect(s.pending_orders).toBe(1)
    expect(s.fulfilled_orders).toBe(0)
    expect(s.daily_sales.reduce((sum, d) => sum + d.sales, 0)).toBe(100)
  })

  it("covers every order for the all time numbers and only the period for the rest", () => {
    const s = summarizeOrders(
      [
        order({ total: 100 }),
        order({ total: 40, created_at: "2026-11-11T08:00:00Z" }),
        order({ total: 1000, created_at: "2026-06-01T08:00:00Z" }),
      ],
      7,
      NOW
    )
    expect(s.total_sales).toBe(140)
    expect(s.total_orders).toBe(2)
    expect(s.all_time_sales).toBe(1140)
    expect(s.all_time_orders).toBe(3)
  })

  it("a longer period reaches further back", () => {
    const old = order({ total: 1000, created_at: "2026-10-20T08:00:00Z" })
    expect(summarizeOrders([old], 7, NOW).total_orders).toBe(0)
    expect(summarizeOrders([old], 30, NOW).total_orders).toBe(1)
    expect(summarizeOrders([old], 30, NOW).daily_sales).toHaveLength(30)
  })

  it("puts an order on the day it was placed in Tunis", () => {
    const s = summarizeOrders([order({ created_at: "2026-11-12T23:30:00Z" })], 3, NOW)
    expect(s.daily_sales.map((d) => d.count)).toEqual([0, 0, 1])
  })

  it("pending and shipped follow the real fulfillment stage and ignore canceled fulfillments", () => {
    const s = summarizeOrders(
      [
        order({ fulfillments: [] }),
        order({ fulfillments: [{ canceled_at: "2026-11-13T09:00:00Z" }] }),
        order({ fulfillments: [{}] }),
        order({ fulfillments: [{ shipped_at: "2026-11-13T09:00:00Z" }] }),
        order({ fulfillments: [{ delivered_at: "2026-11-13T09:00:00Z" }] }),
        order({ fulfillments: [{ shipped_at: "2026-11-13T09:00:00Z", canceled_at: "2026-11-13T09:30:00Z" }] }),
      ],
      7,
      NOW
    )
    expect(s.fulfilled_orders).toBe(2)
    expect(s.pending_orders).toBe(4)
  })

  it("ignores bad totals and dates instead of breaking", () => {
    const s = summarizeOrders(
      [order({ total: "abc" }), order({ total: null }), order({ created_at: "nope", total: 5 })],
      7,
      NOW
    )
    expect(s.all_time_sales).toBe(5)
    expect(s.total_sales).toBe(0)
    expect(s.all_time_orders).toBe(3)
  })

  it("a shop without orders gives zeros and a full empty chart", () => {
    const s = summarizeOrders([], 7, NOW)
    expect(s.total_sales).toBe(0)
    expect(s.daily_sales).toHaveLength(7)
    expect(s.daily_sales.every((d) => d.sales === 0 && d.count === 0)).toBe(true)
  })
})

describe("topProducts", () => {
  const items = (title: string, quantity: number, thumbnail?: string) => ({ title, quantity, thumbnail })

  it("ranks by quantity and leaves out canceled orders", () => {
    const top = topProducts(
      [
        order({ items: [items("Mug", 2), items("Shirt", 1)] }),
        order({ items: [items("Mug", 1)] }),
        order({ status: "canceled", items: [items("Hat", 50)] }),
      ],
      7,
      NOW
    )
    expect(top.map((p) => [p.title, p.quantity])).toEqual([
      ["Mug", 3],
      ["Shirt", 1],
    ])
  })

  it("covers only the period", () => {
    const old = order({ created_at: "2026-10-20T08:00:00Z", items: [items("Old", 9)] })
    expect(topProducts([old], 7, NOW)).toEqual([])
    expect(topProducts([old], 30, NOW).map((p) => p.title)).toEqual(["Old"])
  })

  it("keeps the first picture it finds and returns at most five", () => {
    const many = Array.from({ length: 8 }, (_, i) => items(`P${i}`, 8 - i))
    const top = topProducts(
      [order({ items: [items("Mug", 100), items("Mug", 1, "https://img/mug.jpg"), ...many] })],
      7,
      NOW
    )
    expect(top).toHaveLength(5)
    expect(top[0]).toEqual({ title: "Mug", quantity: 101, thumbnail: "https://img/mug.jpg" })
  })
})
