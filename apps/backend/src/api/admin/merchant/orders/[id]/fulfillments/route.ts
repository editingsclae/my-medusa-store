import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../../utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id
  const body = req.body as any

  // Verify order ownership
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "sales_channel_id",
      "items.id",
      "items.quantity",
      "shipping_methods.shipping_option_id",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  if (context.salesChannelId && order.sales_channel_id !== context.salesChannelId && !context.isSuperAdmin) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You do not have permission to fulfill this order"
    )
  }

  // Determine items to fulfill
  const orderItems = (order.items || []).filter(Boolean)
  const items = body.items || orderItems.map((i: any) => ({
    id: i.id,
    quantity: i.quantity,
  }))

  const labels = body.tracking_number
    ? [
        {
          tracking_number: String(body.tracking_number),
          tracking_url: String(body.tracking_url || ""),
          label_url: "",
        },
      ]
    : []

  const { result } = await createOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      items,
      location_id: body.location_id || context.stockLocationId,
      labels,
    },
  })

  res.status(201).json({ fulfillment: result })
}
