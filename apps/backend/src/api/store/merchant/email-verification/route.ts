import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { INotificationModuleService } from "@medusajs/framework/types"
import {
  CODE_TTL_MS,
  generateCode,
  hashCode,
  planSend,
  statusOf,
} from "../../../email-verification"
import {
  loadCustomerEmail,
  loadStoreName,
  loadVerificationState,
  requireActor,
  saveVerificationState,
  verificationLock,
  verificationSecret,
} from "../../../email-verification-access"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * GET /store/merchant/email-verification
 *
 * Needs the customer's token. Whether the logged-in customer's email is
 * confirmed, and whether a code is waiting.
 *
 * Answer: { email, verified, code_pending, can_resend_in, expires_in }
 * (the last two are seconds)
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { customerId, identityId } = requireActor(req)
  const email = await loadCustomerEmail(req.scope, customerId)
  const state = await loadVerificationState(req.scope, identityId)

  res.json({ email, ...statusOf(state, email, Date.now()) })
}

/**
 * POST /store/merchant/email-verification
 *
 * Needs the customer's token. Emails a new 6 digit code to the customer's
 * address, in the name of the store of the publishable key. A code works for 15
 * minutes; a new one can be asked for once a minute, 5 times an hour.
 *
 * Answer: { sent: true, can_resend_in, expires_in }, or { verified: true } when
 * the email is already confirmed. Errors are { code, message }:
 * 429 too_soon / too_many (with retry_after), 503 email_unavailable.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { customerId, identityId } = requireActor(req)
  const email = await loadCustomerEmail(req.scope, customerId)
  const channelIds = salesChannelIdsFromKey(req)

  await verificationLock(identityId, async () => {
    const state = await loadVerificationState(req.scope, identityId)
    const now = Date.now()

    const code = generateCode()
    const plan = planSend(state, email, now, hashCode(verificationSecret(), identityId, email, code))

    if (!plan.ok) {
      if (plan.reason === "already_verified") {
        return res.json({ verified: true })
      }
      return res.status(429).json({
        code: plan.reason,
        message:
          plan.reason === "too_soon"
            ? "A code was sent a moment ago. Please wait before asking for another one."
            : "Too many codes were asked for. Please try again later.",
        retry_after: plan.retryAfter,
      })
    }

    // The state is saved only when the email was really sent: a shopper whose
    // email failed is not made to wait for nothing.
    try {
      const storeName = await loadStoreName(req.scope, channelIds[0])
      const notifications = req.scope.resolve<INotificationModuleService>(Modules.NOTIFICATION)
      await notifications.createNotifications({
        to: email,
        channel: "email",
        template: "email-verification",
        data: {
          code,
          store_name: storeName,
          expires_in_minutes: CODE_TTL_MS / 60000,
        },
        trigger_type: "email.verification",
        resource_id: customerId,
        resource_type: "customer",
        receiver_id: customerId,
      })
    } catch (e) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
      logger.error(
        `Email verification code for customer ${customerId} was not sent: ${
          e instanceof Error ? e.message : String(e)
        }`
      )
      return res.status(503).json({
        code: "email_unavailable",
        message: "We could not send the email right now. Please try again in a moment.",
      })
    }

    await saveVerificationState(req.scope, identityId, plan.state)

    const status = statusOf(plan.state, email, now)
    return res.json({
      sent: true,
      can_resend_in: status.can_resend_in,
      expires_in: status.expires_in,
    })
  })
}
