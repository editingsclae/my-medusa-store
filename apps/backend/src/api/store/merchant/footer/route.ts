import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadFooter } from "../../../admin/merchant/footer-access"
import { toPublicFooter } from "../../../footer-content"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * GET /store/merchant/footer
 *
 * The footer of the merchant whose publishable key is on the request:
 *   store_name    the name to show in the footer, or null (use the storefront's own)
 *   description   a short text, or null (use the storefront's own)
 *   social_links  only the networks that are switched on, in this order:
 *                 tiktok, facebook, instagram. { network, url } where url is a
 *                 full https address on the network's own site.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const footer = await loadFooter(req.scope, channelIds[0])
  res.json(toPublicFooter(footer))
}
