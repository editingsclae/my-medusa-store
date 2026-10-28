// Rules for moving a guest's earlier orders to the account the guest registers.
// No framework imports, so the rules can be unit tested on their own.
//
// There is no email verification, so the email alone proves nothing: anybody
// can register with somebody else's email. An order is only moved when the
// caller names its id (the storefront remembers the ids of the orders placed
// in that browser) AND the order belongs to a guest customer with the same
// email as the logged-in account, in the merchant of the publishable key.

export const MAX_CLAIM_IDS = 20
const MAX_ID_LENGTH = 100

export type ClaimCustomer = {
  id: string
  email?: string | null
  has_account?: boolean | null
}

export type ClaimOrder = {
  id: string
  email?: string | null
  customer_id?: string | null
  sales_channel_id?: string | null
}

export type ClaimPlan = {
  // Orders to move to the logged-in customer
  claim: string[]
  // Orders that already belong to the logged-in customer
  alreadyYours: string[]
}

// The order ids sent by the storefront: a list of 1 to 20 distinct strings.
// Returns null for anything else.
export function parseOrderIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0) {
    return null
  }

  const ids: string[] = []
  for (const item of input) {
    if (typeof item !== "string") {
      return null
    }
    const id = item.trim()
    if (id.length === 0 || id.length > MAX_ID_LENGTH) {
      return null
    }
    if (!ids.includes(id)) {
      ids.push(id)
    }
  }
  return ids.length > MAX_CLAIM_IDS ? null : ids
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function planClaim(input: {
  customer: ClaimCustomer | null | undefined
  orders: Array<ClaimOrder | null | undefined>
  owners: Array<ClaimCustomer | null | undefined>
  channelIds: string[]
}): ClaimPlan {
  const plan: ClaimPlan = { claim: [], alreadyYours: [] }
  const { customer, channelIds } = input
  const email = normalizeEmail(customer?.email)

  // Only a registered account can receive orders
  if (!customer || !customer.id || customer.has_account !== true || email === "") {
    return plan
  }

  const owners = new Map<string, ClaimCustomer>()
  for (const owner of input.owners) {
    if (owner && owner.id) {
      owners.set(owner.id, owner)
    }
  }

  for (const order of input.orders) {
    if (!order || !order.id) {
      continue
    }
    // Another merchant's order is never touched
    if (!order.sales_channel_id || !channelIds.includes(order.sales_channel_id)) {
      continue
    }
    if (order.customer_id === customer.id) {
      plan.alreadyYours.push(order.id)
      continue
    }

    const owner = order.customer_id ? owners.get(order.customer_id) : undefined
    // Only a guest's order can move. An order of another registered account
    // never does, even with the same email.
    if (!owner || owner.has_account !== false) {
      continue
    }
    if (normalizeEmail(owner.email) !== email) {
      continue
    }
    // The email the order was placed with has to match too
    if (order.email && normalizeEmail(order.email) !== email) {
      continue
    }
    plan.claim.push(order.id)
  }

  return plan
}
