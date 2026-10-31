import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listCategoryLinks } from "../../../admin/merchant/category-access"
import { loadStorefrontContent } from "../../../admin/merchant/storefront-access"
import { buildStoreCategories } from "../../../store-categories"
import { publicCategoryTiles, toPublicContent } from "../../../storefront-content"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * GET /store/merchant/storefront
 *
 * What the merchant whose publishable key is on the request shows on its
 * landing page:
 *   hero_slides     up to 3, only the ones that are switched on
 *   promo_banners   up to 2, only the ones that are switched on
 *   category_tiles  up to 8 categories with a picture, in the merchant's order
 *
 * A banner is { id, image_url, label, title, text, button_label, link } where
 * link is { type: "none" | "shop" | "category" | "product", handle? }.
 * A category tile is { id, category_id, name, handle, image_url }. The handle is
 * the public category handle: link to /c/<handle>. A tile whose
 * category was deleted or switched off is not returned.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const content = await loadStorefrontContent(req.scope, channelIds[0])

  const { hero_slides, promo_banners } = toPublicContent(content)

  let category_tiles: ReturnType<typeof publicCategoryTiles> = []
  if (content.category_tiles.length > 0) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const links = await listCategoryLinks(
      req.scope,
      channelIds,
      content.category_tiles.map((tile) => tile.category_id)
    )

    if (links.length > 0) {
      const { data: categories } = await query.graph({
        entity: "product_category",
        fields: ["id", "name", "handle", "description", "rank", "is_active", "is_internal"],
        filters: { id: links.map((link) => link.product_category_id) },
      })

      // Same rules as GET /store/merchant/categories: owned, active, not
      // internal, public handle. Product counts are not needed here.
      const visible = buildStoreCategories({
        links,
        categories: categories as any[],
        products: [],
      })
      category_tiles = publicCategoryTiles(content.category_tiles, visible)
    }
  }

  res.json({ hero_slides, promo_banners, category_tiles })
}
