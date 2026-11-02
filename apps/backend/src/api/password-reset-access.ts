import type { IAuthModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { isResettableFor, type IdentityKind } from "./password-reset"

export type ResettableIdentity = {
  identityId: string
  // The address exactly as the email provider stores it. Login and the password
  // update need this spelling.
  entityId: string
}

// The identity of the given kind that belongs to one of the addresses, or null.
// A shopper reset never returns a merchant (admin) login and a merchant reset
// never returns a shopper login: they share the email provider.
export async function findResettableIdentity(
  scope: MedusaContainer,
  emails: string[],
  kind: IdentityKind = "shopper"
): Promise<ResettableIdentity | null> {
  const auth = scope.resolve<IAuthModuleService>(Modules.AUTH)

  for (const email of emails) {
    const found = await auth.listProviderIdentities(
      { entity_id: email, provider: "emailpass" },
      { take: 1 }
    )
    const providerIdentity = found?.[0]
    if (!providerIdentity?.auth_identity_id) {
      continue
    }

    const identity = await auth.retrieveAuthIdentity(providerIdentity.auth_identity_id)
    if (isResettableFor(kind, identity.app_metadata)) {
      return { identityId: identity.id, entityId: providerIdentity.entity_id }
    }
  }
  return null
}

// Sets a new password with the email provider, which hashes it the same way as at
// registration. `entityId` is the address as the provider stores it. Used for
// shopper and merchant logins alike.
export async function setShopperPassword(
  scope: MedusaContainer,
  entityId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const auth = scope.resolve<IAuthModuleService>(Modules.AUTH)
  const result = await auth.updateProvider("emailpass", {
    entity_id: entityId,
    password,
  })
  return { success: !!result.success, error: result.error }
}
