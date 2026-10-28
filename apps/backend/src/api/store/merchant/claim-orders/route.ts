import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { parseOrderIds, planClaim, MAX_CLAIM_IDS } from "../../../guest-claim"
import { salesChannelIdsFromKey } from "../../../store-key"

/**
 * POST /store/merchant/claim-orders   { order_ids: string[] }
 *
 * Needs the customer's token. Moves the guest orders named in order_ids to the
 * logged-in customer when they belong to a guest with the same email, in the
 * merchant of the publishable key. Anything else is skipped quietly, so the
 * answer never tells whether somebody else's order id exists.
 *
 * Answer: { claimed: string[], already_yours: string[] }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Log in first")
  }

  const body = (req.body || {}) as { order_ids?: unknown }
  const orderIds = parseOrderIds(body.order_ids)
  if (!orderIds) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `order_ids must be a list of 1 to ${MAX_CLAIM_IDS} order ids`
    )
  }

  const channelIds = salesChannelIdsFromKey(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account"],
    filters: { id: customerId },
  })

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "email", "customer_id", "sales_channel_id"],
    filters: { id: orderIds, sales_channel_id: channelIds } as any,
  })

  const ownerIds = Array.from(
    new Set((orders as any[]).map((o) => o?.customer_id).filter(Boolean))
  ) as string[]

  const { data: owners } =
    ownerIds.length > 0
      ? await query.graph({
          entity: "customer",
          fields: ["id", "email", "has_account"],
          filters: { id: ownerIds },
        })
      : { data: [] as any[] }

  const plan = planClaim({
    customer: customers?.[0] as any,
    orders: orders as any[],
    owners: owners as any[],
    channelIds,
  })

  if (plan.claim.length > 0) {
    const orderModule = req.scope.resolve(Modules.ORDER)
    await orderModule.updateOrders(
      plan.claim.map((id) => ({ id, customer_id: customerId }))
    )
  }

  res.json({ claimed: plan.claim, already_yours: plan.alreadyYours })
}
