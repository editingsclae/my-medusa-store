import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadFooter, loadVisibleCategories } from "../../../admin/merchant/footer-access"
import { toPublicFooter } from "../../../footer-content"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * GET /store/merchant/footer
 *
 * The footer of the merchant whose publishable key is on the request:
 *   store_name       the name to show in the footer, or null (use the storefront's own)
 *   description      a short text, or null (use the storefront's own)
 *   social_links     only the networks that are switched on, in this order:
 *                    tiktok, facebook, instagram. { network, url } where url is a
 *                    full https address on the network's own site.
 *   shop_categories  up to 5 categories for the "Shop" column, in the merchant's
 *                    order: { id, name, handle }. Link to /c/<handle>. One that was
 *                    deleted or switched off is not returned.
 *   pages            the support pages that have text, in this order: contact,
 *                    shipping, returns, privacy, terms: { slug, title }. Read the
 *                    text with GET /store/merchant/pages/<slug>.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const footer = await loadFooter(req.scope, channelIds[0])
  const visible = await loadVisibleCategories(req.scope, channelIds, footer.shop_category_ids)
  res.json(toPublicFooter(footer, visible))
}
