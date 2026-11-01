import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  MAX_CLAIM_IDS,
  normalizeEmail,
  parseClaimRequest,
  planClaim,
} from "../../../guest-claim"
import { isVerified } from "../../../email-verification"
import {
  loadVerificationState,
  requireActor,
} from "../../../email-verification-access"
import { salesChannelIdsFromKey } from "../../../store-key"
import { claimOrdersWorkflow } from "../../../../workflows/claim-orders"
import { buildClaimUpdates } from "../../../../workflows/claim-orders-logic"

// Guest orders moved in one request when no ids are named
const MAX_ORDERS_BY_EMAIL = 100

/**
 * POST /store/merchant/claim-orders   { order_ids?: string[] }
 *
 * Needs the customer's token, and the customer's email has to be confirmed
 * (see /store/merchant/email-verification): otherwise the answer is 403
 * { code: "email_not_verified" }.
 *
 * Moves guest orders to the logged-in customer when they belong to a guest with
 * the same email, in the merchant of the publishable key. With order_ids only
 * those orders are looked at; without order_ids every guest order of the
 * confirmed email (up to 100) is moved, so it works from any device. Anything
 * else is skipped quietly, so the answer never tells whether somebody else's
 * order id exists.
 *
 * Answer: { claimed: string[], already_yours: string[] }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { customerId, identityId } = requireActor(req)

  const request = parseClaimRequest(req.body)
  if (!request) {
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
  const customer = customers?.[0] as any

  const state = await loadVerificationState(req.scope, identityId)
  if (!isVerified(state, customer?.email)) {
    return res.status(403).json({
      code: "email_not_verified",
      message: "Confirm your email address first",
    })
  }

  let orders: any[]
  let owners: any[]

  if (request.mode === "ids") {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "email", "customer_id", "sales_channel_id"],
      filters: { id: request.ids, sales_channel_id: channelIds } as any,
    })
    orders = data as any[]

    const ownerIds = Array.from(
      new Set(orders.map((o) => o?.customer_id).filter(Boolean))
    ) as string[]

    const { data: found } =
      ownerIds.length > 0
        ? await query.graph({
            entity: "customer",
            fields: ["id", "email", "has_account"],
            filters: { id: ownerIds },
          })
        : { data: [] as any[] }
    owners = found as any[]
  } else {
    // The guest customers of this email, then their orders in this merchant
    const { data: guests } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "has_account"],
      filters: { email: normalizeEmail(customer.email), has_account: false } as any,
    })
    owners = guests as any[]

    if (owners.length === 0) {
      orders = []
    } else {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "email", "customer_id", "sales_channel_id"],
        filters: {
          customer_id: owners.map((o) => o.id),
          sales_channel_id: channelIds,
        } as any,
        pagination: { take: MAX_ORDERS_BY_EMAIL },
      })
      orders = data as any[]
    }
  }

  const plan = planClaim({
    customer,
    orders,
    owners,
    channelIds,
  })

  const updates = buildClaimUpdates(plan.claim, orders, customerId)
  if (updates.length > 0) {
    await claimOrdersWorkflow(req.scope).run({ input: { updates } })
  }

  res.json({ claimed: plan.claim, already_yours: plan.alreadyYours })
}
