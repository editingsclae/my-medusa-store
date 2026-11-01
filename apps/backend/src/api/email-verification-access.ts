import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import type { IAuthModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  VERIFICATION_METADATA_KEY,
  createKeyedLock,
  readState,
  writeState,
  type VerificationState,
} from "./email-verification"

// One request at a time per account (see createKeyedLock). The email
// confirmation and the password reset share it: both save into the same
// app_metadata, and two saves at once would overwrite each other.
export const verificationLock = createKeyedLock()

// Same default as Medusa's own jwtSecret, so a setup that runs on Medusa's
// defaults keeps working. Set JWT_SECRET in production.
export function verificationSecret(): string {
  return process.env.JWT_SECRET || "supersecret"
}

export type VerificationActor = {
  customerId: string
  identityId: string
}

// The logged-in customer and the auth identity behind the token
export function requireActor(req: AuthenticatedMedusaRequest): VerificationActor {
  const customerId = req.auth_context?.actor_id
  const identityId = req.auth_context?.auth_identity_id
  if (!customerId || !identityId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Log in first")
  }
  return { customerId, identityId }
}

export async function loadCustomerEmail(
  scope: MedusaContainer,
  customerId: string
): Promise<string> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { id: customerId },
  })
  const email = (data?.[0] as any)?.email
  if (typeof email !== "string" || email.trim() === "") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This account has no email address")
  }
  return email
}

// The state kept under `key` in the identity's app_metadata
export async function loadStateKey(
  scope: MedusaContainer,
  identityId: string,
  key: string
): Promise<VerificationState> {
  const auth = scope.resolve<IAuthModuleService>(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(identityId)
  return readState(identity.app_metadata, key)
}

// Saves the state under `key`. The rest of the identity's app_metadata (the link
// to the customer) is read again and sent back unchanged, like Medusa does when
// it sets that link.
export async function saveStateKey(
  scope: MedusaContainer,
  identityId: string,
  key: string,
  state: VerificationState
): Promise<void> {
  const auth = scope.resolve<IAuthModuleService>(Modules.AUTH)
  const identity = await auth.retrieveAuthIdentity(identityId)
  await auth.updateAuthIdentities({
    id: identityId,
    app_metadata: writeState(identity.app_metadata, state, key),
  })
}

export function loadVerificationState(
  scope: MedusaContainer,
  identityId: string
): Promise<VerificationState> {
  return loadStateKey(scope, identityId, VERIFICATION_METADATA_KEY)
}

export function saveVerificationState(
  scope: MedusaContainer,
  identityId: string,
  state: VerificationState
): Promise<void> {
  return saveStateKey(scope, identityId, VERIFICATION_METADATA_KEY, state)
}

// The name of the store of the publishable key, for the email
export async function loadStoreName(
  scope: MedusaContainer,
  salesChannelId: string | undefined
): Promise<string | null> {
  if (!salesChannelId) return null
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { id: salesChannelId },
  })
  const name = (data?.[0] as any)?.name
  return typeof name === "string" && name.trim() !== "" ? name : null
}
