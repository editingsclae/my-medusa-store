import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const filters: Record<string, any> = {
    status: { $nin: ["draft"] },
  }

  if (context.salesChannelId) {
    filters["sales_channel_id"] = context.salesChannelId
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "total",
      "status",
      "fulfillments.id",
      "created_at",
      "currency_code",
      "items.title",
      "items.quantity",
    ],
    filters,
    pagination: {
      take: 1000,
      order: {
        created_at: "ASC",
      },
    },
  })

  let totalSales = 0
  let pendingOrders = 0
  let fulfilledOrders = 0
  const dailyMap: Record<string, { date: string; sales: number; count: number }> = {}

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split("T")[0]
    dailyMap[key] = { date: key, sales: 0, count: 0 }
  }

  const productSalesMap: Record<string, { title: string; quantity: number }> = {}

  for (const order of orders) {
    const total = Number(order.total) || 0
    totalSales += total

    const orderFulfillments = (order as any).fulfillments
    const hasFulfillment = Array.isArray(orderFulfillments) && orderFulfillments.length > 0

    if (order.status === "pending" || !hasFulfillment) {
      pendingOrders++
    }
    if (hasFulfillment) {
      fulfilledOrders++
    }

    const dayKey = new Date(order.created_at).toISOString().split("T")[0]
    if (dailyMap[dayKey]) {
      dailyMap[dayKey].sales += total
      dailyMap[dayKey].count += 1
    }

    for (const item of ((order.items || []) as any[])) {
      if (!item || !item.title) continue
      if (!productSalesMap[item.title]) {
        productSalesMap[item.title] = { title: item.title, quantity: 0 }
      }
      productSalesMap[item.title].quantity += Number(item.quantity) || 0
    }
  }

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  res.json({
    analytics: {
      total_sales: totalSales,
      total_orders: orders.length,
      pending_orders: pendingOrders,
      fulfilled_orders: fulfilledOrders,
      currency_code: context.currencyCode,
      daily_sales: Object.values(dailyMap),
      top_products: topProducts,
    },
  })
}
