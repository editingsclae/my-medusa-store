import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendOrderStatusWorkflow } from "../workflows/send-order-status"

// Emails the shopper when an order is shipped. Medusa's shipment.created event
// carries the fulfillment id (data.id), not the order id, so the order is looked
// up through the order <-> fulfillment link. This never makes marking an order as
// shipped fail: a problem is logged and the shipment stays. Nothing is sent when
// Resend is not configured (no RESEND_API_KEY) or when the shipment was created
// with no_notification.
export default async function orderShippedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; order_id?: string; no_notification?: boolean }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (data.no_notification) {
    return
  }

  if (!process.env.RESEND_API_KEY) {
    logger.info(`Shipment ${data.id}: no shipped email, RESEND_API_KEY is not set`)
    return
  }

  try {
    let orderId = data.order_id
    if (!orderId) {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: links } = await query.graph({
        entity: "order_fulfillment",
        fields: ["order_id", "fulfillment_id"],
        filters: { fulfillment_id: data.id },
      })
      orderId = (links?.[0] as { order_id?: string } | undefined)?.order_id
    }

    if (!orderId) {
      logger.warn(`Shipment ${data.id}: no order found for it, no shipped email`)
      return
    }

    await sendOrderStatusWorkflow(container).run({
      input: { id: orderId, kind: "shipped" },
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    logger.error(`Shipment ${data.id}: the shipped email was not sent: ${reason}`)
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
