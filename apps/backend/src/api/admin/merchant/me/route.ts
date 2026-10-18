import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMerchantContext } from "../utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)

  res.json({
    merchant: {
      id: context.user.id,
      email: context.user.email,
      first_name: context.user.first_name,
      last_name: context.user.last_name,
      is_super_admin: context.isSuperAdmin,
      sales_channel: context.salesChannel,
      stock_location_id: context.stockLocationId,
      currency_code: context.currencyCode,
    },
  })
}
