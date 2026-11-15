import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { deleteCampaignsWorkflow, deletePromotionsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import { requireSalesChannelId } from "../../category-access"
import { readCouponMetadata } from "../../coupon-rules"

// DELETE /admin/merchant/coupons/:id
// Stops the coupon. Orders that already used it keep their discount.
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const id = req.params.id

  const { data } = await query.graph({
    entity: "promotion",
    fields: ["id", "metadata", "campaign_id"],
    filters: { id },
  })
  const promotion = (data as any[])?.[0]
  // Another merchant's coupon looks exactly like one that does not exist
  if (!promotion || !readCouponMetadata(promotion.metadata, merchantId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Coupon not found")
  }

  await deletePromotionsWorkflow(req.scope).run({ input: { ids: [id] } })
  if (promotion.campaign_id) {
    await deleteCampaignsWorkflow(req.scope).run({ input: { ids: [promotion.campaign_id] } })
  }

  res.json({ id, object: "coupon", deleted: true })
}
