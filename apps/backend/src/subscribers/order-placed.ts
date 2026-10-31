import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendOrderConfirmationWorkflow } from "../workflows/send-order-confirmation"

// Emails the shopper when an order is placed. This never makes placing an
// order fail: a problem is logged and the order stays as it is. Nothing is
// sent when Resend is not configured (no RESEND_API_KEY).
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!process.env.RESEND_API_KEY) {
    logger.info(`Order ${data.id}: no confirmation email, RESEND_API_KEY is not set`)
    return
  }

  try {
    await sendOrderConfirmationWorkflow(container).run({
      input: { id: data.id },
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    logger.error(`Order ${data.id}: the confirmation email was not sent: ${reason}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
