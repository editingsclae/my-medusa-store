import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import SalesChannelProductCategory from "../../../links/sales-channel-product-category"
import type { MerchantContext } from "./utils"
import { findForeignIds } from "./ownership"

// Flat categories per merchant stay small, so one page is always enough.
const QUERY_LIMIT = 5000

export type CategoryLink = {
  sales_channel_id: string
  product_category_id: string
}

// The sales channel a category request works in. A merchant always has one. A
// platform admin has to pass ?sales_channel_id= to pick a merchant.
export function requireSalesChannelId(context: MerchantContext): string {
  if (!context.salesChannelId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "A sales channel is required. Platform admins must pass sales_channel_id."
    )
  }

  return context.salesChannelId
}

// Category links for the given sales channels, optionally limited to some
// category ids.
export async function listCategoryLinks(
  scope: MedusaContainer,
  salesChannelIds: string[],
  categoryIds?: string[]
): Promise<CategoryLink[]> {
  if (salesChannelIds.length === 0) {
    return []
  }

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const filters: Record<string, any> = { sales_channel_id: salesChannelIds }
  if (categoryIds) {
    filters.product_category_id = categoryIds
  }

  const { data } = await query.graph({
    entity: SalesChannelProductCategory.entryPoint,
    fields: ["sales_channel_id", "product_category_id"],
    filters,
    pagination: { take: QUERY_LIMIT },
  })

  return data as CategoryLink[]
}

// Throws unless every id is a category owned by this sales channel. Used
// everywhere a category id enters a merchant request: product create and
// update, and the category routes themselves.
export async function assertCategoriesOwned(
  scope: MedusaContainer,
  salesChannelId: string,
  categoryIds: unknown
): Promise<string[]> {
  if (
    !Array.isArray(categoryIds) ||
    categoryIds.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "category_ids must be an array of category ids"
    )
  }

  const ids = Array.from(new Set(categoryIds as string[]))

  if (ids.length === 0) {
    return ids
  }

  const links = await listCategoryLinks(scope, [salesChannelId], ids)
  const foreign = findForeignIds(
    ids,
    links.map((link) => link.product_category_id)
  )

  if (foreign.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "One or more categories do not belong to this merchant"
    )
  }

  // A link can outlive a deleted category, so the categories must still exist
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { id: ids },
  })

  if (findForeignIds(ids, (existing as any[]).map((c) => c.id)).length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "One or more categories do not exist"
    )
  }

  return ids
}

// Products can carry categories that are not this merchant's (for example ones
// a platform admin attached). A merchant only ever sees its own, and only the
// fields it needs, never the stored handle with the channel id in front.
// Platform admins without a selected channel see everything.
export async function onlyOwnedCategories<
  T extends { categories?: any[] | null }
>(scope: MedusaContainer, salesChannelId: string, products: T[]): Promise<T[]> {
  if (!salesChannelId) {
    return products
  }

  const links = await listCategoryLinks(scope, [salesChannelId])
  const owned = new Set(links.map((link) => link.product_category_id))

  return products.map((product) => ({
    ...product,
    categories: (product.categories || [])
      .filter((category) => category && owned.has(category.id))
      .map((category) => ({ id: category.id, name: category.name })),
  }))
}

// One category of this merchant. A category that does not exist and a category
// that belongs to someone else both give the same 404, so ids cannot be probed.
export async function getOwnedCategory(
  scope: MedusaContainer,
  salesChannelId: string,
  categoryId: string
): Promise<Record<string, any>> {
  const links = await listCategoryLinks(scope, [salesChannelId], [categoryId])

  if (links.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Category not found")
  }

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "is_active",
      "rank",
      "created_at",
      "updated_at",
    ],
    filters: { id: categoryId },
  })

  if (!data?.[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Category not found")
  }

  return data[0]
}
