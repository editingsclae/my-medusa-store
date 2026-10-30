import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadStorefrontContent } from "../../../admin/merchant/storefront-access"
import { toPublicContent } from "../../../storefront-content"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * GET /store/merchant/storefront
 *
 * The banners of the merchant whose publishable key is on the request: up to 3
 * hero slides and up to 2 promo banners, only the ones that are switched on.
 * A banner is { id, image_url, label, title, text, button_label, link } where
 * link is { type: "none" | "shop" | "category" | "product", handle? }.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const content = await loadStorefrontContent(req.scope, channelIds[0])

  const { hero_slides, promo_banners } = toPublicContent(content)
  res.json({ hero_slides, promo_banners })
}
