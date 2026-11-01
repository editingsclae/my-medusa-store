import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"

export type SendCodeEmailInput = {
  to: string
  // A template of the Resend provider (email-verification, password-reset)
  template: string
  data: Record<string, unknown>
  trigger_type: string
  resource_id: string
  resource_type: string
  receiver_id?: string | null
}

// Sends one email that carries a 6 digit code. It throws when the email was not
// sent, so the caller can tell the shopper instead of counting the code as sent.
export const sendCodeEmailWorkflow = createWorkflow(
  "send-code-email",
  (input: SendCodeEmailInput) => {
    const notifications = transform({ input }, ({ input }) => [
      { ...input, channel: "email" },
    ])

    const sent = sendNotificationsStep(notifications)

    return new WorkflowResponse(sent)
  }
)
