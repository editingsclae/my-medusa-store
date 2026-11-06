import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadLayout, saveLayout } from "../../../../admin/merchant/storefront-layout-access"
import {
  LAYOUT_KEY_HEADER,
  keyFromHeader,
  layoutKeyMatches,
  parseLayout,
} from "../../../../storefront-layout"
import { salesChannelIdsFromKey } from "../../../../store-key"

/**
 * PUT /store/merchant/storefront/layout
 *   headers: x-publishable-api-key, x-layout-key
 *   body:    { "promo_banners": 3 }
 *
 * The storefront says how many promo banners it has room for (0 to 12). The
 * merchant's portal then shows exactly that many places. A storefront can call
 * this every time it starts: saying the same thing again changes nothing.
 * The layout key is created by the merchant in the portal (Appearance).
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const { metadata } = await loadLayout(req.scope, channelIds[0])

  const key = keyFromHeader(req.headers[LAYOUT_KEY_HEADER])
  if (!key) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      `Send the layout key in the ${LAYOUT_KEY_HEADER} header. The merchant creates it in the portal, under Appearance.`
    )
  }
  if (!layoutKeyMatches(key, metadata)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "This layout key is not valid for this store")
  }

  const parsed = parseLayout(req.body)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }

  const layout = { promo_banners: parsed.value.promo_banners, declared_at: new Date().toISOString() }
  await saveLayout(req.scope, channelIds[0], layout)

  res.json({ layout })
}
