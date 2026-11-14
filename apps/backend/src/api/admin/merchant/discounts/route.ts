import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  PriceListStatus,
  PriceListType,
} from "@medusajs/framework/utils"
import { createPriceListsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"
import { requireSalesChannelId } from "../category-access"
import { listMerchantPriceLists, toDate } from "../discount-access"
import { findForeignIds } from "../ownership"
import {
  discountDescription,
  discountStatus,
  findBlockedProducts,
  parseDiscountInput,
  pickBasePrice,
  readDiscountMetadata,
  salePrice,
  toDiscountMetadata,
  type ExistingDiscount,
} from "../discount-rules"

// GET /admin/merchant/discounts: the merchant's discounts, newest first
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()

  const lists = await listMerchantPriceLists(query, merchantId)

  const productIds = [
    ...new Set(lists.flatMap((row) => readDiscountMetadata(row.metadata, merchantId)?.productIds ?? [])),
  ]
  const productsById = new Map<string, { id: string; title: string; thumbnail: string | null }>()
  if (productIds.length > 0) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "title", "thumbnail"],
      filters: { id: productIds, sales_channels: { id: merchantId } },
    })
    for (const product of products as any[]) {
      productsById.set(product.id, { id: product.id, title: product.title, thumbnail: product.thumbnail ?? null })
    }
  }

  const discounts = lists.map((row) => {
    const meta = readDiscountMetadata(row.metadata, merchantId)!
    const startsAt = toDate(row.starts_at)
    const endsAt = toDate(row.ends_at)
    return {
      id: row.id,
      title: row.title || `${meta.percent}% off`,
      percent: meta.percent,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      status: discountStatus(now, startsAt, endsAt),
      products: meta.productIds.map((id) => productsById.get(id)).filter(Boolean),
      created_at: toDate(row.created_at)?.toISOString() ?? null,
    }
  })

  res.json({ discounts, count: discounts.length })
}

// POST /admin/merchant/discounts
// { percent: 20, product_ids: [...], starts_at?: "2026-11-20", ends_at?: "2026-11-30", title?: "..." }
// Creates one sale price list: every variant of the chosen products gets the
// discounted price. The normal price stays, so the storefront can show both.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()

  const parsed = parseDiscountInput(req.body, now)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }
  const input = parsed.value
  const currency = context.currencyCode.toLowerCase()

  // Only products of this merchant, so one merchant can never discount another's
  const { data: found } = await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.prices.*"],
    filters: { id: input.productIds, sales_channels: { id: merchantId } },
  })
  const products = found as any[]

  if (findForeignIds(input.productIds, products.map((p) => p.id)).length > 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Some of the chosen products were not found in your store.")
  }

  const titleById = new Map(products.map((p) => [p.id as string, p.title as string]))

  // A product can only have one discount at a time
  const existing: ExistingDiscount[] = (await listMerchantPriceLists(query, merchantId)).map((row) => ({
    startsAt: toDate(row.starts_at),
    endsAt: toDate(row.ends_at),
    productIds: readDiscountMetadata(row.metadata, merchantId)?.productIds ?? [],
  }))
  const blocked = findBlockedProducts(input, input.productIds, existing, now)
  if (blocked.length > 0) {
    const names = blocked.slice(0, 3).map((id) => `"${titleById.get(id) ?? id}"`).join(", ")
    const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : ""
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `${names}${more} already ${blocked.length === 1 ? "has" : "have"} a discount in that period. Remove it first.`
    )
  }

  // One discounted price for every variant that has a normal price
  const prices: { variant_id: string; currency_code: string; amount: number }[] = []
  const withoutPrice: string[] = []
  for (const product of products) {
    let priced = 0
    for (const variant of product.variants || []) {
      const base = pickBasePrice(variant.prices, currency)
      const sale = base === null ? null : salePrice(base, input.percent)
      if (sale !== null) {
        prices.push({ variant_id: variant.id, currency_code: currency, amount: sale })
        priced += 1
      }
    }
    if (priced === 0) withoutPrice.push(product.title)
  }
  if (withoutPrice.length > 0) {
    const names = withoutPrice.slice(0, 3).map((title) => `"${title}"`).join(", ")
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${names} has no price in ${currency.toUpperCase()} to discount. Set a price first.`
    )
  }

  const { result } = await createPriceListsWorkflow(req.scope).run({
    input: {
      price_lists_data: [
        {
          title: input.title,
          description: discountDescription(merchantId),
          status: PriceListStatus.ACTIVE,
          type: PriceListType.SALE,
          starts_at: input.startsAt ? input.startsAt.toISOString() : null,
          ends_at: input.endsAt ? input.endsAt.toISOString() : null,
          prices,
          metadata: toDiscountMetadata({
            merchantId,
            percent: input.percent,
            productIds: input.productIds,
            currencyCode: currency,
          }),
        },
      ],
    },
  })

  res.status(201).json({
    discount: {
      id: result[0].id,
      title: input.title,
      percent: input.percent,
      starts_at: input.startsAt ? input.startsAt.toISOString() : null,
      ends_at: input.endsAt ? input.endsAt.toISOString() : null,
      status: discountStatus(now, input.startsAt, input.endsAt),
      products: input.productIds.map((id) => ({ id, title: titleById.get(id) ?? "" })),
    },
  })
}
