import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  sendNotificationsStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  buildOrderConfirmationNotification,
  ORDER_CONFIRMATION_FIELDS,
} from "./order-confirmation-notification"

type WorkflowInput = {
  id: string
}

// Sends the order confirmation email for an order. An order without a usable
// email address sends nothing.
export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  ({ id }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ORDER_CONFIRMATION_FIELDS,
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })

    const notifications = transform({ orders }, ({ orders }) => {
      const notification = buildOrderConfirmationNotification(orders[0] as any)
      return notification ? [notification] : []
    })

    const sent = sendNotificationsStep(notifications)

    return new WorkflowResponse(sent)
  }
)
