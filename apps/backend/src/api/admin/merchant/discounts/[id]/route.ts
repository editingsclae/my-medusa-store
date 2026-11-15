import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  batchPriceListPricesWorkflow,
  deletePriceListsWorkflow,
  updatePriceListsWorkflow,
} from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import { requireSalesChannelId } from "../../category-access"
import { findMerchantPriceList, listMerchantPriceLists, toDate } from "../../discount-access"
import { findForeignIds } from "../../ownership"
import {
  discountDescription,
  discountStatus,
  findBlockedProducts,
  parseDiscountInput,
  pickBasePrice,
  planDiscountEdit,
  readDiscountMetadata,
  salePrice,
  toDiscountMetadata,
  type ExistingDiscount,
} from "../../discount-rules"

// DELETE /admin/merchant/discounts/:id
// Stops and removes one of the merchant's discounts. The products go back to
// their normal price at once.
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const id = req.params.id

  const { data } = await query.graph({
    entity: "price_list",
    fields: ["id", "description", "metadata"],
    filters: { id, description: discountDescription(merchantId) },
  })
  const priceList = (data as any[])?.[0]

  // Another merchant's discount looks exactly like one that does not exist
  if (!priceList || !readDiscountMetadata(priceList.metadata, merchantId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Discount not found")
  }

  await deletePriceListsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "discount", deleted: true })
}

// POST /admin/merchant/discounts/:id
// { percent, product_ids, starts_at?, ends_at? }: the same body as creating a discount,
// and it replaces what the discount was. Products that stay get the new percentage,
// products taken out go back to their normal price, products added get the discount.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const id = req.params.id
  const now = new Date()

  const current = await findMerchantPriceList(query, merchantId, id)
  if (!current) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Discount not found")
  }
  const currentMeta = readDiscountMetadata(current.metadata, merchantId)!
  if (discountStatus(now, toDate(current.starts_at), toDate(current.ends_at)) === "ended") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This discount has ended, so it cannot be changed. Create a new one instead."
    )
  }

  const parsed = parseDiscountInput(req.body, now)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }
  const input = parsed.value
  const currency = (currentMeta.currencyCode || context.currencyCode).toLowerCase()

  // Only products of this merchant
  const productFilters: Record<string, any> = {
    id: input.productIds,
    sales_channels: { id: merchantId },
  }
  const { data: found } = await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.prices.*"],
    filters: productFilters,
  })
  const products = found as any[]
  if (findForeignIds(input.productIds, products.map((p) => p.id)).length > 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Some of the chosen products were not found in your store.")
  }
  const titleById = new Map(products.map((p) => [p.id as string, p.title as string]))

  // A product can only have one discount at a time. This discount itself does not count.
  const others: ExistingDiscount[] = (await listMerchantPriceLists(query, merchantId))
    .filter((row) => row.id !== id)
    .map((row) => ({
      startsAt: toDate(row.starts_at),
      endsAt: toDate(row.ends_at),
      productIds: readDiscountMetadata(row.metadata, merchantId)?.productIds ?? [],
    }))
  const blocked = findBlockedProducts(input, input.productIds, others, now)
  if (blocked.length > 0) {
    const names = blocked.slice(0, 3).map((pid) => `"${titleById.get(pid) ?? pid}"`).join(", ")
    const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : ""
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `${names}${more} already ${blocked.length === 1 ? "has" : "have"} a discount in that period. Remove it first.`
    )
  }

  // Every chosen product needs a normal price the discount can lower
  const withoutPrice = products
    .filter((product) =>
      (product.variants || []).every((variant: any) => {
        const base = pickBasePrice(variant.prices, currency)
        return base === null || salePrice(base, input.percent) === null
      })
    )
    .map((product) => product.title as string)
  if (withoutPrice.length > 0) {
    const names = withoutPrice.slice(0, 3).map((title) => `"${title}"`).join(", ")
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${names} has no price in ${currency.toUpperCase()} to discount. Set a price first.`
    )
  }

  // The products that were in the discount and are not any more
  const removedIds = currentMeta.productIds.filter((pid) => !input.productIds.includes(pid))
  let removedVariants: any[] = []
  if (removedIds.length > 0) {
    const { data: gone } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id", "variants.prices.*"],
      filters: { id: removedIds },
    })
    removedVariants = (gone as any[]).flatMap((product) => product.variants || [])
  }
  const keptVariants = products.flatMap((product) => product.variants || [])

  const plan = planDiscountEdit(id, input.percent, currency, keptVariants, removedVariants)

  // Prices first, then the details: if the second step fails, saving again works the
  // same plan out from what is there, so it finishes the job
  try {
    if (plan.create.length || plan.update.length || plan.remove.length) {
      await batchPriceListPricesWorkflow(req.scope).run({
        input: { data: { id, create: plan.create, update: plan.update, delete: plan.remove } },
      })
    }
    await updatePriceListsWorkflow(req.scope).run({
      input: {
        price_lists_data: [
          {
            id,
            title: input.title,
            starts_at: input.startsAt ? input.startsAt.toISOString() : null,
            ends_at: input.endsAt ? input.endsAt.toISOString() : null,
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
  } catch (err) {
    console.error("Failed to update the discount:", err)
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The discount could not be fully updated. Please save again."
    )
  }

  res.json({
    discount: {
      id,
      title: input.title,
      percent: input.percent,
      starts_at: input.startsAt ? input.startsAt.toISOString() : null,
      ends_at: input.endsAt ? input.endsAt.toISOString() : null,
      status: discountStatus(now, input.startsAt, input.endsAt),
      products: input.productIds.map((pid) => ({ id: pid, title: titleById.get(pid) ?? "" })),
    },
  })
}
