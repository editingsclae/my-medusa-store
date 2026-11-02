// The real database operations behind merchant creation (see merchant-creation.ts
// for the order of the steps and the clean up). Everything here is a thin wrapper
// around a Medusa workflow or module call.

import type { IAuthModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createSalesChannelsWorkflow,
  deleteSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  deleteStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  createApiKeysWorkflow,
  deleteApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  createUsersWorkflow,
  deleteUsersWorkflow,
  deleteShippingOptionsWorkflow,
  deleteFulfillmentSetsWorkflow,
} from "@medusajs/core-flows"
import { provisionMerchantFulfillment } from "../merchant/fulfillment"
import type { MerchantOps } from "./merchant-creation"

export function createMerchantOps(scope: MedusaContainer): MerchantOps {
  const auth = () => scope.resolve<IAuthModuleService>(Modules.AUTH)

  return {
    async userEmailExists(email) {
      const query = scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "user",
        fields: ["id"],
        filters: { email },
      })
      return data.length > 0
    },

    // Merchant logins and shopper logins share the email provider, so an email
    // that a shopper already uses cannot be registered again.
    async loginExists(email) {
      const found = await auth().listProviderIdentities(
        { entity_id: email, provider: "emailpass" },
        { take: 1 }
      )
      return (found?.length ?? 0) > 0
    },

    async createChannel(name, description) {
      const { result } = await createSalesChannelsWorkflow(scope).run({
        input: { salesChannelsData: [{ name, description }] },
      })
      return result[0]
    },
    deleteChannel(id) {
      return deleteSalesChannelsWorkflow(scope).run({ input: { ids: [id] } })
    },

    async createLocation(name) {
      const { result } = await createStockLocationsWorkflow(scope).run({
        input: { locations: [{ name }] },
      })
      return result[0]
    },
    deleteLocation(id) {
      return deleteStockLocationsWorkflow(scope).run({ input: { ids: [id] } })
    },
    linkLocationToChannel(locationId, channelId) {
      return linkSalesChannelsToStockLocationWorkflow(scope).run({
        input: { id: locationId, add: [channelId] },
      })
    },

    async provisionFulfillment(options) {
      try {
        return await provisionMerchantFulfillment(scope, options)
      } catch (err) {
        // A half made delivery setup would stop the backfill script from fixing
        // it later (it skips locations that already have a set), so remove it.
        await removeLeftoverFulfillmentSets(scope, options.stockLocationId).catch(
          () => undefined
        )
        throw err
      }
    },
    async deleteFulfillment({ shippingOptionId, fulfillmentSetId }) {
      if (shippingOptionId) {
        await deleteShippingOptionsWorkflow(scope).run({
          input: { ids: [shippingOptionId] },
        })
      }
      await deleteFulfillmentSetsWorkflow(scope).run({
        input: { ids: [fulfillmentSetId] },
      })
    },

    async createKey(title, createdBy) {
      const { result } = await createApiKeysWorkflow(scope).run({
        input: { api_keys: [{ title, type: "publishable", created_by: createdBy }] },
      })
      return result[0]
    },
    linkKeyToChannel(keyId, channelId) {
      return linkSalesChannelsToApiKeyWorkflow(scope).run({
        input: { id: keyId, add: [channelId] },
      })
    },
    deleteKey(id) {
      return deleteApiKeysWorkflow(scope).run({ input: { ids: [id] } })
    },

    async createUser(data) {
      const { result } = await createUsersWorkflow(scope).run({
        input: { users: [data] },
      })
      return result[0]
    },
    deleteUser(id) {
      return deleteUsersWorkflow(scope).run({ input: { ids: [id] } })
    },

    async registerLogin(email, password) {
      const res = await auth().register("emailpass", {
        body: { email, password },
      } as any)
      if (!res.success || !res.authIdentity) {
        throw new Error(res.error || "the email provider refused the registration")
      }
      return res.authIdentity
    },
    deleteLogin(id) {
      return auth().deleteAuthIdentities([id])
    },
    attachLoginToUser(loginId, userId) {
      return auth().updateAuthIdentities({
        id: loginId,
        app_metadata: { user_id: userId },
      })
    },

    report(message) {
      console.warn(message)
    },
  }
}

// Deletes the fulfillment sets still attached to a stock location.
async function removeLeftoverFulfillmentSets(
  scope: MedusaContainer,
  stockLocationId: string
): Promise<void> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.id"],
    filters: { id: stockLocationId },
  })
  const ids = ((data?.[0] as any)?.fulfillment_sets || []).map((s: any) => s.id)
  if (ids.length > 0) {
    await deleteFulfillmentSetsWorkflow(scope).run({ input: { ids } })
  }
}
