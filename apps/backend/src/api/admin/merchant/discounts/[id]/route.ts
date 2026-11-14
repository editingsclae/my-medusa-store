import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { deletePriceListsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import { requireSalesChannelId } from "../../category-access"
import { discountDescription, readDiscountMetadata } from "../../discount-rules"

// DELETE /admin/merchant/discounts/:id
// Stops and removes one of the merchant's discounts. The products go back to
// their normal price at once.
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const id = req.params.id

  const { data } = await query.graph({
    entity: "price_list",
    fields: ["id", "description", "metadata"],
    filters: { id, description: discountDescription(merchantId) },
  })
  const priceList = (data as any[])?.[0]

  // Another merchant's discount looks exactly like one that does not exist
  if (!priceList || !readDiscountMetadata(priceList.metadata, merchantId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Discount not found")
  }

  await deletePriceListsWorkflow(req.scope).run({ input: { ids: [id] } })

  res.json({ id, object: "discount", deleted: true })
}
