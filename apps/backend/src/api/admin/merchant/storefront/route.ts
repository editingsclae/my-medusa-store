import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"
import { assertCategoriesOwned, requireSalesChannelId } from "../category-access"
import { loadStorefrontContent, saveStorefrontContent } from "../storefront-access"
import { loadLayout } from "../storefront-layout-access"
import type { StorefrontLayout } from "../../../storefront-layout"
import {
  MAX_BUTTON_LENGTH,
  MAX_CATEGORY_TILES,
  MAX_HERO_SLIDES,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  parseStorefrontContent,
} from "../../../storefront-content"

// promo_banners is the number of places the merchant's storefront has
const limitsFor = (promoBanners: number) => ({
  hero_slides: MAX_HERO_SLIDES,
  promo_banners: promoBanners,
  category_tiles: MAX_CATEGORY_TILES,
  label: MAX_LABEL_LENGTH,
  title: MAX_TITLE_LENGTH,
  text: MAX_TEXT_LENGTH,
  button_label: MAX_BUTTON_LENGTH,
})

// What the portal shows about the storefront's layout
const layoutInfo = (layout: StorefrontLayout, keySet: boolean) => ({
  promo_banners: layout.promo_banners,
  declared: layout.declared_at !== undefined,
  declared_at: layout.declared_at ?? null,
  key_set: keySet,
})

// GET /admin/merchant/storefront
// The merchant's banners (including the ones that are switched off) and
// category tiles, the limits (the number of promo banners is the one the
// storefront declared) and the storefront's layout.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const storefront = await loadStorefrontContent(req.scope, salesChannelId)
  const { layout, keySet } = await loadLayout(req.scope, salesChannelId)
  res.json({ storefront, limits: limitsFor(layout.promo_banners), layout: layoutInfo(layout, keySet) })
}

// POST /admin/merchant/storefront
//   { hero_slides: [...], promo_banners: [...], category_tiles: [...] }
// Saves everything at once. Images are uploaded first with
// POST /admin/merchant/upload and their urls are sent here. A tile is
// { id?, category_id, image_url } and every category has to be the merchant's own.
// Leaving out category_tiles keeps the tiles that are stored.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const stored = await loadStorefrontContent(req.scope, salesChannelId)
  const { layout, keySet } = await loadLayout(req.scope, salesChannelId)
  const parsed = parseStorefrontContent(req.body, stored, { promo_banners: layout.promo_banners })
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }

  await assertCategoriesOwned(
    req.scope,
    salesChannelId,
    parsed.value.category_tiles.map((tile) => tile.category_id)
  )

  await saveStorefrontContent(req.scope, salesChannelId, parsed.value)

  // Read it back so the answer shows what is really stored
  const storefront = await loadStorefrontContent(req.scope, salesChannelId)
  res.json({ storefront, limits: limitsFor(layout.promo_banners), layout: layoutInfo(layout, keySet) })
}
