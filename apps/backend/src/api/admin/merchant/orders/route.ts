import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0
  const status = req.query.status as string | undefined

  const filters: Record<string, any> = {
    status: { $nin: ["draft"] },
  }

  if (context.salesChannelId) {
    filters["sales_channel_id"] = context.salesChannelId
  }

  if (status) {
    filters["status"] = status
  }

  const { data: orders, metadata } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "updated_at",
      "status",
      "payment_status",
      "fulfillment_status",
      "total",
      "currency_code",
      "email",
      "sales_channel.id",
      "sales_channel.name",
      "customer.id",
      "customer.first_name",
      "customer.last_name",
      "customer.email",
      "shipping_address.*",
      "items.id",
      "items.title",
      "items.thumbnail",
      "items.quantity",
      "items.unit_price",
      "fulfillments.*",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.captured_amount",
      "payment_collections.payments.captures.id",
      "payment_collections.payments.captures.amount",
    ],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: {
        created_at: "DESC",
      },
    },
  })

  // Compute live aggregated payment_status
  const formattedOrders = (orders || []).map((ord: any) => {
    const pcs = ord.payment_collections || []
    const totalCaptured = pcs.reduce((s: number, pc: any) => s + (Number(pc.captured_amount) || 0), 0)
    const hasCaptures = pcs.some((pc: any) => (pc.payments || []).some((p: any) => (p.captures || []).length > 0))
    const isCaptured = 
      pcs.some((pc: any) => pc.status === "captured") || 
      (totalCaptured > 0 && totalCaptured >= (ord.total || 0)) ||
      (hasCaptures && totalCaptured > 0)
    
    return {
      ...ord,
      payment_status: isCaptured ? "captured" : (ord.payment_status || "authorized"),
    }
  })

  res.json({
    orders: formattedOrders,
    count: metadata?.count ?? orders.length,
    limit,
    offset,
  })
}
