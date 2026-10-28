import {
  MAX_CLAIM_IDS,
  normalizeEmail,
  parseOrderIds,
  planClaim,
} from "../guest-claim"

const account = { id: "cus_acc", email: "Amin@Example.com", has_account: true }
const guest = { id: "cus_guest", email: "amin@example.com", has_account: false }

function order(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    email: "amin@example.com",
    customer_id: "cus_guest",
    sales_channel_id: "sc_zara",
    ...extra,
  }
}

function plan(overrides: Record<string, unknown> = {}) {
  return planClaim({
    customer: account,
    orders: [order("order_1")],
    owners: [guest],
    channelIds: ["sc_zara"],
    ...overrides,
  } as any)
}

describe("parseOrderIds", () => {
  it("accepts a list of order ids and trims them", () => {
    expect(parseOrderIds([" order_1 ", "order_2"])).toEqual(["order_1", "order_2"])
  })

  it("removes duplicates", () => {
    expect(parseOrderIds(["order_1", "order_1"])).toEqual(["order_1"])
  })

  it("refuses anything that is not a non-empty list of strings", () => {
    expect(parseOrderIds(undefined)).toBe(null)
    expect(parseOrderIds("order_1")).toBe(null)
    expect(parseOrderIds([])).toBe(null)
    expect(parseOrderIds([1])).toBe(null)
    expect(parseOrderIds([null])).toBe(null)
    expect(parseOrderIds(["order_1", ""])).toBe(null)
    expect(parseOrderIds([{ id: "order_1" }])).toBe(null)
  })

  it("refuses a very long id", () => {
    expect(parseOrderIds(["o".repeat(101)])).toBe(null)
  })

  it("accepts the maximum and refuses one more", () => {
    const ids = Array.from({ length: MAX_CLAIM_IDS }, (_, i) => `order_${i}`)
    expect(parseOrderIds(ids)).toHaveLength(MAX_CLAIM_IDS)
    expect(parseOrderIds([...ids, "order_extra"])).toBe(null)
  })
})

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Amin@Example.COM ")).toBe("amin@example.com")
  })

  it("gives an empty string for anything that is not text", () => {
    expect(normalizeEmail(undefined)).toBe("")
    expect(normalizeEmail(null)).toBe("")
    expect(normalizeEmail(5)).toBe("")
  })
})

describe("planClaim", () => {
  it("moves a guest order with the same email in the same merchant", () => {
    expect(plan()).toEqual({ claim: ["order_1"], alreadyYours: [] })
  })

  it("ignores letter case and spaces in the emails", () => {
    const p = plan({
      orders: [order("order_1", { email: " AMIN@example.com " })],
      owners: [{ ...guest, email: "Amin@EXAMPLE.com" }],
    })
    expect(p.claim).toEqual(["order_1"])
  })

  it("moves several orders at once", () => {
    const p = plan({ orders: [order("order_1"), order("order_2")] })
    expect(p.claim).toEqual(["order_1", "order_2"])
  })

  it("reports an order that already belongs to the account", () => {
    const p = plan({ orders: [order("order_1", { customer_id: "cus_acc" })] })
    expect(p).toEqual({ claim: [], alreadyYours: ["order_1"] })
  })

  it("never moves an order of another merchant", () => {
    const p = plan({ orders: [order("order_1", { sales_channel_id: "sc_alr" })] })
    expect(p).toEqual({ claim: [], alreadyYours: [] })
  })

  it("never moves an order that has no merchant", () => {
    expect(plan({ orders: [order("order_1", { sales_channel_id: null })] }).claim).toEqual([])
  })

  it("does not move an order when the guest used a different email", () => {
    const p = plan({ owners: [{ ...guest, email: "other@example.com" }] })
    expect(p.claim).toEqual([])
  })

  it("does not move an order placed with a different email", () => {
    const p = plan({ orders: [order("order_1", { email: "other@example.com" })] })
    expect(p.claim).toEqual([])
  })

  it("never moves an order of another registered account, even with the same email", () => {
    const other = { id: "cus_other", email: "amin@example.com", has_account: true }
    const p = plan({
      orders: [order("order_1", { customer_id: "cus_other" })],
      owners: [other],
    })
    expect(p.claim).toEqual([])
  })

  it("does not move an order whose owner is unknown", () => {
    expect(plan({ owners: [] }).claim).toEqual([])
  })

  it("does not move an order that has no owner", () => {
    expect(plan({ orders: [order("order_1", { customer_id: null })] }).claim).toEqual([])
  })

  it("moves nothing when the logged-in customer is not a registered account", () => {
    expect(plan({ customer: { ...account, has_account: false } }).claim).toEqual([])
    expect(plan({ customer: { ...account, has_account: null } }).claim).toEqual([])
  })

  it("moves nothing when the account has no email", () => {
    expect(plan({ customer: { ...account, email: "" } }).claim).toEqual([])
    expect(plan({ customer: { ...account, email: null } }).claim).toEqual([])
  })

  it("moves nothing when there is no customer", () => {
    expect(plan({ customer: undefined }).claim).toEqual([])
  })

  it("skips empty entries in the lists", () => {
    const p = plan({
      orders: [undefined, null, order("order_1")],
      owners: [undefined, guest, null],
    })
    expect(p.claim).toEqual(["order_1"])
  })

  it("handles a mix: moves the guest's order and skips the rest", () => {
    const p = plan({
      orders: [
        order("order_1"),
        order("order_2", { sales_channel_id: "sc_alr" }),
        order("order_3", { customer_id: "cus_acc" }),
        order("order_4", { email: "other@example.com" }),
      ],
    })
    expect(p).toEqual({ claim: ["order_1"], alreadyYours: ["order_3"] })
  })
})
