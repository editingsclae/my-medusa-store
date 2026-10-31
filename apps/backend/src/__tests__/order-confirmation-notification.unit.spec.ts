import {
  ORDER_CONFIRMATION_FIELDS,
  buildOrderConfirmationNotification,
} from "../workflows/order-confirmation-notification"

function order(extra: Record<string, unknown> = {}): any {
  return {
    id: "order_01",
    display_id: 45,
    email: "buyer@example.com",
    currency_code: "tnd",
    customer_id: "cus_01",
    sales_channel: { name: "ZARA", id: "sc_01" },
    items: [{ title: "Mug", quantity: 1, unit_price: 10, id: "item_01", metadata: { secret: 1 } }],
    shipping_address: { first_name: "Sami", city: "Tunis", id: "addr_01" },
    billing_address: { first_name: "Sami", address_1: "Private street" },
    shipping_methods: [{ name: "Standard delivery", id: "sm_01", amount: 7 }],
    payment_collections: [{ id: "pay_01" }],
    item_subtotal: 10,
    shipping_subtotal: 7,
    total: 17,
    ...extra,
  }
}

describe("buildOrderConfirmationNotification", () => {
  it("builds an email notification for the order", () => {
    const n: any = buildOrderConfirmationNotification(order())
    expect(n.to).toBe("buyer@example.com")
    expect(n.channel).toBe("email")
    expect(n.template).toBe("order-placed")
    expect(n.trigger_type).toBe("order.placed")
    expect(n.resource_id).toBe("order_01")
    expect(n.resource_type).toBe("order")
    expect(n.receiver_id).toBe("cus_01")
  })

  it("uses the order id as the idempotency key so an order is never confirmed twice", () => {
    const n: any = buildOrderConfirmationNotification(order())
    expect(n.idempotency_key).toBe("order-placed:order_01")
    const again: any = buildOrderConfirmationNotification(order())
    expect(again.idempotency_key).toBe(n.idempotency_key)
    const other: any = buildOrderConfirmationNotification(order({ id: "order_02" }))
    expect(other.idempotency_key).toBe("order-placed:order_02")
  })

  it("trims the email address", () => {
    const n: any = buildOrderConfirmationNotification(order({ email: "  buyer@example.com " }))
    expect(n.to).toBe("buyer@example.com")
  })

  it("sends nothing without a usable email address", () => {
    expect(buildOrderConfirmationNotification(order({ email: null }))).toBe(null)
    expect(buildOrderConfirmationNotification(order({ email: "" }))).toBe(null)
    expect(buildOrderConfirmationNotification(order({ email: "   " }))).toBe(null)
    expect(buildOrderConfirmationNotification(order({ email: "not an email" }))).toBe(null)
    expect(buildOrderConfirmationNotification(order({ email: "a@" }))).toBe(null)
    expect(buildOrderConfirmationNotification(order({ email: undefined }))).toBe(null)
  })

  it("sends nothing without an order", () => {
    expect(buildOrderConfirmationNotification(null)).toBe(null)
    expect(buildOrderConfirmationNotification(undefined)).toBe(null)
    expect(buildOrderConfirmationNotification({} as any)).toBe(null)
  })

  it("has no receiver when the order has no customer (a guest order)", () => {
    const n: any = buildOrderConfirmationNotification(order({ customer_id: null }))
    expect(n.receiver_id).toBe(null)
  })

  it("keeps only what the email needs: no billing address, ids of lines or payments", () => {
    const n: any = buildOrderConfirmationNotification(order())
    const stored = JSON.stringify(n.data)
    expect(stored.includes("billing_address")).toBe(false)
    expect(stored.includes("Private street")).toBe(false)
    expect(stored.includes("payment_collections")).toBe(false)
    expect(stored.includes("secret")).toBe(false)
    expect(stored.includes("addr_01")).toBe(false)
    expect(n.data.order.sales_channel).toEqual({ name: "ZARA" })
    expect(n.data.order.items[0]).toEqual({
      title: "Mug",
      product_title: null,
      variant_title: null,
      thumbnail: null,
      quantity: 1,
      unit_price: 10,
    })
    expect(n.data.order.shipping_methods).toEqual([{ name: "Standard delivery" }])
    expect(n.data.order.total).toBe(17)
  })

  it("copes with an order that has no items, address or shipping method", () => {
    const n: any = buildOrderConfirmationNotification(
      order({ items: null, shipping_address: null, shipping_methods: undefined, sales_channel: null })
    )
    expect(n.data.order.items).toEqual([])
    expect(n.data.order.shipping_address).toBe(null)
    expect(n.data.order.shipping_methods).toEqual([])
    expect(n.data.order.sales_channel).toBe(null)
  })
})

describe("ORDER_CONFIRMATION_FIELDS", () => {
  it("never uses the *relation shorthand, which query.graph does not expand", () => {
    for (const field of ORDER_CONFIRMATION_FIELDS) {
      expect(field.startsWith("*")).toBe(false)
    }
  })

  it("asks for the store name, the totals and the lines the email uses", () => {
    expect(ORDER_CONFIRMATION_FIELDS).toContain("sales_channel.name")
    expect(ORDER_CONFIRMATION_FIELDS).toContain("item_subtotal")
    expect(ORDER_CONFIRMATION_FIELDS).toContain("shipping_subtotal")
    expect(ORDER_CONFIRMATION_FIELDS).toContain("items.unit_price")
    expect(ORDER_CONFIRMATION_FIELDS).toContain("shipping_address.phone")
  })

  it("does not ask for the billing address", () => {
    expect(ORDER_CONFIRMATION_FIELDS.some((f) => f.startsWith("billing_address"))).toBe(false)
  })
})
