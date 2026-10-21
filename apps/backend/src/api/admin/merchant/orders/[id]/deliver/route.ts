import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../../utils"
import { findForeignIds } from "../../../ownership"

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
      "fulfillments.id",
      "fulfillments.delivered_at",
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
      "You do not have permission to update this order"
    )
  }

  // The fulfillment in the body must belong to this order, otherwise a merchant
  // could mark another merchant's fulfillment as delivered.
  if (
    body.fulfillment_id &&
    findForeignIds(
      [body.fulfillment_id],
      (order.fulfillments || []).map((f: any) => f.id)
    ).length > 0
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Fulfillment does not belong to this order"
    )
  }

  const fulfillmentId = body.fulfillment_id || order.fulfillments?.[0]?.id
  if (!fulfillmentId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No fulfillment found for this order"
    )
  }

  const { result } = await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
    input: {
      orderId,
      fulfillmentId,
    },
  })

  res.status(200).json({ result })
}
