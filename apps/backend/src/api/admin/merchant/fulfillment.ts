import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/core-flows"

/**
 * Per-merchant fulfillment setup.
 *
 * Medusa lists shipping options for a cart by following
 *   cart sales channel -> stock location -> fulfillment set -> service zone -> shipping option
 * and refuses to complete a cart whose products have no shipping profile that
 * one of the chosen options uses. A merchant that only has a stock location
 * therefore cannot sell anything, so provisioning creates the rest of the chain.
 */

export const DEFAULT_COUNTRIES = ["tn"]
export const FULFILLMENT_PROVIDER_ID = "manual_manual"

type CountryResult = { countries: string[]; invalid: string[] }

/** Accepts ["tn", "FR"] or "tn, fr". Codes are lowercased, de-duplicated and checked as ISO-2 shaped. */
export function normalizeCountries(input: unknown, fallback: string[] = DEFAULT_COUNTRIES): CountryResult {
  if (input === undefined || input === null || input === "") {
    return { countries: [...fallback], invalid: [] }
  }

  const raw: unknown[] = Array.isArray(input) ? input : String(input).split(",")
  const seen = new Set<string>()
  const invalid: string[] = []

  for (const item of raw) {
    const code = typeof item === "string" ? item.trim().toLowerCase() : ""
    if (!/^[a-z]{2}$/.test(code)) {
      invalid.push(typeof item === "string" ? item : String(item))
      continue
    }
    seen.add(code)
  }

  if (seen.size === 0 && invalid.length === 0) {
    return { countries: [...fallback], invalid: [] }
  }
  return { countries: [...seen], invalid }
}

/** Shipping price in the store's main currency. Missing means free shipping. Returns null when it is not a usable amount. */
export function parseShippingAmount(input: unknown): number | null {
  if (input === undefined || input === null || input === "") {
    return 0
  }
  const amount = Number(input)
  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }
  return amount
}

type PriceRow = { currency_code: string } | { region_id: string }

/**
 * One flat price in the merchant's currency, repeated for every region that
 * uses that currency. Other currencies are not guessed: 10 TND is not 10 EUR.
 */
export function buildShippingPrices(
  amount: number,
  currencyCode: string,
  regions: Array<{ id: string; currency_code?: string | null }>
): Array<PriceRow & { amount: number }> {
  const currency = currencyCode.toLowerCase()
  const prices: Array<PriceRow & { amount: number }> = [{ currency_code: currency, amount }]

  for (const region of regions) {
    if ((region.currency_code || "").toLowerCase() === currency) {
      prices.push({ region_id: region.id, amount })
    }
  }
  return prices
}

export async function getDefaultShippingProfileId(scope: MedusaContainer): Promise<string> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "type"],
  })

  const profile = (data as any[]).find((p) => p.type === "default") || data[0]
  if (!profile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No shipping profile exists. Create a default shipping profile first."
    )
  }
  return profile.id
}

export async function getStoreCurrency(scope: MedusaContainer): Promise<string> {
  const storeService = scope.resolve(Modules.STORE)
  const stores = await storeService.listStores({}, { relations: ["supported_currencies"] })
  const currencies: any[] = stores?.[0]?.supported_currencies || []
  const chosen = currencies.find((c) => c.is_default) || currencies[0]
  if (!chosen?.currency_code) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "The store has no supported currency")
  }
  return String(chosen.currency_code).toLowerCase()
}

export type MerchantFulfillmentResult = {
  created: boolean
  fulfillment_set_id: string
  service_zone_id?: string
  shipping_option_id?: string
  countries?: string[]
  currency_code?: string
}

/**
 * Creates the fulfillment chain for one stock location. Safe to run again:
 * a location that already has a fulfillment set is left untouched.
 */
export async function provisionMerchantFulfillment(
  scope: MedusaContainer,
  options: {
    merchantName: string
    stockLocationId: string
    countries: string[]
    shippingAmount: number
  }
): Promise<MerchantFulfillmentResult> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const link = scope.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = scope.resolve(Modules.FULFILLMENT)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.id", "fulfillment_providers.id"],
    filters: { id: options.stockLocationId },
  })
  const location: any = locations?.[0]
  if (!location) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Stock location ${options.stockLocationId} not found`)
  }

  const existingSet = location.fulfillment_sets?.[0]
  if (existingSet) {
    return { created: false, fulfillment_set_id: existingSet.id }
  }

  const profileId = await getDefaultShippingProfileId(scope)
  const currencyCode = await getStoreCurrency(scope)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })

  const hasProvider = (location.fulfillment_providers || []).some(
    (p: any) => p?.id === FULFILLMENT_PROVIDER_ID
  )
  if (!hasProvider) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: options.stockLocationId },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: FULFILLMENT_PROVIDER_ID },
    })
  }

  const fulfillmentSet = await fulfillment.createFulfillmentSets({
    name: `${options.merchantName} delivery`,
    type: "shipping",
    service_zones: [
      {
        name: `${options.merchantName} delivery zone`,
        geo_zones: options.countries.map((country_code) => ({
          country_code,
          type: "country" as const,
        })),
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: options.stockLocationId },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  const serviceZoneId = fulfillmentSet.service_zones[0].id

  const { result: optionResult } = await createShippingOptionsWorkflow(scope).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: FULFILLMENT_PROVIDER_ID,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profileId,
        type: {
          label: "Standard",
          description: "Standard delivery",
          code: "standard",
        },
        prices: buildShippingPrices(options.shippingAmount, currencyCode, regions as any[]),
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  return {
    created: true,
    fulfillment_set_id: fulfillmentSet.id,
    service_zone_id: serviceZoneId,
    shipping_option_id: optionResult[0]?.id,
    countries: options.countries,
    currency_code: currencyCode,
  }
}

/**
 * Links every product of the sales channel that has no shipping profile to the
 * given profile. Returns how many products were changed.
 */
export async function backfillProductShippingProfiles(
  scope: MedusaContainer,
  salesChannelId: string,
  profileId: string
): Promise<number> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const link = scope.resolve(ContainerRegistrationKeys.LINK)

  const PAGE = 100
  const missing: string[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "shipping_profile.id"],
      filters: { sales_channels: { id: salesChannelId } } as any,
      pagination: { take: PAGE, skip },
    })
    for (const product of data as any[]) {
      if (!product.shipping_profile?.id) {
        missing.push(product.id)
      }
    }
    if (data.length < PAGE) break
  }

  if (missing.length > 0) {
    await link.create(
      missing.map((product_id) => ({
        [Modules.PRODUCT]: { product_id },
        [Modules.FULFILLMENT]: { shipping_profile_id: profileId },
      }))
    )
  }
  return missing.length
}
