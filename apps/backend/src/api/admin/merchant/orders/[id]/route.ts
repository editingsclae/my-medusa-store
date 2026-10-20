import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getOrderDetailWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const orderId = req.params.id

  let order: any
  try {
    const workflow = getOrderDetailWorkflow(req.scope)
    const { result } = await workflow.run({
      input: {
        order_id: orderId,
        fields: [
          "id",
          "display_id",
          "created_at",
          "status",
          "payment_status",
          "fulfillment_status",
          "total",
          "subtotal",
          "item_subtotal",
          "item_total",
          "item_tax_total",
          "original_total",
          "tax_total",
          "shipping_total",
          "shipping_subtotal",
          "discount_total",
          "currency_code",
          "email",
          "sales_channel_id",
          "sales_channel.id",
          "sales_channel.name",
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
          "payment_collections.*",
          "payment_collections.payments.*",
          "payment_collections.payments.captures.*",
          "payment_collections.payments.refunds.*",
        ],
      },
    })
    order = result
  } catch (err: any) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order not found: ${err?.message || orderId}`)
  }

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
