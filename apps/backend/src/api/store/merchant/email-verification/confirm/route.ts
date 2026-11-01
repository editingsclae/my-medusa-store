import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hashCode, planConfirm, MAX_ATTEMPTS } from "../../../../email-verification"
import {
  loadCustomerEmail,
  loadVerificationState,
  requireActor,
  saveVerificationState,
  verificationLock,
  verificationSecret,
} from "../../../../email-verification-access"

const MESSAGES = {
  invalid_format: "Enter the 6 digit code from the email.",
  no_code: "There is no code waiting. Ask for a new one.",
  code_expired: "This code has expired. Ask for a new one.",
  wrong_code: "This code is not right.",
  too_many_attempts: "Too many wrong tries. Ask for a new code.",
} as const

/**
 * POST /store/merchant/email-verification/confirm   { code: "123456" }
 *
 * Needs the customer's token. Confirms the customer's email when the code is
 * the one that was emailed. Spaces and dashes in the code are ignored.
 *
 * Answer: { verified: true }. Errors are { code, message }: 400 invalid_format /
 * no_code / code_expired / wrong_code (with attempts_left), 429
 * too_many_attempts.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { customerId, identityId } = requireActor(req)
  const email = await loadCustomerEmail(req.scope, customerId)
  const body = (req.body || {}) as { code?: unknown }

  await verificationLock(identityId, async () => {
    const state = await loadVerificationState(req.scope, identityId)
    const secret = verificationSecret()

    const plan = planConfirm(state, email, body.code, Date.now(), (code) =>
      hashCode(secret, identityId, email, code)
    )

    if (plan.state !== state) {
      await saveVerificationState(req.scope, identityId, plan.state)
    }

    if (plan.ok) {
      return res.json({ verified: true })
    }

    return res.status(plan.reason === "too_many_attempts" ? 429 : 400).json({
      code: plan.reason,
      message: MESSAGES[plan.reason],
      ...(plan.reason === "wrong_code"
        ? { attempts_left: plan.attemptsLeft ?? MAX_ATTEMPTS }
        : {}),
    })
  })
}
