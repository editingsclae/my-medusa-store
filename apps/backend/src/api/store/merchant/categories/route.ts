import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listCategoryLinks } from "../../../admin/merchant/category-access"
import { buildStoreCategories } from "../../../store-categories"
import { salesChannelIdsFromKey } from "../../../store-key"

// Page size for products, matching the merchant portal. Flat catalogs stay below it.
const PRODUCT_LIMIT = 5000

/**
 * GET /store/merchant/categories
 *
 * The categories of the merchant whose publishable key is on the request. Use
 * this instead of /store/product-categories, which lists every merchant's.
 *
 *   ?handle=shirts       one category by its public handle
 *   ?hide_empty=true     leave out categories with no published products
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const links = await listCategoryLinks(req.scope, channelIds)
  const ids = Array.from(new Set(links.map((link) => link.product_category_id)))

  if (ids.length === 0) {
    return res.json({ categories: [], count: 0 })
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "description", "rank", "is_active", "is_internal"],
    filters: { id: ids },
  })

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "categories.id"],
    filters: { sales_channels: { id: channelIds }, status: "published" } as any,
    pagination: { take: PRODUCT_LIMIT },
  })

  const result = buildStoreCategories({
    links,
    categories: categories as any[],
    products: products as any[],
    handle: typeof req.query.handle === "string" ? req.query.handle : undefined,
    hideEmpty: req.query.hide_empty === "true",
  })

  res.json({ categories: result, count: result.length })
}
