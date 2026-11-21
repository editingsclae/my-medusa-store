// What a storefront may show about an order's tracking numbers.
//
// Medusa's own GET /store/orders/:id does not return the shipment labels where
// the tracking number is kept, so a small route of ours reads them. The order id
// is the only thing the customer holds (the same as for the core route), and the
// order must belong to the merchant of the request's publishable key.

export const ORDER_TRACKING_FIELDS = [
  "id",
  "sales_channel_id",
  "fulfillments.canceled_at",
  "fulfillments.labels.tracking_number",
]

type OrderWithLabels = {
  sales_channel_id?: string | null
  fulfillments?: Array<{
    canceled_at?: string | Date | null
    labels?: Array<{ tracking_number?: unknown } | null> | null
  } | null> | null
}

const MAX_NUMBERS = 5
const MAX_LENGTH = 100

function oneLine(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH)
}

/**
 * The tracking numbers of the order, without duplicates, at most 5.
 * Returns null when there is no such order or it belongs to another merchant
 * (the route answers not found, so one merchant cannot probe another's orders).
 * A fulfillment that was canceled no longer counts. Empty list: nothing entered.
 */
export function trackingNumbersForOrder(
  order: OrderWithLabels | null | undefined,
  channelIds: string[]
): string[] | null {
  if (!order || !order.sales_channel_id || !channelIds.includes(order.sales_channel_id)) {
    return null
  }

  const found: string[] = []
  for (const fulfillment of order.fulfillments || []) {
    if (!fulfillment || fulfillment.canceled_at) {
      continue
    }
    for (const label of fulfillment.labels || []) {
      const value = oneLine(label?.tracking_number)
      if (value && !found.includes(value)) {
        found.push(value)
      }
    }
  }
  return found.slice(0, MAX_NUMBERS)
}
