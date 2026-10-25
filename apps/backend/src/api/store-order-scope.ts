import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { salesChannelIdsFromKey } from "./store-key"

/**
 * Keeps a storefront's order calls inside its own merchant.
 *
 * Medusa's /store/orders routes know only the logged-in customer, and customers
 * are shared by every merchant. Without this, a storefront could read a
 * shopper's orders from all merchants. The sales channels come from the
 * publishable key of the request, which the storefront cannot change.
 */

/**
 * Makes `req.filterableFields.sales_channel_id` always equal the key's channels,
 * whatever else runs. Core validation assigns a fresh `req.filterableFields`
 * object, so a plain assignment made before it would be thrown away. The
 * property is therefore replaced with one whose setter re-applies the scope, which
 * works whether this middleware runs before or after the core one.
 */
export function applySalesChannelScope(
  req: { filterableFields?: Record<string, unknown> },
  channelIds: string[]
) {
  let current: Record<string, unknown> = {
    ...(req.filterableFields || {}),
    sales_channel_id: channelIds,
  }

  Object.defineProperty(req, "filterableFields", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: Record<string, unknown> | undefined) => {
      current = { ...(value || {}), sales_channel_id: channelIds }
    },
  })
}

// GET /store/orders: only orders of the key's merchant
export function scopeStoreOrdersToKey(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    applySalesChannelScope(req as any, salesChannelIdsFromKey(req))
    return next()
  } catch (error) {
    return next(error)
  }
}

// GET /store/orders/:id: an order of another merchant is reported as not found
export async function restrictStoreOrderToKey(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const channelIds = salesChannelIdsFromKey(req)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "sales_channel_id"],
      filters: { id: req.params.id },
    })

    const order: any = data?.[0]
    // A missing order is left to the core route, which answers not found
    if (order && !channelIds.includes(order.sales_channel_id)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id: ${req.params.id} was not found`
      )
    }
    return next()
  } catch (error) {
    return next(error)
  }
}
