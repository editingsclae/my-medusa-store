// The notification sent when an order is placed. No framework imports, so it
// can be unit tested on its own.
import { EMAIL_TEMPLATES, type EmailOrder } from "../modules/resend/email-templates"

// The order fields to read for this email. Used by the workflow's query.
export const ORDER_CONFIRMATION_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "customer_id",
  "sales_channel.name",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.unit_price",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "shipping_address.phone",
  "shipping_methods.name",
  "item_subtotal",
  "shipping_subtotal",
  "discount_total",
  "tax_total",
  "total",
]

export type OrderConfirmationNotification = {
  to: string
  channel: "email"
  template: string
  data: { order: EmailOrder }
  trigger_type: string
  resource_id: string
  resource_type: string
  receiver_id: string | null
  idempotency_key: string
}

// Only what the email needs is stored with the notification. The rest of the
// order (billing address, payment details) is not copied into it.
export function pickOrder(order: EmailOrder): EmailOrder {
  return {
    id: order.id,
    display_id: order.display_id ?? null,
    email: order.email ?? null,
    currency_code: order.currency_code ?? null,
    customer_id: order.customer_id ?? null,
    sales_channel: order.sales_channel ? { name: order.sales_channel.name ?? null } : null,
    items: (order.items || []).map((item) => ({
      title: item.title ?? null,
      product_title: item.product_title ?? null,
      variant_title: item.variant_title ?? null,
      thumbnail: item.thumbnail ?? null,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
    shipping_address: order.shipping_address
      ? {
          first_name: order.shipping_address.first_name ?? null,
          last_name: order.shipping_address.last_name ?? null,
          address_1: order.shipping_address.address_1 ?? null,
          address_2: order.shipping_address.address_2 ?? null,
          city: order.shipping_address.city ?? null,
          province: order.shipping_address.province ?? null,
          postal_code: order.shipping_address.postal_code ?? null,
          country_code: order.shipping_address.country_code ?? null,
          phone: order.shipping_address.phone ?? null,
        }
      : null,
    shipping_methods: (order.shipping_methods || []).map((method) => ({
      name: method.name ?? null,
    })),
    item_subtotal: order.item_subtotal,
    shipping_subtotal: order.shipping_subtotal,
    discount_total: order.discount_total,
    tax_total: order.tax_total,
    total: order.total,
  }
}

// The notification for an order, or null when it cannot be sent (no order, or
// no usable email address: a guest order may have none). The idempotency key
// is the order id, so the same order never gets its confirmation twice.
export function buildOrderConfirmationNotification(
  order: EmailOrder | null | undefined
): OrderConfirmationNotification | null {
  if (!order || typeof order !== "object" || !order.id) {
    return null
  }

  const to = typeof order.email === "string" ? order.email.trim() : ""
  if (!/^[^\s@]+@[^\s@]+$/.test(to)) {
    return null
  }

  return {
    to,
    channel: "email",
    template: EMAIL_TEMPLATES.ORDER_PLACED,
    data: { order: pickOrder(order) },
    trigger_type: "order.placed",
    resource_id: order.id,
    resource_type: "order",
    receiver_id: order.customer_id ?? null,
    idempotency_key: `order-placed:${order.id}`,
  }
}
