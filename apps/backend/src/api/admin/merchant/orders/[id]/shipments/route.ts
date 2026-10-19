import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../../utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id
  const body = req.body as any

  // Verify order ownership and retrieve fulfillments
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "sales_channel_id",
      "items.id",
      "items.quantity",
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.items.id",
      "fulfillments.items.quantity",
      "fulfillments.items.line_item_id",
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
      "You do not have permission to ship this order"
    )
  }

  const fulfillmentId = body.fulfillment_id || order.fulfillments?.[0]?.id
  if (!fulfillmentId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No fulfillment found for this order to ship"
    )
  }

  const fulfillment = order.fulfillments?.find((f: any) => f.id === fulfillmentId)
  const items = body.items || (fulfillment?.items || []).map((fi: any) => ({
    id: fi.line_item_id || fi.id,
    quantity: fi.quantity,
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

  const { result } = await createOrderShipmentWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      fulfillment_id: fulfillmentId,
      items,
      labels,
    },
  })

  res.status(200).json({ shipment: result })
}
