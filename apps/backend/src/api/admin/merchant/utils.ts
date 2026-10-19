import { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

export interface MerchantContext {
  user: {
    id: string
    email: string
    first_name?: string | null
    last_name?: string | null
    metadata?: Record<string, any> | null
  }
  isSuperAdmin: boolean
  salesChannelId: string
  salesChannel?: any
  stockLocationId?: string
  currencyCode: string
}

export async function getMerchantContext(req: MedusaRequest): Promise<MerchantContext> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const storeService = req.scope.resolve(Modules.STORE)

  const userId = (req as any).auth_context?.actor_id
  if (!userId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Unauthorized: User session required"
    )
  }

  const { data: users } = await query.graph({
    entity: "user",
    fields: ["id", "email", "first_name", "last_name", "metadata"],
    filters: { id: userId },
  })

  const user = users?.[0]
  if (!user) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "User account not found"
    )
  }

  // Determine if this is a platform super-admin or a scoped merchant
  const isSuperAdmin = !user.metadata?.sales_channel_id || user.metadata?.role === "admin"

  // If super-admin, allow passing a ?sales_channel_id query param to impersonate / view a specific merchant
  const requestedChannelId = req.query?.sales_channel_id as string | undefined
  const salesChannelId = (isSuperAdmin && requestedChannelId)
    ? requestedChannelId
    : (user.metadata?.sales_channel_id as string)

  if (!salesChannelId && !isSuperAdmin) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "No sales channel associated with this merchant account"
    )
  }

  // Fetch sales channel info if channel ID is present
  let salesChannel: any = null
  let resolvedStockLocationId = user.metadata?.stock_location_id as string | undefined

  if (salesChannelId) {
    const { data: channels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name", "description", "is_disabled", "stock_locations.id"],
      filters: { id: salesChannelId },
    })
    salesChannel = channels?.[0]
    if (!resolvedStockLocationId && salesChannel?.stock_locations?.length) {
      resolvedStockLocationId = salesChannel.stock_locations[0].id
    }
  }

  // Fallback to any available stock location if not linked yet
  if (!resolvedStockLocationId) {
    const { data: locations } = await query.graph({
      entity: "stock_location",
      fields: ["id"],
      pagination: { take: 1, skip: 0 },
    })
    if (locations?.length) {
      resolvedStockLocationId = locations[0].id
    }
  }

  // Get default store currency
  const stores = await storeService.listStores({}, { relations: ["supported_currencies"] })
  const store = stores?.[0]
  const defaultCurrency = store?.supported_currencies?.find((c: any) => c.is_default)?.currency_code?.toUpperCase() || "TND"

  return {
    user,
    isSuperAdmin,
    salesChannelId: salesChannelId || "",
    salesChannel,
    stockLocationId: resolvedStockLocationId,
    currencyCode: defaultCurrency,
  }
}
