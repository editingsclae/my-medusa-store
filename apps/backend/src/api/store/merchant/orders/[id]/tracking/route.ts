import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ORDER_TRACKING_FIELDS, trackingNumbersForOrder } from "../../../../../order-tracking"
import { salesChannelIdsFromKey } from "../../../../../store-key"

/**
 * GET /store/merchant/orders/:id/tracking
 *
 * The tracking numbers the merchant entered when shipping the order:
 * { tracking_numbers: string[] }. The list is empty when none was entered (the
 * field is optional) or the order has not shipped yet. An order of another
 * merchant is a 404, like GET /store/orders/:id.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_TRACKING_FIELDS,
    filters: { id: req.params.id },
  })

  const tracking = trackingNumbersForOrder((data?.[0] as any) ?? null, channelIds)
  if (!tracking) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order with id: ${req.params.id} was not found`
    )
  }
  res.json({ tracking_numbers: tracking })
}
