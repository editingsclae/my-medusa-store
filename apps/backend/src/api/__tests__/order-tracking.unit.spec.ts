import { ORDER_TRACKING_FIELDS, trackingNumbersForOrder } from "../order-tracking"

const order = (fulfillments: any, channel: string | null = "sc_a") =>
  ({ sales_channel_id: channel, fulfillments }) as any

describe("trackingNumbersForOrder", () => {
  it("returns the number the merchant entered", () => {
    const o = order([{ canceled_at: null, labels: [{ tracking_number: "UG251948854MV" }] }])
    expect(trackingNumbersForOrder(o, ["sc_a"])).toEqual(["UG251948854MV"])
  })

  it("returns an empty list when nothing was entered", () => {
    expect(trackingNumbersForOrder(order([{ labels: [] }]), ["sc_a"])).toEqual([])
    expect(trackingNumbersForOrder(order([]), ["sc_a"])).toEqual([])
    expect(trackingNumbersForOrder(order(null), ["sc_a"])).toEqual([])
    expect(trackingNumbersForOrder(order([{}]), ["sc_a"])).toEqual([])
  })

  it("ignores blank and non-text values", () => {
    const o = order([
      { labels: [{ tracking_number: "   " }, { tracking_number: 12 }, null, {}] },
    ])
    expect(trackingNumbersForOrder(o, ["sc_a"])).toEqual([])
  })

  it("lists several numbers once each, in order", () => {
    const o = order([
      { labels: [{ tracking_number: "A1" }, { tracking_number: "B2" }] },
      { labels: [{ tracking_number: "A1" }, { tracking_number: "C3" }] },
    ])
    expect(trackingNumbersForOrder(o, ["sc_a"])).toEqual(["A1", "B2", "C3"])
  })

  it("does not count a canceled fulfillment", () => {
    const o = order([
      { canceled_at: "2026-11-21T10:00:00.000Z", labels: [{ tracking_number: "OLD" }] },
      { canceled_at: null, labels: [{ tracking_number: "NEW" }] },
    ])
    expect(trackingNumbersForOrder(o, ["sc_a"])).toEqual(["NEW"])
  })

  it("turns line breaks into spaces and caps the length", () => {
    const o = order([{ labels: [{ tracking_number: "AB\n  CD" }, { tracking_number: "x".repeat(300) }] }])
    const result = trackingNumbersForOrder(o, ["sc_a"])!
    expect(result[0]).toBe("AB CD")
    expect(result[1]).toHaveLength(100)
  })

  it("returns at most five numbers", () => {
    const labels = Array.from({ length: 8 }, (_, i) => ({ tracking_number: `T${i}` }))
    expect(trackingNumbersForOrder(order([{ labels }]), ["sc_a"])).toHaveLength(5)
  })

  it("is null for an order of another merchant, with or without a number", () => {
    const o = order([{ labels: [{ tracking_number: "SECRET" }] }], "sc_b")
    expect(trackingNumbersForOrder(o, ["sc_a"])).toBeNull()
    expect(trackingNumbersForOrder(order([], "sc_b"), ["sc_a"])).toBeNull()
  })

  it("is null for a missing order or one without a sales channel", () => {
    expect(trackingNumbersForOrder(null, ["sc_a"])).toBeNull()
    expect(trackingNumbersForOrder(undefined, ["sc_a"])).toBeNull()
    expect(trackingNumbersForOrder(order([{ labels: [{ tracking_number: "X" }] }], null), ["sc_a"])).toBeNull()
  })

  it("accepts an order in any of the key's channels", () => {
    const o = order([{ labels: [{ tracking_number: "X" }] }], "sc_b")
    expect(trackingNumbersForOrder(o, ["sc_a", "sc_b"])).toEqual(["X"])
  })
})

describe("ORDER_TRACKING_FIELDS", () => {
  it("asks only for what the check and the answer need", () => {
    expect(ORDER_TRACKING_FIELDS).toEqual([
      "id",
      "sales_channel_id",
      "fulfillments.canceled_at",
      "fulfillments.labels.tracking_number",
    ])
  })
})
