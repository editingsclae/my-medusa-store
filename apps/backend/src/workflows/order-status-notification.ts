// The emails sent when an order is shipped or canceled. No framework imports, so
// they can be unit tested on their own. They use the same order fields and the
// same shape as the order confirmation.
import { EMAIL_TEMPLATES, type EmailOrder } from "../modules/resend/email-templates"
import { pickOrder, type OrderConfirmationNotification } from "./order-confirmation-notification"

export type OrderStatusKind = "shipped" | "canceled"

const KINDS = {
  shipped: { template: EMAIL_TEMPLATES.ORDER_SHIPPED, trigger: "order.shipped", key: "order-shipped" },
  canceled: { template: EMAIL_TEMPLATES.ORDER_CANCELED, trigger: "order.canceled", key: "order-canceled" },
} as const

// The notification for an order that was shipped or canceled, or null when it
// cannot be sent (no order, or no usable email address: a guest order may have
// none). The idempotency key holds the order id, so one order never gets the
// same email twice, even when the event arrives twice.
export function buildOrderStatusNotification(
  kind: OrderStatusKind,
  order: EmailOrder | null | undefined
): OrderConfirmationNotification | null {
  if (!order || typeof order !== "object" || !order.id) {
    return null
  }

  const to = typeof order.email === "string" ? order.email.trim() : ""
  if (!/^[^\s@]+@[^\s@]+$/.test(to)) {
    return null
  }

  const spec = KINDS[kind]
  return {
    to,
    channel: "email",
    template: spec.template,
    data: { order: pickOrder(order) },
    trigger_type: spec.trigger,
    resource_id: order.id,
    resource_type: "order",
    receiver_id: order.customer_id ?? null,
    idempotency_key: `${spec.key}:${order.id}`,
  }
}
