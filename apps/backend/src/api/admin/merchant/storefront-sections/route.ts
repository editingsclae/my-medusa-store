import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"
import { requireSalesChannelId } from "../category-access"
import { loadLayout } from "../storefront-layout-access"
import { loadSectionSettings, ownedProductIds, saveSectionSettings } from "../storefront-sections-access"
import {
  BEST_SELLERS_DAYS,
  SECTION_TITLES,
  TRENDING_DAYS,
  parseSettings,
  type SectionDeclaration,
  type SectionSettings,
} from "../../../storefront-sections"

// What the portal shows: the choices, and the sections the storefront declared
function answer(declared: SectionDeclaration[], settings: SectionSettings) {
  return {
    settings,
    declared: declared.map((section) => ({
      key: section.key,
      count: section.count,
      default_title: SECTION_TITLES[section.key],
    })),
    windows: { best_sellers_days: BEST_SELLERS_DAYS, trending_days: TRENDING_DAYS },
  }
}

// GET /admin/merchant/storefront-sections
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const { layout } = await loadLayout(req.scope, salesChannelId)
  const settings = await loadSectionSettings(req.scope, salesChannelId)
  res.json(answer(layout.sections ?? [], settings))
}

// POST /admin/merchant/storefront-sections
//   { sections: { <key>: { enabled, title } }, featured_ids: [productId, ...] }
// The merchant switches a section off, renames it and chooses the Featured Products.
// There can be no more featured products than the storefront has room for, and
// every one has to be the merchant's own.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const { layout } = await loadLayout(req.scope, salesChannelId)
  const declared = layout.sections ?? []
  const featuredLimit = declared.find((s) => s.key === "featured")?.count ?? 0

  const current = await loadSectionSettings(req.scope, salesChannelId)
  const parsed = parseSettings(req.body, featuredLimit, current)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }

  const owned = await ownedProductIds(req.scope, salesChannelId, parsed.value.featured_ids)
  const foreign = parsed.value.featured_ids.filter((id) => !owned.has(id))
  if (foreign.length > 0) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "A featured product is not one of your products")
  }

  await saveSectionSettings(req.scope, salesChannelId, parsed.value)
  res.json(answer(declared, parsed.value))
}
