import { randomBytes } from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"
import { loadMerchantDelivery } from "../delivery-access"
import {
  ENABLED_RULE_ATTRIBUTE,
  MAX_NAME_LENGTH,
  MAX_OPTIONS_PER_MERCHANT,
  parseOptionName,
  parsePrice,
  serializeOption,
} from "../delivery-options"
import {
  FULFILLMENT_PROVIDER_ID,
  buildShippingPrices,
  getDefaultShippingProfileId,
} from "../fulfillment"

// GET /admin/merchant/delivery-options
// The merchant's own delivery options and the countries they deliver to.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const delivery = await loadMerchantDelivery(req.scope, context)

  res.json({
    delivery_options: delivery.options.map((o) => serializeOption(o, delivery.currencyCode)),
    currency_code: delivery.currencyCode,
    countries: Array.from(new Set(delivery.zones.flatMap((z) => z.countries))),
    can_add: delivery.zones.length > 0 && delivery.options.length < MAX_OPTIONS_PER_MERCHANT,
  })
}

// POST /admin/merchant/delivery-options  { name, price }
// Adds a flat-price option to the merchant's first delivery zone.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const body = (req.body || {}) as any

  const name = parseOptionName(body.name)
  if (!name) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Name is required and must be at most ${MAX_NAME_LENGTH} characters`
    )
  }
  const price = parsePrice(body.price)
  if (price === null) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Price is required and must be a number from 0 (free delivery) upwards"
    )
  }

  const delivery = await loadMerchantDelivery(req.scope, context)

  if (delivery.zones.length === 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Delivery is not set up for this merchant yet. Ask the platform admin."
    )
  }
  if (delivery.options.length >= MAX_OPTIONS_PER_MERCHANT) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `You can have at most ${MAX_OPTIONS_PER_MERCHANT} delivery options`
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const profileId = await getDefaultShippingProfileId(req.scope)

  // Same provider as the merchant's existing options, so it is one that is
  // already linked to their stock location.
  const providerId = delivery.options.find((o) => o.provider_id)?.provider_id || FULFILLMENT_PROVIDER_ID

  const { result } = await createShippingOptionsWorkflow(req.scope).run({
    input: [
      {
        name,
        price_type: "flat",
        provider_id: providerId,
        service_zone_id: delivery.zones[0].id,
        shipping_profile_id: profileId,
        type: {
          label: name,
          description: name,
          code: `custom-${randomBytes(4).toString("hex")}`,
        },
        prices: buildShippingPrices(price, delivery.currencyCode, regions as any[]),
        rules: [
          { attribute: ENABLED_RULE_ATTRIBUTE, value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  res.status(201).json({
    delivery_option: {
      id: result[0].id,
      name,
      price,
      currency_code: delivery.currencyCode,
      enabled: true,
      is_flat: true,
    },
  })
}
