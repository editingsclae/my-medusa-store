// The real operations behind a password reset (see password-reset-flow.ts for the
// steps). Thin wrappers around the auth module, the notification workflow and the
// state kept in the login's app_metadata.

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CODE_TTL_MS } from "./email-verification"
import {
  loadStateKey,
  loadVerificationState,
  saveStateKey,
  saveVerificationState,
  verificationLock,
  verificationSecret,
} from "./email-verification-access"
import {
  PASSWORD_RESET_METADATA_KEY,
  markVerifiedByReset,
  resetCodeHash,
  type IdentityKind,
} from "./password-reset"
import { findResettableIdentity, setShopperPassword } from "./password-reset-access"
import type { ResetOps } from "./password-reset-flow"
import { sendCodeEmailWorkflow } from "../workflows/send-code-email"

export function createResetOps(
  scope: MedusaContainer,
  options: {
    kind: IdentityKind
    // Named in the email: the shopper's store, or the platform for merchants
    storeName: string | null
  }
): ResetOps {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER)

  return {
    find: (emails) => findResettableIdentity(scope, emails, options.kind),
    lock: (identityId, job) => verificationLock(identityId, job),
    loadState: (identityId) => loadStateKey(scope, identityId, PASSWORD_RESET_METADATA_KEY),
    saveState: (identityId, state) =>
      saveStateKey(scope, identityId, PASSWORD_RESET_METADATA_KEY, state),

    async sendEmail(target, code) {
      await sendCodeEmailWorkflow(scope).run({
        input: {
          to: target.entityId,
          template: "password-reset",
          data: {
            code,
            store_name: options.storeName,
            expires_in_minutes: CODE_TTL_MS / 60000,
          },
          trigger_type: "password.reset",
          resource_id: target.identityId,
          resource_type: "auth_identity",
        },
      })
    },

    setPassword: (entityId, password) => setShopperPassword(scope, entityId, password),

    // A shopper who reads the code proves the mailbox is theirs, so the email
    // counts as confirmed. Merchant portal users have no email confirmation.
    afterReset:
      options.kind === "shopper"
        ? async (target, now) => {
            const verification = await loadVerificationState(scope, target.identityId)
            await saveVerificationState(
              scope,
              target.identityId,
              markVerifiedByReset(verification, target.entityId, now)
            )
          }
        : undefined,

    hash: (identityId, entityId, code) =>
      resetCodeHash(verificationSecret(), identityId, entityId, code),
    now: () => Date.now(),
    log: (message) => logger.error(message),
  }
}
