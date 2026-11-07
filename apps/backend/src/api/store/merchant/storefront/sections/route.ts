import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadLayout } from "../../../../admin/merchant/storefront-layout-access"
import {
  loadSalesLines,
  loadSectionSettings,
  publishedProductIds,
} from "../../../../admin/merchant/storefront-sections-access"
import { salesChannelIdsFromKey } from "../../../../store-key"
import { buildSections } from "../../../../storefront-sections"

/**
 * GET /store/merchant/storefront/sections
 *
 * The product sections of the home page of the merchant whose publishable key is on
 * the request: { declared, sections: [{ key, title, product_ids }] }.
 *
 *   declared   false until the storefront has declared its sections with
 *              PUT /store/merchant/storefront/layout; show the plain New Arrivals then
 *   sections   in the order the storefront declared them, only the ones the merchant
 *              has not switched off and that have enough products, each with at most
 *              as many product ids as the storefront declared
 *
 * Keys: new_arrivals (newest products), best_sellers (most sold in 90 days, or in
 * all orders when there are few), trending (most sold in 14 days), featured (the
 * merchant's choice). Load the products with GET /store/products?id[]=... and keep
 * the order of product_ids.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const { layout } = await loadLayout(req.scope, channelIds[0])
  const declared = layout.sections ?? []

  if (declared.length === 0) {
    res.json({ declared: false, sections: [] })
    return
  }

  const needsSales = declared.some((s) => s.key === "best_sellers" || s.key === "trending")
  const [settings, newest, sales] = await Promise.all([
    loadSectionSettings(req.scope, channelIds[0]),
    publishedProductIds(req.scope, channelIds),
    needsSales ? loadSalesLines(req.scope, channelIds[0]) : Promise.resolve([]),
  ])

  res.json({
    declared: true,
    sections: buildSections({ declared, settings, newest, sales, now: Date.now() }),
  })
}
