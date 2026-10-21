import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getMerchantContext } from "../../utils"
import { uniqueAddresses } from "../../ownership"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerId = req.params.id

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "phone",
      "has_account",
      "created_at",
      "updated_at",
      // Saved addresses are only read for platform admins. A merchant gets the
      // addresses from its own orders instead (see below).
      ...(context.isSuperAdmin ? ["addresses.*"] : []),
    ],
    filters: { id: customerId },
  })

  const customer = customers?.[0]
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found")
  }

  // Fetch orders placed by this customer (scoped to merchant's sales channel if applicable)
  const orderFilters: Record<string, any> = {
    customer_id: customerId,
  }
  if (context.salesChannelId && !context.isSuperAdmin) {
    orderFilters.sales_channel_id = context.salesChannelId
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "status",
      "payment_status",
      "fulfillment_status",
      "total",
      "currency_code",
      "items.id",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.thumbnail",
      "shipping_address.*",
    ],
    filters: orderFilters,
    pagination: {
      order: { created_at: "DESC" },
    },
  })

  // Customers are global in Medusa. A merchant may only see a customer who has
  // ordered from its own sales channel, and only the addresses used on those
  // orders, not addresses saved while buying from another merchant.
  if (!context.isSuperAdmin) {
    if (!orders || orders.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found")
    }
    customer.addresses = uniqueAddresses(
      orders.map((o: any) => o.shipping_address)
    ) as any
  }

  res.json({
    customer: {
      ...customer,
      name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Guest Customer",
      account_status: customer.has_account ? "Registered" : "Guest",
    },
    orders: orders || [],
  })
}
