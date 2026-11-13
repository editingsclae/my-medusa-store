import {
  EMAIL_TEMPLATES,
  EmailDataError,
  renderEmail,
  renderOrderCanceled,
  renderOrderShipped,
} from "../modules/resend/email-templates"
import { buildOrderStatusNotification } from "../workflows/order-status-notification"

function order(extra: Record<string, unknown> = {}): any {
  return {
    id: "order_01",
    display_id: 82,
    email: "buyer@example.com",
    currency_code: "tnd",
    customer_id: "cus_01",
    sales_channel: { name: "Aura" },
    items: [
      {
        title: "Linen Shirt",
        product_title: "Linen Shirt",
        variant_title: "M",
        thumbnail: "https://files.example.com/a.jpg",
        quantity: 2,
        unit_price: 50,
      },
    ],
    shipping_address: {
      first_name: "Sami",
      last_name: "Ben Ali",
      address_1: "12 Rue de Marseille",
      city: "Tunis",
      postal_code: "1000",
      country_code: "tn",
      phone: "+21620111222",
    },
    shipping_methods: [{ name: "Standard delivery" }],
    total: 107,
    ...extra,
  }
}

describe("renderOrderShipped", () => {
  it("says the order is on its way and what to pay in cash", () => {
    const mail = renderOrderShipped({ order: order() })
    expect(mail.subject).toBe("Your order #82 from Aura is on its way")
    expect(mail.fromName).toBe("Aura")
    expect(mail.text).toContain("has been shipped")
    expect(mail.text).toContain("The courier will call +21620111222")
    expect(mail.text).toContain("Payment: cash on delivery, TND 107.00")
    expect(mail.text).toContain("Linen Shirt (M): quantity 2")
    expect(mail.text).toContain("12 Rue de Marseille")
    expect(mail.html).toContain("Your order is on its way")
  })

  it("never mentions tracking numbers", () => {
    const mail = renderOrderShipped({ order: order() })
    expect(mail.text.toLowerCase()).not.toContain("tracking")
    expect(mail.html.toLowerCase()).not.toContain("tracking")
  })

  it("works without a phone number or a store name", () => {
    const mail = renderOrderShipped({
      order: order({ sales_channel: null, shipping_address: { first_name: "Sami", city: "Tunis" } }),
    })
    expect(mail.subject).toBe("Your order #82 is on its way")
    expect(mail.fromName).toBeNull()
    expect(mail.text).toContain("The courier will call you before arriving")
  })

  it("escapes everything that comes from the order", () => {
    const mail = renderOrderShipped({
      order: order({
        sales_channel: { name: "<b>Shop</b>" },
        items: [{ title: "<script>alert(1)</script>", quantity: 1, unit_price: 1 }],
      }),
    })
    expect(mail.html).not.toContain("<script>")
    expect(mail.html).not.toContain("<b>Shop</b>")
    expect(mail.html).toContain("&lt;script&gt;")
  })

  it("refuses data without an order", () => {
    expect(() => renderOrderShipped({})).toThrow(EmailDataError)
    expect(() => renderOrderShipped(undefined)).toThrow(EmailDataError)
  })
})

describe("renderOrderCanceled", () => {
  it("says the shop canceled the order and that nothing is due", () => {
    const mail = renderOrderCanceled({ order: order() })
    expect(mail.subject).toBe("Your order #82 from Aura was canceled")
    expect(mail.text).toContain("was canceled by Aura")
    expect(mail.text).toContain("You do not need to pay anything")
    expect(mail.text).toContain("Linen Shirt (M): quantity 2")
    expect(mail.html).toContain("Your order was canceled")
  })

  it("does not show a delivery address, a courier or an amount to pay", () => {
    const mail = renderOrderCanceled({ order: order() })
    expect(mail.text).not.toContain("12 Rue de Marseille")
    expect(mail.text.toLowerCase()).not.toContain("courier")
    expect(mail.text).not.toContain("TND 107.00")
    expect(mail.text.toLowerCase()).not.toContain("cash on delivery")
  })

  it("works without a store name", () => {
    const mail = renderOrderCanceled({ order: order({ sales_channel: null }) })
    expect(mail.text).toContain("was canceled. You do not need to pay anything")
    expect(mail.text).toContain("please contact the shop")
  })

  it("refuses data without an order", () => {
    expect(() => renderOrderCanceled({})).toThrow(EmailDataError)
  })
})

describe("renderEmail", () => {
  it("knows the new templates", () => {
    expect(EMAIL_TEMPLATES.ORDER_SHIPPED).toBe("order-shipped")
    expect(EMAIL_TEMPLATES.ORDER_CANCELED).toBe("order-canceled")
    expect(renderEmail("order-shipped", { order: order() })?.subject).toContain("on its way")
    expect(renderEmail("order-canceled", { order: order() })?.subject).toContain("was canceled")
  })
})

describe("buildOrderStatusNotification", () => {
  it("builds a shipped notification with its own idempotency key", () => {
    const n: any = buildOrderStatusNotification("shipped", order())
    expect(n.to).toBe("buyer@example.com")
    expect(n.channel).toBe("email")
    expect(n.template).toBe("order-shipped")
    expect(n.trigger_type).toBe("order.shipped")
    expect(n.resource_id).toBe("order_01")
    expect(n.receiver_id).toBe("cus_01")
    expect(n.idempotency_key).toBe("order-shipped:order_01")
  })

  it("builds a canceled notification that cannot clash with the shipped one", () => {
    const n: any = buildOrderStatusNotification("canceled", order())
    expect(n.template).toBe("order-canceled")
    expect(n.trigger_type).toBe("order.canceled")
    expect(n.idempotency_key).toBe("order-canceled:order_01")
  })

  it("sends nothing without a usable email address", () => {
    expect(buildOrderStatusNotification("shipped", order({ email: null }))).toBeNull()
    expect(buildOrderStatusNotification("canceled", order({ email: "not-an-email" }))).toBeNull()
    expect(buildOrderStatusNotification("canceled", null)).toBeNull()
    expect(buildOrderStatusNotification("shipped", { email: "a@b.c" } as any)).toBeNull()
  })

  it("copies only what the email needs", () => {
    const n: any = buildOrderStatusNotification(
      "shipped",
      order({ billing_address: { address_1: "Private" }, payment_collections: [{ id: "p" }] })
    )
    expect(n.data.order.billing_address).toBeUndefined()
    expect(n.data.order.payment_collections).toBeUndefined()
  })
})
