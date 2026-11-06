import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMerchantContext } from "../../utils"
import { requireSalesChannelId } from "../../category-access"
import { saveLayoutKeyHash } from "../../storefront-layout-access"
import { hashLayoutKey, newLayoutKey } from "../../../../storefront-layout"

// POST /admin/merchant/storefront/layout-key
// Creates a new layout key for the merchant's storefront and returns it. It is
// shown once: only a hash is kept. A key created before stops working.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const key = newLayoutKey()
  await saveLayoutKeyHash(req.scope, salesChannelId, hashLayoutKey(key))

  res.json({ layout_key: key })
}
