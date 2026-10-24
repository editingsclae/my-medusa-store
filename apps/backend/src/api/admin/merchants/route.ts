import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  createUsersWorkflow,
} from "@medusajs/core-flows"
import {
  normalizeCountries,
  parseShippingAmount,
  provisionMerchantFulfillment,
} from "../merchant/fulfillment"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Query all users that have merchant role or a sales_channel_id in metadata
  const { data: users } = await query.graph({
    entity: "user",
    fields: ["id", "email", "first_name", "last_name", "metadata", "created_at"],
  })

  const merchantUsers = users.filter(
    (u) => u.metadata?.role === "merchant" || u.metadata?.sales_channel_id
  )

  const merchants: any[] = []
  for (const user of merchantUsers) {
    const channelId = user.metadata?.sales_channel_id

    let salesChannel: any = null
    let productCount = 0
    let orderCount = 0

    if (channelId) {
      const { data: channels } = await query.graph({
        entity: "sales_channel",
        fields: ["id", "name", "description", "is_disabled"],
        filters: { id: channelId },
      })
      salesChannel = channels?.[0] || null

      const { metadata: prodMeta } = await query.graph({
        entity: "product",
        fields: ["id"],
        filters: { sales_channels: { id: channelId } } as any,
      })
      productCount = prodMeta?.count ?? 0

      const { metadata: ordMeta } = await query.graph({
        entity: "order",
        fields: ["id"],
        filters: { sales_channel_id: channelId },
      })
      orderCount = ordMeta?.count ?? 0
    }

    merchants.push({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
      },
      sales_channel: salesChannel,
      stock_location_id: user.metadata?.stock_location_id,
      product_count: productCount,
      order_count: orderCount,
    })
  }

  res.json({ merchants })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as any

  if (!body.name || !body.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Merchant name and email are required"
    )
  }

  const merchantName = body.name.trim()
  const merchantEmail = body.email.trim().toLowerCase()

  // Validate the delivery settings before anything is created
  const { countries, invalid } = normalizeCountries(body.countries)
  if (invalid.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid country codes: ${invalid.join(", ")}. Use two-letter codes such as "tn".`
    )
  }
  const shippingAmount = parseShippingAmount(body.shipping_price)
  if (shippingAmount === null) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "shipping_price must be a number that is zero or more"
    )
  }

  // 1. Create Sales Channel
  const { result: channelResult } = await createSalesChannelsWorkflow(req.scope).run({
    input: {
      salesChannelsData: [
        {
          name: merchantName,
          description: body.description || `Sales channel for ${merchantName}`,
        },
      ],
    },
  })
  const salesChannel = channelResult[0]

  // 2. Create Stock Location
  const { result: locationResult } = await createStockLocationsWorkflow(req.scope).run({
    input: {
      locations: [
        {
          name: `${merchantName} Warehouse`,
        },
      ],
    },
  })
  const stockLocation = locationResult[0]

  // 3. Link Stock Location to Sales Channel
  await linkSalesChannelsToStockLocationWorkflow(req.scope).run({
    input: {
      id: stockLocation.id,
      add: [salesChannel.id],
    },
  })

  // 3b. Delivery setup (fulfillment set, zone, shipping option). The merchant
  // already exists at this point, so a failure is reported instead of thrown;
  // it can be repeated with the backfill script.
  let fulfillmentResult: Record<string, unknown> | null = null
  let fulfillmentError: string | null = null
  try {
    fulfillmentResult = await provisionMerchantFulfillment(req.scope, {
      merchantName,
      stockLocationId: stockLocation.id,
      countries,
      shippingAmount,
    })
  } catch (err) {
    fulfillmentError = err instanceof Error ? err.message : String(err)
    console.warn("Could not set up merchant fulfillment:", err)
  }

  // 4. Create Publishable API Key for this Sales Channel (for storefront)
  const currentUserId = (req as any).auth_context?.actor_id || "admin"
  const { result: keyResult } = await createApiKeysWorkflow(req.scope).run({
    input: {
      api_keys: [
        {
          title: `${merchantName} Storefront Key`,
          type: "publishable",
          created_by: currentUserId,
        },
      ],
    },
  })
  const apiKey = keyResult[0]

  // 5. Link Key to Sales Channel
  await linkSalesChannelsToApiKeyWorkflow(req.scope).run({
    input: {
      id: apiKey.id,
      add: [salesChannel.id],
    },
  })

  // 6. Create User account with merchant metadata
  const { result: userResult } = await createUsersWorkflow(req.scope).run({
    input: {
      users: [
        {
          email: merchantEmail,
          first_name: body.first_name || merchantName,
          last_name: body.last_name || "",
          metadata: {
            role: "merchant",
            sales_channel_id: salesChannel.id,
            stock_location_id: stockLocation.id,
          },
        },
      ],
    },
  })
  const merchantUser = userResult[0]

  // 7. If password was provided, register emailpass auth identity and link to user
  if (body.password) {
    try {
      const authService = req.scope.resolve(Modules.AUTH)
      const authRes = await authService.register("emailpass", {
        body: {
          email: merchantEmail,
          password: body.password,
        },
      } as any)

      if (authRes.success && authRes.authIdentity) {
        await authService.updateAuthIdentities({
          id: authRes.authIdentity.id,
          app_metadata: {
            user_id: merchantUser.id,
          },
        })
      }
    } catch (authErr) {
      console.warn("Could not register password auth identity:", authErr)
    }
  }

  res.status(201).json({
    message: "Merchant created successfully",
    merchant: {
      user: merchantUser,
      sales_channel: salesChannel,
      stock_location: stockLocation,
      publishable_key: apiKey.token,
      fulfillment: fulfillmentResult,
      ...(fulfillmentError ? { fulfillment_error: fulfillmentError } : {}),
    },
  })
}
