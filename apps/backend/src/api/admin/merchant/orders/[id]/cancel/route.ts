import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  cancelOrderFulfillmentWorkflow,
  cancelOrderWorkflow,
} from "@medusajs/core-flows"
import { getMerchantContext } from "../../../utils"

// A merchant cancels one of the orders of their own store, as long as nothing was
// shipped yet. Medusa itself refuses to cancel an order that still has an active
// fulfillment, so the open fulfillments are canceled first (this also puts the
// stock back); then the order is canceled (uncaptured payments are canceled,
// captured ones are refunded).
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "sales_channel_id",
      "fulfillments.id",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  if (
    context.salesChannelId &&
    order.sales_channel_id !== context.salesChannelId &&
    !context.isSuperAdmin
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You do not have permission to cancel this order"
    )
  }

  if (order.status === "canceled") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This order is already canceled"
    )
  }

  const activeFulfillments = ((order.fulfillments || []) as any[]).filter(
    (f) => f && !f.canceled_at
  )

  if (activeFulfillments.some((f) => f.shipped_at || f.delivered_at)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This order was already shipped, so it can no longer be canceled."
    )
  }

  for (const fulfillment of activeFulfillments) {
    await cancelOrderFulfillmentWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        fulfillment_id: fulfillment.id,
        canceled_by: context.user.id,
      },
    })
  }

  await cancelOrderWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      canceled_by: context.user.id,
    },
  })

  res.status(200).json({ order: { id: orderId, status: "canceled" } })
}
