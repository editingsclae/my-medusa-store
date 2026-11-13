import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendOrderStatusWorkflow } from "../workflows/send-order-status"

// Emails the shopper when an order is canceled. This never makes the
// cancellation fail: a problem is logged and the order stays canceled. Nothing
// is sent when Resend is not configured (no RESEND_API_KEY).
export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!process.env.RESEND_API_KEY) {
    logger.info(`Order ${data.id}: no canceled email, RESEND_API_KEY is not set`)
    return
  }

  try {
    await sendOrderStatusWorkflow(container).run({
      input: { id: data.id, kind: "canceled" },
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    logger.error(`Order ${data.id}: the canceled email was not sent: ${reason}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
