// Keeps a product's discounted prices in step with its normal price. A discount stores a
// fixed price per variant, so without this the discount would stay at the old amount
// when the merchant changes the price (1400 -> 1300 would still sell at 1260).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchPriceListPricesWorkflow } from "@medusajs/core-flows"
import { listMerchantPriceLists } from "./discount-access"
import { planDiscountPrices, readDiscountMetadata } from "./discount-rules"

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
    const plan = planDiscountPrices(row.id, meta.percent, meta.currencyCode || fallbackCurrency, variants)
    if (!plan.create.length && !plan.update.length && !plan.remove.length) continue
    await batchPriceListPricesWorkflow(scope).run({
      input: { data: { id: row.id, create: plan.create, update: plan.update, delete: plan.remove } },
    })
  }
}
