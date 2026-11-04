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
 * { slug, title, text, blocks }.
 *
 * Draw `blocks`: the text the merchant wrote, already split into safe pieces
 * (see rich-text.ts), so a storefront needs no Markdown parser and never
 * handles HTML:
 *   heading    { type: "heading", level: 1 | 2 | 3, content: Inline[] }
 *   paragraph  { type: "paragraph", content: Inline[] }
 *   list       { type: "list", ordered: boolean, items: [{ content: Inline[], children: list[] }] }
 *   rule       { type: "rule" }
 * An Inline is { type: "text", text, bold?, italic? }, { type: "break" } or
 * { type: "link", href, children: text[] } (href is https, mailto: or tel:).
 * `text` is the raw text, for a storefront that only wants plain text.
 * A page the merchant has not written is a 404.
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
