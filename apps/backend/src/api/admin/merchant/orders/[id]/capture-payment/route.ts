import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../../utils"
import { findForeignIds } from "../../../ownership"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id
  const body = req.body as any

  // Verify order ownership and find payment
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "sales_channel_id",
      "payment_collections.payments.id",
      "payment_collections.payments.amount",
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
      "You do not have permission to capture payment for this order"
    )
  }

  const payments = (order.payment_collections || []).flatMap((pc: any) => pc.payments || [])

  // A payment id in the body must belong to this order, otherwise a merchant
  // could capture a payment that was made on another merchant's order.
  if (
    body.payment_id &&
    findForeignIds([body.payment_id], payments.map((p: any) => p.id)).length > 0
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment does not belong to this order"
    )
  }

  const paymentId = body.payment_id || payments[0]?.id

  if (!paymentId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No payment found for this order"
    )
  }

  const { result } = await capturePaymentWorkflow(req.scope).run({
    input: {
      payment_id: paymentId,
      amount: body.amount,
      captured_by: context.user.id,
    },
  })

  res.status(200).json({ payment: result })
}
