/**
 * One-time repair for merchants created before delivery setup was automatic.
 * For every merchant it
 *   1. creates a fulfillment set, a delivery zone and a "Standard Shipping" option
 *      on the merchant's stock location (skipped if the location already has a set), and
 *   2. gives every product of the merchant that has no shipping profile the default one.
 *
 *   npx medusa exec ./src/scripts/backfill-merchant-fulfillment.ts [countries] [shipping_price]
 *
 * Examples
 *   npx medusa exec ./src/scripts/backfill-merchant-fulfillment.ts            -> Tunisia, free shipping
 *   npx medusa exec ./src/scripts/backfill-merchant-fulfillment.ts tn 7       -> Tunisia, price 7 in the store currency
 *   npx medusa exec ./src/scripts/backfill-merchant-fulfillment.ts tn,fr 12
 *
 * Safe to run more than once. It never changes a merchant that is already set up.
 */
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  backfillProductShippingProfiles,
  getDefaultShippingProfileId,
  normalizeCountries,
  parseShippingAmount,
  provisionMerchantFulfillment,
} from "../api/admin/merchant/fulfillment"

export default async function backfillMerchantFulfillment({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { countries, invalid } = normalizeCountries(args?.[0])
  if (invalid.length > 0) {
    throw new Error(`Invalid country codes: ${invalid.join(", ")}`)
  }
  const shippingAmount = parseShippingAmount(args?.[1])
  if (shippingAmount === null) {
    throw new Error("shipping_price must be a number that is zero or more")
  }

  const profileId = await getDefaultShippingProfileId(container)

  const { data: users } = await query.graph({
    entity: "user",
    fields: ["id", "email", "metadata"],
  })
  const merchants = (users as any[]).filter(
    (u) => u.metadata?.role === "merchant" && u.metadata?.sales_channel_id
  )

  logger.info(`Merchants found: ${merchants.length}`)

  for (const merchant of merchants) {
    const channelId = merchant.metadata.sales_channel_id as string
    const stockLocationId = merchant.metadata.stock_location_id as string | undefined

    const { data: channels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
      filters: { id: channelId },
    })
    const name = (channels?.[0] as any)?.name || merchant.email

    try {
      if (stockLocationId) {
        const result = await provisionMerchantFulfillment(container, {
          merchantName: name,
          stockLocationId,
          countries,
          shippingAmount,
        })
        logger.info(
          result.created
            ? `${name}: delivery set up for ${countries.join(", ")} (option ${result.shipping_option_id})`
            : `${name}: delivery already set up, left unchanged`
        )
      } else {
        logger.warn(`${name}: no stock location in the merchant record, delivery skipped`)
      }

      const changed = await backfillProductShippingProfiles(container, channelId, profileId)
      logger.info(`${name}: ${changed} product(s) given the default shipping profile`)
    } catch (err) {
      logger.error(`${name}: failed - ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
