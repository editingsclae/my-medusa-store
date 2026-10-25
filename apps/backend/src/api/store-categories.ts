import { toPublicCategoryHandle } from "./admin/merchant/ownership"

type Link = { sales_channel_id: string; product_category_id: string }

type CategoryRow = {
  id: string
  name: string
  handle: string
  description?: string | null
  rank?: number | null
  is_active?: boolean | null
  is_internal?: boolean | null
}

type ProductRow = { id: string; categories?: Array<{ id: string }> | null }

export type StoreCategory = {
  id: string
  name: string
  handle: string
  description: string | null
  rank: number | null
  product_count: number
}

/**
 * The categories a storefront may show: only those linked to the merchant's
 * sales channels, active and not internal, with the public handle (no channel
 * prefix) and the number of published products in each.
 *
 * `products` must already be the merchant's published products.
 */
export function buildStoreCategories(input: {
  links: Link[]
  categories: CategoryRow[]
  products: ProductRow[]
  handle?: string
  hideEmpty?: boolean
}): StoreCategory[] {
  const channelOf = new Map<string, string>()
  for (const link of input.links) {
    if (!channelOf.has(link.product_category_id)) {
      channelOf.set(link.product_category_id, link.sales_channel_id)
    }
  }

  const counts = new Map<string, number>()
  for (const product of input.products) {
    const seen = new Set((product.categories || []).map((category) => category.id))
    for (const id of seen) {
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }

  return input.categories
    .filter(
      (category) =>
        channelOf.has(category.id) &&
        category.is_active === true &&
        category.is_internal !== true
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      handle: toPublicCategoryHandle(channelOf.get(category.id) as string, category.handle),
      description: category.description ?? null,
      rank: category.rank ?? null,
      product_count: counts.get(category.id) || 0,
    }))
    .filter((category) => (input.handle ? category.handle === input.handle : true))
    .filter((category) => (input.hideEmpty ? category.product_count > 0 : true))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name))
}
