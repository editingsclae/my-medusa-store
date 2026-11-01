import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  loadStateKey,
  loadVerificationState,
  saveStateKey,
  saveVerificationState,
  verificationLock,
  verificationSecret,
} from "../../../../email-verification-access"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_METADATA_KEY,
  checkPassword,
  emailCandidates,
  forReset,
  markVerifiedByReset,
  parseEmail,
  planResetConfirm,
  resetCodeHash,
} from "../../../../password-reset"
import {
  findResettableIdentity,
  setShopperPassword,
} from "../../../../password-reset-access"
import { salesChannelIdsFromKey } from "../../../../store-key"

const INVALID_CODE = {
  code: "invalid_code",
  message: "That code is not right or has expired. Ask for a new one.",
}

/**
 * POST /store/merchant/password-reset/confirm   { email, code, password }
 *
 * No login needed (the publishable key is). Sets a new password when the code is
 * the one that was emailed. The code is used up. The email counts as confirmed
 * afterwards, because the shopper read it.
 *
 * Answer: { reset: true, email } where email is the address to log in with.
 * Errors are { code, message }: 400 weak_password (checked first, nothing is
 * counted) and 400 invalid_code, which is the same for an unknown email, no
 * code, a wrong code, an expired code and too many tries.
 *
 * Passwords already issued as tokens stay valid until they expire: Medusa
 * tokens cannot be revoked.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  salesChannelIdsFromKey(req)
  const body = (req.body || {}) as { email?: unknown; code?: unknown; password?: unknown }

  const password = checkPassword(body.password)
  if (!password.ok) {
    return res.status(400).json({
      code: "weak_password",
      message:
        password.reason === "too_long"
          ? `The password can have at most ${MAX_PASSWORD_LENGTH} characters.`
          : `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
    })
  }

  const email = parseEmail(body.email)
  if (!email) {
    return res.status(400).json(INVALID_CODE)
  }

  const scope = req.scope
  const target = await findResettableIdentity(scope, emailCandidates(email))
  if (!target) {
    return res.status(400).json(INVALID_CODE)
  }

  await verificationLock(target.identityId, async () => {
    const secret = verificationSecret()
    const state = forReset(
      await loadStateKey(scope, target.identityId, PASSWORD_RESET_METADATA_KEY)
    )
    const now = Date.now()

    const plan = planResetConfirm(state, target.entityId, body.code, now, (code) =>
      resetCodeHash(secret, target.identityId, target.entityId, code)
    )

    // A try that was counted, or a code that is used up, is saved before
    // anything else, so a code can only be used once
    if (plan.ok || (plan.reason !== "invalid_format" && plan.reason !== "no_code")) {
      await saveStateKey(scope, target.identityId, PASSWORD_RESET_METADATA_KEY, plan.state)
    }

    if (!plan.ok) {
      return res.status(400).json(INVALID_CODE)
    }

    const result = await setShopperPassword(scope, target.entityId, password.password)

    if (!result.success) {
      const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)
      logger.error(
        `Password reset for identity ${target.identityId} failed: ${result.error ?? "unknown error"}`
      )
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "We could not change the password. Ask for a new code and try again."
      )
    }

    const verification = await loadVerificationState(scope, target.identityId)
    await saveVerificationState(
      scope,
      target.identityId,
      markVerifiedByReset(verification, target.entityId, now)
    )

    return res.json({ reset: true, email: target.entityId })
  })
}
