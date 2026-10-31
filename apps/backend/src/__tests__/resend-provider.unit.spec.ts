import ResendNotificationProviderService from "../modules/resend/service"

type Sent = Record<string, any>

function makeService(
  result: { data?: { id: string } | null; error?: { message: string } | null } = { data: { id: "email_1" } }
) {
  const sent: Sent[] = []
  const errors: string[] = []
  const logger: any = { error: (m: string) => errors.push(m) }
  const service: any = new ResendNotificationProviderService(
    { logger },
    { api_key: "re_test", from: "orders@getcardy.shop" }
  )
  service.resendClient = {
    emails: {
      send: async (payload: Sent) => {
        sent.push(payload)
        return { data: result.data ?? null, error: result.error ?? null }
      },
    },
  }
  return { service: service as ResendNotificationProviderService, sent, errors }
}

function notification(extra: Record<string, unknown> = {}) {
  return {
    to: "buyer@example.com",
    channel: "email",
    template: "order-placed",
    data: {
      order: {
        id: "order_01",
        display_id: 45,
        currency_code: "tnd",
        sales_channel: { name: "ZARA" },
        items: [{ title: "Mug", quantity: 1, unit_price: 10 }],
        item_subtotal: 10,
        shipping_subtotal: 7,
        total: 17,
      },
    },
    ...extra,
  } as any
}

describe("ResendNotificationProviderService options", () => {
  it("is the notification-resend provider", () => {
    expect((ResendNotificationProviderService as any).identifier).toBe("notification-resend")
  })

  it("needs an api key and a from address", () => {
    const validate = (ResendNotificationProviderService as any).validateOptions
    expect(() => validate({ from: "a@b.com" })).toThrow()
    expect(() => validate({ api_key: "k" })).toThrow()
    expect(() => validate({})).toThrow()
    expect(() => validate({ api_key: "k", from: "a@b.com" })).not.toThrow()
  })
})

describe("ResendNotificationProviderService send", () => {
  it("sends the email to the buyer from the store's name", async () => {
    const { service, sent } = makeService()
    const result = await service.send(notification())

    expect(result).toEqual({ id: "email_1" })
    expect(sent).toHaveLength(1)
    expect(sent[0].from).toBe("ZARA <orders@getcardy.shop>")
    expect(sent[0].to).toEqual(["buyer@example.com"])
    expect(sent[0].subject).toBe("Your order #45 from ZARA is confirmed")
    expect(sent[0].html).toContain("Thank you for your order")
    expect(sent[0].text).toContain("Total: TND 17.00")
  })

  it("sends from the plain address when the order has no store name", async () => {
    const { service, sent } = makeService()
    const n = notification()
    n.data.order.sales_channel = null
    await service.send(n)
    expect(sent[0].from).toBe("orders@getcardy.shop")
  })

  it("throws when Resend answers with an error, so the notification is recorded as failed", async () => {
    const { service, errors } = makeService({ error: { message: "domain is not verified" } })
    await expect(service.send(notification())).rejects.toThrow("domain is not verified")
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("domain is not verified")
  })

  it("throws when Resend answers with nothing", async () => {
    const { service } = makeService({ data: null, error: null })
    await expect(service.send(notification())).rejects.toThrow("unknown error")
  })

  it("throws for a template that does not exist and sends nothing", async () => {
    const { service, sent } = makeService()
    await expect(service.send(notification({ template: "nope" }))).rejects.toThrow('There is no email template "nope"')
    expect(sent).toHaveLength(0)
  })

  it("throws for order data that cannot be used and sends nothing", async () => {
    const { service, sent } = makeService()
    await expect(service.send(notification({ data: {} }))).rejects.toThrow("needs data.order")
    await expect(service.send(notification({ data: null }))).rejects.toThrow("needs data.order")
    expect(sent).toHaveLength(0)
  })
})
