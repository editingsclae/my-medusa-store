import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createResetOps } from "../../password-reset-ops"
import { confirmReset } from "../../password-reset-flow"

const INVALID_CODE = {
  code: "invalid_code",
  message: "That code is not right or has expired. Ask for a new one.",
}

/**
 * POST /auth/merchant-password-reset-confirm   { email, code, password }
 *
 * For the merchant portal. Public, like /auth/merchant-password-reset. Sets a new
 * password for a merchant portal login when the code is the one that was
 * emailed. The code is used up.
 *
 * Answer: { reset: true, email } where email is the address to sign in with.
 * Errors are { code, message }: 400 weak_password (checked first, nothing is
 * counted) and 400 invalid_code, which is the same for an unknown email, no
 * code, a wrong code, an expired code and too many tries.
 *
 * Tokens already issued stay valid until they expire: Medusa tokens cannot be
 * revoked.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const ops = createResetOps(req.scope, { kind: "merchant", storeName: null })

  const outcome = await confirmReset(ops, (req.body || {}) as Record<string, unknown>)

  switch (outcome.status) {
    case "weak_password":
      return res.status(400).json({ code: "weak_password", message: outcome.message })
    case "invalid_code":
      return res.status(400).json(INVALID_CODE)
    case "failed":
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "We could not change the password. Ask for a new code and try again."
      )
    default:
      return res.json({ reset: true, email: outcome.email })
  }
}
