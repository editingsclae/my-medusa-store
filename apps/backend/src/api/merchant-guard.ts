import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// The only admin API surface a merchant may call: /admin/merchant and anything
// below it. The pattern is deliberately strict. Other casing, encoded dots,
// double slashes and /admin/merchants (platform provisioning) do not match, so
// they are treated as core admin routes and refused for merchants.
const MERCHANT_API_PATH = /^\/admin\/merchant(\/[A-Za-z0-9_-]+)*\/?$/

// Mirrors how getMerchantContext() and GET /admin/merchants identify merchants:
// an explicit merchant role, or a sales channel binding without the admin role.
export function isScopedMerchant(
  metadata?: Record<string, unknown> | null
): boolean {
  const role = metadata?.role

  if (role === "admin") {
    return false
  }

  return role === "merchant" || Boolean(metadata?.sales_channel_id)
}

// Merchants authenticate as ordinary Medusa admin users, so their token is
// accepted by every core /admin route (orders, products, customers, api-keys,
// users, analytics plugin) and by the admin dashboard at /app. This keeps them
// on /admin/merchant/* only. Platform admins and secret API keys pass through.
export async function blockMerchantsFromCoreAdmin(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const auth = req.auth_context

    if (auth?.actor_type !== "user" || !auth.actor_id) {
      return next()
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: users } = await query.graph({
      entity: "user",
      fields: ["id", "metadata"],
      filters: { id: auth.actor_id },
    })

    if (!isScopedMerchant(users?.[0]?.metadata)) {
      return next()
    }

    const pathname = req.originalUrl.split("?")[0]

    if (MERCHANT_API_PATH.test(pathname)) {
      return next()
    }

    return res.status(403).json({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  } catch (error) {
    // Fail closed: if the role lookup breaks, the request is not let through.
    return next(error)
  }
}
