import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadFooter } from "../../../../admin/merchant/footer-access"
import { publicPage } from "../../../../footer-content"
import { salesChannelIdsFromKey } from "../../../../store-key"

/**
 * GET /store/merchant/pages/:slug
 *
 * A support page of the merchant whose publishable key is on the request. The
 * slug is one of contact, shipping, returns, privacy, terms. Answer:
 * { slug, title, text } where text is plain text and a blank line separates
 * paragraphs (show it as text, never as HTML). A page the merchant has not
 * written is a 404.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channelIds = salesChannelIdsFromKey(req)
  const footer = await loadFooter(req.scope, channelIds[0])

  const page = publicPage(footer, req.params.slug)
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Page not found")
  }
  res.json(page)
}
