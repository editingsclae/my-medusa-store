// A coupon can need a minimum order. Medusa has no rule for that, so it is checked when the
// order is placed: a cart below the minimum cannot be completed with that coupon.
// Anything unexpected here lets the order through, so a problem in this check can never
// stop a shopper from ordering.
import { completeCartWorkflow } from "@medusajs/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { COUPON_KIND, minOrderProblem } from "../../api/admin/merchant/coupon-rules"

completeCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  let problem: string | null = null
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "currency_code", "items.unit_price", "items.quantity", "promotions.code", "promotions.metadata"],
      filters: { id: input.id },
    })
    const cart = (data as any[])?.[0]
    if (!cart) return

    // The worth of the items before any discount
    const subtotal = (cart.items || []).reduce(
      (sum: number, item: any) => sum + Number(item.unit_price) * Number(item.quantity),
      0
    )

    for (const promotion of cart.promotions || []) {
      const meta = promotion?.metadata
      if (!meta || meta.kind !== COUPON_KIND) continue
      const minOrder = typeof meta.min_order === "number" && meta.min_order > 0 ? meta.min_order : null
      const message = minOrderProblem(minOrder, subtotal, cart.currency_code || "")
      if (message) {
        problem = message
        break
      }
    }
  } catch (err) {
    console.error("Could not check the minimum order of a coupon:", err)
    return
  }

  if (problem) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, problem)
  }
})
