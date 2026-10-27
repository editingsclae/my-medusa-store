import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { MerchantContext } from "./utils"
import { requireSalesChannelId } from "./category-access"
import { getStoreCurrency } from "./fulfillment"
import type { RawOption } from "./delivery-options"

export type DeliveryZone = {
  id: string
  name: string
  countries: string[]
}

export type MerchantDelivery = {
  stockLocationId: string
  currencyCode: string
  zones: DeliveryZone[]
  options: RawOption[]
}

const OPTION_FIELDS = [
  "id",
  "name",
  "price_type",
  "provider_id",
  "shipping_profile_id",
  "service_zone_id",
  "*rules",
  "rules.values.value",
  "*prices",
  "*prices.price_rules",
]

// The stock location a delivery request works on. A merchant uses the one in
// its own record. A platform admin has to pick a merchant with
// ?sales_channel_id= and then works on that merchant's location, never on
// "the first location", which could belong to somebody else.
export function requireStockLocationId(context: MerchantContext): string {
  requireSalesChannelId(context)

  const id = context.isSuperAdmin
    ? context.salesChannel?.stock_locations?.[0]?.id
    : context.stockLocationId

  if (!id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This merchant has no stock location, so delivery is not set up yet"
    )
  }
  return id
}

// Everything the delivery settings need for one merchant: the delivery zones
// of its stock location and the shipping options inside them. The options are
// found through the zones, so an option that is not in one of the merchant's
// own zones can never show up here, and the routes only act on ids from this
// list.
export async function loadMerchantDelivery(
  scope: MedusaContainer,
  context: MerchantContext
): Promise<MerchantDelivery> {
  const stockLocationId = requireStockLocationId(context)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "fulfillment_sets.id",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.name",
      "fulfillment_sets.service_zones.geo_zones.country_code",
    ],
    filters: { id: stockLocationId },
  })

  const location: any = locations?.[0]
  const zones: DeliveryZone[] = []
  for (const set of location?.fulfillment_sets || []) {
    for (const zone of set?.service_zones || []) {
      zones.push({
        id: zone.id,
        name: zone.name,
        countries: (zone.geo_zones || [])
          .map((g: any) => String(g.country_code || "").toLowerCase())
          .filter(Boolean),
      })
    }
  }

  const currencyCode = await getStoreCurrency(scope)

  if (zones.length === 0) {
    return { stockLocationId, currencyCode, zones, options: [] }
  }

  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: OPTION_FIELDS,
    filters: { service_zone_id: zones.map((z) => z.id) },
  })

  return { stockLocationId, currencyCode, zones, options: options as RawOption[] }
}
