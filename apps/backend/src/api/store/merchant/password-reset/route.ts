import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RESEND_COOLDOWN_MS } from "../../../email-verification"
import { loadStoreName } from "../../../email-verification-access"
import { createResetOps } from "../../../password-reset-ops"
import { requestReset } from "../../../password-reset-flow"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * POST /store/merchant/password-reset   { email }
 *
 * No login needed (the publishable key is). When the email belongs to a shopper
 * account, a 6 digit code is emailed in the name of the store of the key. The
 * answer is the same whether or not there is an account, and it does not wait
 * for the email, so neither the answer nor its speed tells who has an account.
 *
 * Answer: { sent: true, can_resend_in } (seconds). 400 when the email is not an
 * email address.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)

  // Looked up for every request, so the work done does not depend on the answer
  const storeName = await loadStoreName(req.scope, channelIds[0])
  const ops = createResetOps(req.scope, { kind: "shopper", storeName })

  const { outcome } = await requestReset(ops, (req.body as { email?: unknown } | undefined)?.email)
  if (outcome === "invalid_email") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Enter a valid email address")
  }

  res.json({ sent: true, can_resend_in: RESEND_COOLDOWN_MS / 1000 })
}
