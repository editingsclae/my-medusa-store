import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../../utils"
import { requireSalesChannelId } from "../../category-access"
import { MAX_PAGE_LENGTH, previewPage } from "../../../../footer-content"

// POST /admin/merchant/footer/preview
//   { text: "..." }
// How a support page with this text will look to shoppers: { blocks: [...] }.
// Nothing is saved. The portal uses it for the preview, so the merchant sees
// exactly what the storefront will draw.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  requireSalesChannelId(context)

  const body = (req.body ?? {}) as { text?: unknown }
  if (typeof body.text !== "string") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Send the text of the page")
  }

  const result = previewPage(body.text)
  if (!result.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, result.error)
  }
  res.json({ blocks: result.blocks, limit: MAX_PAGE_LENGTH })
}
