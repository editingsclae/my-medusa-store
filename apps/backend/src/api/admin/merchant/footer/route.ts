import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"
import { requireSalesChannelId } from "../category-access"
import { loadFooter, saveFooter } from "../footer-access"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_SOCIAL_URL_LENGTH,
  MAX_STORE_NAME_LENGTH,
  NETWORKS,
  parseFooterContent,
} from "../../../footer-content"

const LIMITS = {
  store_name: MAX_STORE_NAME_LENGTH,
  description: MAX_DESCRIPTION_LENGTH,
  social_url: MAX_SOCIAL_URL_LENGTH,
  networks: NETWORKS,
}

// GET /admin/merchant/footer
// The merchant's footer settings, including the networks that are switched off.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const footer = await loadFooter(req.scope, salesChannelId)
  res.json({ footer, limits: LIMITS })
}

// POST /admin/merchant/footer
//   { store_name, description, social: { tiktok|facebook|instagram: { url, enabled } } }
// Saves the whole footer at once. A link is a full address on the network's own
// site (or "@name"); it is cleaned up and the clean address is what is stored.
// A network that is switched on needs a link.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const parsed = parseFooterContent(req.body)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }

  await saveFooter(req.scope, salesChannelId, parsed.value)

  // Read it back so the answer shows what is really stored
  const footer = await loadFooter(req.scope, salesChannelId)
  res.json({ footer, limits: LIMITS })
}
