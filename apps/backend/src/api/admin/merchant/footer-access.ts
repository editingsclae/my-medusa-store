import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { readStoredFooter, withFooter, type FooterContent } from "../../footer-content"
import { buildStoreCategories } from "../../store-categories"
import { listCategoryLinks } from "./category-access"

async function loadChannel(scope: MedusaContainer, salesChannelId: string) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "metadata"],
    filters: { id: salesChannelId },
  })

  const channel: any = data?.[0]
  if (!channel) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Sales channel ${salesChannelId} was not found`
    )
  }
  return channel
}

// The stored footer of one sales channel
export async function loadFooter(
  scope: MedusaContainer,
  salesChannelId: string
): Promise<FooterContent> {
  const channel = await loadChannel(scope, salesChannelId)
  return readStoredFooter(channel.metadata)
}

// Saves the footer. The rest of the channel's metadata (the banners, for one) is
// sent back unchanged, so the result is the same whether Medusa merges metadata
// or replaces it.
export async function saveFooter(
  scope: MedusaContainer,
  salesChannelId: string,
  content: FooterContent
): Promise<void> {
  const channel = await loadChannel(scope, salesChannelId)
  const salesChannels = scope.resolve(Modules.SALES_CHANNEL)
  await salesChannels.updateSalesChannels(salesChannelId, {
    metadata: withFooter(channel.metadata, content) as any,
  })
}

// Which of these categories a storefront may show: the merchant's own, active,
// not internal, with the public handle. Same rules as GET /store/merchant/categories.
export async function loadVisibleCategories(
  scope: MedusaContainer,
  salesChannelIds: string[],
  categoryIds: string[]
): Promise<Array<{ id: string; name: string; handle: string }>> {
  if (categoryIds.length === 0) {
    return []
  }

  const links = await listCategoryLinks(scope, salesChannelIds, categoryIds)
  if (links.length === 0) {
    return []
  }

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "description", "rank", "is_active", "is_internal"],
    filters: { id: links.map((link) => link.product_category_id) },
  })

  return buildStoreCategories({ links, categories: categories as any[], products: [] }).map(
    (category) => ({ id: category.id, name: category.name, handle: category.handle })
  )
}
