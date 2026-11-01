// The rules behind the claim-orders workflow: what to write, and how to undo it.
// No framework imports, so they can be unit tested with a fake order module.

export type ClaimUpdate = {
  id: string
  // The customer the order moves to
  customer_id: string
  // The customer that owned it before (the guest), kept to undo the move
  previous_customer_id: string
}

// The minimum of the order module this needs
export type OrderUpdater = {
  updateOrders(data: Array<{ id: string; customer_id: string }>): Promise<unknown>
}

// One update per order to claim, remembering who owned it. An id that is not in
// `orders`, or an order without an owner, is left out: there would be nothing to
// restore, and the plan only claims orders that belong to a guest.
export function buildClaimUpdates(
  claimIds: string[],
  orders: Array<{ id: string; customer_id?: string | null }>,
  customerId: string
): ClaimUpdate[] {
  const byId = new Map(orders.map((order) => [order.id, order]))
  const updates: ClaimUpdate[] = []

  for (const id of claimIds) {
    const previous = byId.get(id)?.customer_id
    if (typeof previous === "string" && previous !== "") {
      updates.push({ id, customer_id: customerId, previous_customer_id: previous })
    }
  }
  return updates
}

// Moves the orders. Returns the ids that were moved. An error is not caught: the
// workflow then runs undoClaim.
export async function applyClaim(
  orders: OrderUpdater,
  updates: ClaimUpdate[]
): Promise<string[]> {
  if (updates.length === 0) {
    return []
  }
  await orders.updateOrders(
    updates.map((update) => ({ id: update.id, customer_id: update.customer_id }))
  )
  return updates.map((update) => update.id)
}

// Gives the orders back to the customers that owned them
export async function undoClaim(orders: OrderUpdater, updates: ClaimUpdate[]): Promise<void> {
  if (updates.length === 0) {
    return
  }
  await orders.updateOrders(
    updates.map((update) => ({ id: update.id, customer_id: update.previous_customer_id }))
  )
}
