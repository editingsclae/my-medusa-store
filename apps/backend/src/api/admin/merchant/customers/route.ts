import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantContext } from "../utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0
  const search = req.query.q as string | undefined

  let customerIds: string[] | null = null

  // If scoped to a merchant's sales channel, find all customers who have ordered from this sales channel
  if (context.salesChannelId && !context.isSuperAdmin) {
    const { data: channelOrders } = await query.graph({
      entity: "order",
      fields: ["customer_id"],
      filters: {
        sales_channel_id: context.salesChannelId,
      },
    })

    const uniqueIds = Array.from(
      new Set(channelOrders.map((o: any) => o.customer_id).filter(Boolean))
    ) as string[]

    customerIds = uniqueIds
  }

  // Build filters
  const filters: Record<string, any> = {}

  if (customerIds !== null) {
    if (customerIds.length === 0) {
      return res.json({
        customers: [],
        count: 0,
        limit,
        offset,
      })
    }
    filters["id"] = customerIds
  }

  if (search) {
    filters["$or"] = [
      { email: { $ilike: `%${search}%` } },
      { first_name: { $ilike: `%${search}%` } },
      { last_name: { $ilike: `%${search}%` } },
    ]
  }

  const { data: customers, metadata } = await query.graph({
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
      "addresses.*",
    ],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: {
        created_at: "DESC",
      },
    },
  })

  // Format customer data
  const formattedCustomers = customers.map((c: any) => ({
    id: c.id,
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Guest Customer",
    phone: c.phone,
    has_account: Boolean(c.has_account),
    account_status: c.has_account ? "Registered" : "Guest",
    created_at: c.created_at,
    addresses: c.addresses || [],
  }))

  res.json({
    customers: formattedCustomers,
    count: metadata?.count ?? customers.length,
    limit,
    offset,
  })
}
