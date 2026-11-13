import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  sendNotificationsStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { ORDER_CONFIRMATION_FIELDS } from "./order-confirmation-notification"
import { buildOrderStatusNotification, type OrderStatusKind } from "./order-status-notification"

type WorkflowInput = {
  id: string
  kind: OrderStatusKind
}

// Sends the "shipped" or "canceled" email for an order. An order without a
// usable email address sends nothing.
export const sendOrderStatusWorkflow = createWorkflow(
  "send-order-status",
  ({ id, kind }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ORDER_CONFIRMATION_FIELDS,
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })

    const notifications = transform({ orders, kind }, ({ orders, kind }) => {
      const notification = buildOrderStatusNotification(kind, orders[0] as any)
      return notification ? [notification] : []
    })

    const sent = sendNotificationsStep(notifications)

    return new WorkflowResponse(sent)
  }
)
