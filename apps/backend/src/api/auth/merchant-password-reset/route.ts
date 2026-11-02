import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RESEND_COOLDOWN_MS } from "../../email-verification"
import { createResetOps } from "../../password-reset-ops"
import { requestReset } from "../../password-reset-flow"

// The name in the email. Merchants belong to the platform, not to one store.
const PLATFORM_NAME = process.env.PLATFORM_NAME || "GetCardy"

/**
 * POST /auth/merchant-password-reset   { email }
 *
 * For the merchant portal. Public (no login, no publishable key), like Medusa's
 * own /auth routes, which also gives it the auth CORS settings. When the email
 * belongs to a merchant portal login, a 6 digit code is emailed. Shopper logins
 * are never touched here. The answer is the same whether or not there is an
 * account, and it does not wait for the email.
 *
 * Answer: { sent: true, can_resend_in } (seconds). 400 when the email is not an
 * email address.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const ops = createResetOps(req.scope, { kind: "merchant", storeName: PLATFORM_NAME })

  const { outcome } = await requestReset(ops, (req.body as { email?: unknown } | undefined)?.email)
  if (outcome === "invalid_email") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Enter a valid email address")
  }

  res.json({ sent: true, can_resend_in: RESEND_COOLDOWN_MS / 1000 })
}
