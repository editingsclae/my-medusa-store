import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../../utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "status",
      "payment_status",
      "fulfillment_status",
      "total",
      "subtotal",
      "tax_total",
      "shipping_total",
      "discount_total",
      "currency_code",
      "email",
      "sales_channel_id",
      "customer.id",
      "customer.first_name",
      "customer.last_name",
      "customer.email",
      "customer.phone",
      "shipping_address.*",
      "billing_address.*",
      "shipping_methods.*",
      "items.*",
      "items.variant.*",
      "fulfillments.*",
      "fulfillments.items.*",
      "fulfillments.labels.*",
      "payment_collections.payments.*",
    ],
    filters: {
      id: orderId,
    },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  // Verify ownership
  if (context.salesChannelId && order.sales_channel_id !== context.salesChannelId && !context.isSuperAdmin) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You do not have access to this order"
    )
  }

  res.json({ order })
}
