import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

// The sales channels of the publishable key on a storefront request. The key is
// the only thing a storefront cannot change, so merchant scoping starts here.
export function salesChannelIdsFromKey(req: MedusaRequest): string[] {
  const ids = (req as any).publishable_key_context?.sales_channel_ids
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Publishable key needs to have a sales channel configured"
    )
  }
  return ids
}
