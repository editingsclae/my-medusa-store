import {
  applySalesChannelScope,
  restrictStoreOrderToKey,
  scopeStoreOrdersToKey,
} from "../store-order-scope"

function listReq(channelIds: string[] | undefined, filterableFields?: Record<string, unknown>) {
  return {
    publishable_key_context: channelIds ? { key: "pk", sales_channel_ids: channelIds } : undefined,
    filterableFields,
  } as any
}

function run(middleware: any, req: any) {
  return new Promise<unknown>((resolve) => {
    Promise.resolve(middleware(req, {} as any, (err?: unknown) => resolve(err))).catch(resolve)
  })
}

describe("applySalesChannelScope", () => {
  it("adds the key's channels to the filters", () => {
    const req: any = { filterableFields: { status: "pending" } }
    applySalesChannelScope(req, ["sc_a"])
    expect(req.filterableFields).toEqual({ status: "pending", sales_channel_id: ["sc_a"] })
  })

  it("works when there are no filters yet", () => {
    const req: any = {}
    applySalesChannelScope(req, ["sc_a"])
    expect(req.filterableFields).toEqual({ sales_channel_id: ["sc_a"] })
  })

  it("survives core validation assigning a fresh filter object afterwards", () => {
    const req: any = {}
    applySalesChannelScope(req, ["sc_a"])
    req.filterableFields = { id: "order_1" }
    expect(req.filterableFields).toEqual({ id: "order_1", sales_channel_id: ["sc_a"] })
  })

  it("does not let a later assignment widen the channels", () => {
    const req: any = {}
    applySalesChannelScope(req, ["sc_a"])
    req.filterableFields = { sales_channel_id: ["sc_a", "sc_b"] }
    expect(req.filterableFields.sales_channel_id).toEqual(["sc_a"])
  })

  it("keeps in-place edits made by later middleware", () => {
    const req: any = {}
    applySalesChannelScope(req, ["sc_a"])
    req.filterableFields.is_draft_order = false
    expect(req.filterableFields).toEqual({ is_draft_order: false, sales_channel_id: ["sc_a"] })
  })
})

describe("scopeStoreOrdersToKey", () => {
  it("scopes the list to the channels of the key", async () => {
    const req = listReq(["sc_a", "sc_b"], { status: "completed" })
    const err = await run(scopeStoreOrdersToKey, req)
    expect(err).toBe(undefined)
    expect(req.filterableFields).toEqual({ status: "completed", sales_channel_id: ["sc_a", "sc_b"] })
  })

  it("refuses a request whose key has no sales channel", async () => {
    const err: any = await run(scopeStoreOrdersToKey, listReq([]))
    expect(err.message).toBe("Publishable key needs to have a sales channel configured")
  })

  it("refuses a request with no key context at all", async () => {
    const err: any = await run(scopeStoreOrdersToKey, listReq(undefined))
    expect(err.type).toBe("invalid_data")
  })
})

function orderReq(channelIds: string[] | undefined, orders: Array<{ id: string; sales_channel_id: string }>, id: string) {
  const seen: unknown[] = []
  const req: any = {
    params: { id },
    publishable_key_context: channelIds ? { key: "pk", sales_channel_ids: channelIds } : undefined,
    scope: {
      resolve: () => ({
        graph: async (args: any) => {
          seen.push(args)
          return { data: orders.filter((o) => o.id === args.filters.id) }
        },
      }),
    },
    seen,
  }
  return req
}

describe("restrictStoreOrderToKey", () => {
  const orders = [
    { id: "order_a", sales_channel_id: "sc_a" },
    { id: "order_b", sales_channel_id: "sc_b" },
  ]

  it("lets an order of the key's merchant through", async () => {
    const err = await run(restrictStoreOrderToKey, orderReq(["sc_a"], orders, "order_a"))
    expect(err).toBe(undefined)
  })

  it("reports another merchant's order as not found", async () => {
    const err: any = await run(restrictStoreOrderToKey, orderReq(["sc_a"], orders, "order_b"))
    expect(err.type).toBe("not_found")
    expect(err.message).toBe("Order with id: order_b was not found")
  })

  it("leaves a missing order to the core route", async () => {
    const err = await run(restrictStoreOrderToKey, orderReq(["sc_a"], orders, "order_x"))
    expect(err).toBe(undefined)
  })

  it("allows an order in any of several channels on the key", async () => {
    const err = await run(restrictStoreOrderToKey, orderReq(["sc_a", "sc_b"], orders, "order_b"))
    expect(err).toBe(undefined)
  })

  it("refuses when the key has no sales channel", async () => {
    const err: any = await run(restrictStoreOrderToKey, orderReq([], orders, "order_a"))
    expect(err.type).toBe("invalid_data")
  })

  it("refuses when the key context is missing", async () => {
    const err: any = await run(restrictStoreOrderToKey, orderReq(undefined, orders, "order_a"))
    expect(err.type).toBe("invalid_data")
  })
})
