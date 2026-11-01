import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  generateCode,
  planSend,
} from "../../../email-verification"
import {
  loadStateKey,
  loadStoreName,
  saveStateKey,
  verificationLock,
  verificationSecret,
} from "../../../email-verification-access"
import {
  PASSWORD_RESET_METADATA_KEY,
  emailCandidates,
  parseEmail,
  forReset,
  resetCodeHash,
} from "../../../password-reset"
import { findResettableIdentity } from "../../../password-reset-access"
import { salesChannelIdsFromKey } from "../../../store-key"
import { sendCodeEmailWorkflow } from "../../../../workflows/send-code-email"

type Target = { identityId: string; entityId: string }

// Emails a code, unless the account asked for one a moment ago or too many times
// (then nothing is sent and nothing is said). The state is saved only when the
// email was really sent.
async function sendResetCode(
  scope: MedusaContainer,
  target: Target,
  storeName: string | null
): Promise<void> {
  await verificationLock(target.identityId, async () => {
    const state = forReset(
      await loadStateKey(scope, target.identityId, PASSWORD_RESET_METADATA_KEY)
    )
    const now = Date.now()
    const code = generateCode()
    const plan = planSend(
      state,
      target.entityId,
      now,
      resetCodeHash(verificationSecret(), target.identityId, target.entityId, code)
    )
    if (!plan.ok) {
      return
    }

    await sendCodeEmailWorkflow(scope).run({
      input: {
        to: target.entityId,
        template: "password-reset",
        data: {
          code,
          store_name: storeName,
          expires_in_minutes: CODE_TTL_MS / 60000,
        },
        trigger_type: "password.reset",
        resource_id: target.identityId,
        resource_type: "auth_identity",
      },
    })

    await saveStateKey(scope, target.identityId, PASSWORD_RESET_METADATA_KEY, plan.state)
  })
}

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
  const email = parseEmail((req.body as { email?: unknown } | undefined)?.email)
  if (!email) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Enter a valid email address")
  }

  const channelIds = salesChannelIdsFromKey(req)
  const scope = req.scope
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)

  // Looked up for every request, so the work done does not depend on the answer
  const storeName = await loadStoreName(scope, channelIds[0])
  const target = await findResettableIdentity(scope, emailCandidates(email))

  if (target) {
    sendResetCode(scope, target, storeName).catch((e) => {
      logger.error(
        `Password reset code for identity ${target.identityId} was not sent: ${
          e instanceof Error ? e.message : String(e)
        }`
      )
    })
  }

  res.json({ sent: true, can_resend_in: RESEND_COOLDOWN_MS / 1000 })
}
