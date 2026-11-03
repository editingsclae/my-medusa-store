import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"
import { assertCategoriesOwned, requireSalesChannelId } from "../category-access"
import { loadFooter, saveFooter } from "../footer-access"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PAGE_LENGTH,
  MAX_SHOP_CATEGORIES,
  MAX_SOCIAL_URL_LENGTH,
  MAX_STORE_NAME_LENGTH,
  NETWORKS,
  PAGE_KEYS,
  PAGE_TITLES,
  parseFooterContent,
} from "../../../footer-content"

const LIMITS = {
  store_name: MAX_STORE_NAME_LENGTH,
  description: MAX_DESCRIPTION_LENGTH,
  social_url: MAX_SOCIAL_URL_LENGTH,
  networks: NETWORKS,
  shop_categories: MAX_SHOP_CATEGORIES,
  page: MAX_PAGE_LENGTH,
  pages: PAGE_KEYS.map((key) => ({ key, title: PAGE_TITLES[key] })),
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
//   { store_name, description, social: { tiktok|facebook|instagram: { url, enabled } },
//     shop_category_ids: [...up to 5 of the merchant's own category ids],
//     pages: { contact, shipping, returns, privacy, terms: "text" } }
// Saves the whole footer at once. A link is a full address on the network's own
// site (or "@name"); it is cleaned up and the clean address is what is stored.
// A network that is switched on needs a link. Leaving out shop_category_ids or
// pages keeps what is stored.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const stored = await loadFooter(req.scope, salesChannelId)
  const parsed = parseFooterContent(req.body, stored)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }

  await assertCategoriesOwned(req.scope, salesChannelId, parsed.value.shop_category_ids)

  await saveFooter(req.scope, salesChannelId, parsed.value)

  // Read it back so the answer shows what is really stored
  const footer = await loadFooter(req.scope, salesChannelId)
  res.json({ footer, limits: LIMITS })
}
