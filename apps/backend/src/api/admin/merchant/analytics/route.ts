import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"
import {
  parseDays,
  periodStart,
  summarizeOrders,
  topProducts,
  type AnalyticsOrder,
} from "../analytics-rules"

// Orders are read page by page, so a shop with thousands of orders is counted in
// full. The limit is only a safety stop (200 pages = 100 000 orders).
const PAGE_SIZE = 500
const MAX_PAGES = 200

async function readAllOrders(
  query: any,
  fields: string[],
  filters: Record<string, any>
): Promise<AnalyticsOrder[]> {
  const orders: AnalyticsOrder[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await query.graph({
      entity: "order",
      fields,
      filters,
      pagination: { skip: page * PAGE_SIZE, take: PAGE_SIZE, order: { created_at: "ASC", id: "ASC" } },
    })
    orders.push(...(data as AnalyticsOrder[]))
    if (data.length < PAGE_SIZE) break
  }
  return orders
}

// GET /admin/merchant/analytics?days=7|30|90
// Revenue, orders, the daily chart and the top products cover the last `days`
// days. "All time" totals and the pending / shipped counts cover every order.
// Canceled orders are in none of these numbers.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const days = parseDays(req.query.days)
  const now = new Date()

  const filters: Record<string, any> = {
    // Canceled orders are not sales: they stay out of every number below
    status: { $nin: ["draft", "canceled"] },
  }

  if (context.salesChannelId) {
    filters["sales_channel_id"] = context.salesChannelId
  }

  // Every order, without its items: totals, the chart and the open work
  const orders = await readAllOrders(
    query,
    [
      "id",
      "total",
      "status",
      "created_at",
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
    ],
    filters
  )
  const summary = summarizeOrders(orders, days, now)

  // Only the orders of the period, with their items: the top products
  const periodOrders = await readAllOrders(
    query,
    ["id", "status", "created_at", "items.title", "items.quantity", "items.thumbnail"],
    { ...filters, created_at: { $gte: periodStart(days, now).toISOString() } }
  )
  const top = topProducts(periodOrders, days, now)

  // Lookup thumbnails from catalog if missing on order items
  try {
    const productFilters: Record<string, any> = {}
    if (context.salesChannelId) {
      productFilters["sales_channels"] = { id: context.salesChannelId }
    }
    const { data: catalogProducts } = await query.graph({
      entity: "product",
      fields: ["title", "thumbnail"],
      filters: productFilters,
    })
    const catalogThumbMap = new Map<string, string>()
    for (const p of catalogProducts) {
      if (p.title && p.thumbnail) {
        catalogThumbMap.set(p.title.toLowerCase().trim(), p.thumbnail)
      }
    }
    for (const p of top) {
      if (!p.thumbnail) {
        p.thumbnail = catalogThumbMap.get(p.title.toLowerCase().trim()) || null
      }
    }
  } catch (err) {
    console.warn("Could not match catalog thumbnails for top products:", err)
  }

  res.json({
    analytics: {
      days,
      ...summary,
      currency_code: context.currencyCode,
      top_products: top,
    },
  })
}
