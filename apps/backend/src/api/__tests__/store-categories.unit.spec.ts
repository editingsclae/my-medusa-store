import { buildStoreCategories } from "../store-categories"
import { GET } from "../store/merchant/categories/route"

const prefixA = "sc_a--"
const prefixB = "sc_b--"

const categories = [
  { id: "cat_shirts", name: "Shirts", handle: `${prefixA}shirts`, description: "Tops", rank: 1, is_active: true, is_internal: false },
  { id: "cat_pants", name: "Pants", handle: `${prefixA}pants`, description: null, rank: 0, is_active: true, is_internal: false },
  { id: "cat_hidden", name: "Hidden", handle: `${prefixA}hidden`, rank: 2, is_active: false, is_internal: false },
  { id: "cat_internal", name: "Internal", handle: `${prefixA}internal`, rank: 3, is_active: true, is_internal: true },
  { id: "cat_other", name: "Shirts", handle: `${prefixB}shirts`, rank: 0, is_active: true, is_internal: false },
]

const links = [
  { sales_channel_id: "sc_a", product_category_id: "cat_shirts" },
  { sales_channel_id: "sc_a", product_category_id: "cat_pants" },
  { sales_channel_id: "sc_a", product_category_id: "cat_hidden" },
  { sales_channel_id: "sc_a", product_category_id: "cat_internal" },
]

const products = [
  { id: "p1", categories: [{ id: "cat_shirts" }] },
  { id: "p2", categories: [{ id: "cat_shirts" }, { id: "cat_shirts" }] },
  { id: "p3", categories: [] },
  { id: "p4" },
]

describe("buildStoreCategories", () => {
  it("returns only linked, active, non-internal categories", () => {
    const result = buildStoreCategories({ links, categories, products })
    expect(result.map((c) => c.id)).toEqual(["cat_pants", "cat_shirts"])
  })

  it("never returns a category of another merchant", () => {
    const result = buildStoreCategories({ links, categories, products })
    expect(result.some((c) => c.id === "cat_other")).toBe(false)
  })

  it("strips the channel prefix from handles", () => {
    const result = buildStoreCategories({ links, categories, products })
    expect(result.map((c) => c.handle)).toEqual(["pants", "shirts"])
  })

  it("counts each product once per category", () => {
    const result = buildStoreCategories({ links, categories, products })
    expect(result.find((c) => c.id === "cat_shirts")?.product_count).toBe(2)
    expect(result.find((c) => c.id === "cat_pants")?.product_count).toBe(0)
  })

  it("sorts by rank, then by name", () => {
    const sameRank = [
      { ...categories[0], rank: 0 },
      { ...categories[1], rank: 0 },
    ]
    const result = buildStoreCategories({ links, categories: sameRank, products: [] })
    expect(result.map((c) => c.name)).toEqual(["Pants", "Shirts"])
  })

  it("finds one category by its public handle", () => {
    const result = buildStoreCategories({ links, categories, products, handle: "shirts" })
    expect(result.map((c) => c.id)).toEqual(["cat_shirts"])
  })

  it("does not match a handle through the stored prefix", () => {
    const result = buildStoreCategories({ links, categories, products, handle: `${prefixA}shirts` })
    expect(result).toEqual([])
  })

  it("can leave out categories with no published products", () => {
    const result = buildStoreCategories({ links, categories, products, hideEmpty: true })
    expect(result.map((c) => c.id)).toEqual(["cat_shirts"])
  })

  it("fills missing description and rank with null", () => {
    const result = buildStoreCategories({
      links: [{ sales_channel_id: "sc_a", product_category_id: "x" }],
      categories: [{ id: "x", name: "X", handle: `${prefixA}x`, is_active: true }],
      products: [],
    })
    expect(result).toEqual([{ id: "x", name: "X", handle: "x", description: null, rank: null, product_count: 0 }])
  })

  it("returns nothing when nothing is linked", () => {
    expect(buildStoreCategories({ links: [], categories, products })).toEqual([])
  })
})

function routeReq(channelIds: string[] | undefined, rows: Record<string, any[]>, query: Record<string, unknown> = {}) {
  const graphCalls: any[] = []
  const req: any = {
    query,
    publishable_key_context: channelIds ? { key: "pk", sales_channel_ids: channelIds } : undefined,
    scope: {
      resolve: () => ({
        graph: async (args: any) => {
          graphCalls.push(args)
          const key = args.entity === "product_category" || args.entity === "product" ? args.entity : "link"
          return { data: rows[key] || [] }
        },
      }),
    },
    graphCalls,
  }
  return req
}

function routeRes() {
  const res: any = { body: undefined }
  res.json = (body: unknown) => {
    res.body = body
    return res
  }
  return res
}

describe("GET /store/merchant/categories", () => {
  const rows = { link: links, product_category: categories, product: products }

  it("returns the merchant's categories for the key", async () => {
    const res = routeRes()
    await GET(routeReq(["sc_a"], rows), res)
    expect(res.body.count).toBe(2)
    expect(res.body.categories.map((c: any) => c.handle)).toEqual(["pants", "shirts"])
  })

  it("only asks for published products of the key's channels", async () => {
    const req = routeReq(["sc_a"], rows)
    await GET(req, routeRes())
    const productCall = req.graphCalls.find((call: any) => call.entity === "product")
    expect(productCall.filters.status).toBe("published")
    expect(productCall.filters.sales_channels).toEqual({ id: ["sc_a"] })
  })

  it("returns an empty list when the merchant has no categories", async () => {
    const res = routeRes()
    await GET(routeReq(["sc_a"], { ...rows, link: [] }), res)
    expect(res.body).toEqual({ categories: [], count: 0 })
  })

  it("passes the handle and hide_empty options through", async () => {
    const res = routeRes()
    await GET(routeReq(["sc_a"], rows, { handle: "shirts", hide_empty: "true" }), res)
    expect(res.body.categories.map((c: any) => c.id)).toEqual(["cat_shirts"])
  })

  it("rejects a request without a key context", async () => {
    await expect(GET(routeReq(undefined, rows), routeRes())).rejects.toThrow("Publishable key")
  })
})
