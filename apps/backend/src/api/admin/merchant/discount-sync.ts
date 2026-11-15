// Keeps a discount's prices in step with the products. A discount stores a fixed price
// per variant, so they have to be worked out again whenever the discount or a product's
// normal price changes. The old prices of the discount are removed first and the new ones
// created after, in two steps: changing a price in place left the old one in force when the
// discount was lowered, because Medusa sells at the lowest price that applies.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchPriceListPricesWorkflow } from "@medusajs/core-flows"
import { listMerchantPriceLists } from "./discount-access"
import {
  discountPriceIdsOf,
  readDiscountMetadata,
  wantedDiscountPrices,
  type NewDiscountPrice,
} from "./discount-rules"

// Every price the price list has, whatever product it is for
export async function readListPriceIds(query: any, listId: string): Promise<Set<string>> {
  try {
    const { data } = await query.graph({
      entity: "price_list",
      fields: ["id", "prices.id"],
      filters: { id: listId },
    })
    const prices = ((data as any[])?.[0]?.prices as { id?: string }[]) || []
    return new Set(prices.map((price) => price.id).filter((id): id is string => !!id))
  } catch (err) {
    // The prices the variants say are the discount's are still removed
    console.error("Could not read the prices of the price list:", err)
    return new Set()
  }
}

// Removes the given prices from the price list, then adds the new ones
export async function replaceListPrices(
  scope: MedusaContainer,
  listId: string,
  removeIds: string[],
  create: NewDiscountPrice[]
): Promise<void> {
  if (removeIds.length > 0) {
    await batchPriceListPricesWorkflow(scope).run({
      input: { data: { id: listId, create: [], update: [], delete: removeIds } },
    })
  }
  if (create.length > 0) {
    await batchPriceListPricesWorkflow(scope).run({
      input: { data: { id: listId, create, update: [], delete: [] } },
    })
  }
}

// When a product is saved: the discounts that include it get their price worked out
// again from its new normal price (1400 -> 1300 at 10% is 1170, and back).
export async function syncProductDiscounts(
  scope: MedusaContainer,
  merchantId: string,
  productId: string,
  fallbackCurrency: string
): Promise<void> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const lists = (await listMerchantPriceLists(query, merchantId)).filter((row) =>
    readDiscountMetadata(row.metadata, merchantId)?.productIds.includes(productId)
  )
  if (lists.length === 0) return

  // Read after the product was saved, so the new normal prices are what is compared
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.prices.*"],
    filters: { id: productId },
  })
  const variants = (((data?.[0] as any)?.variants as any[]) || []).map((v) => ({
    id: v.id as string,
    prices: v.prices as any[],
  }))

  for (const row of lists) {
    const meta = readDiscountMetadata(row.metadata, merchantId)!
    const listPriceIds = await readListPriceIds(query, row.id)
    await replaceListPrices(
      scope,
      row.id,
      discountPriceIdsOf(row.id, listPriceIds, variants),
      wantedDiscountPrices(meta.percent, meta.currencyCode || fallbackCurrency, variants, listPriceIds)
    )
  }
}
