import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { normalizeCountries, parseShippingAmount } from "../merchant/fulfillment"
import { createMerchantSteps, MerchantSetupError } from "./merchant-creation"
import { createMerchantOps } from "./merchant-ops"

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

      // The total only comes back when a page is requested, so ask for one row
      const { data: prodRows, metadata: prodMeta } = await query.graph({
        entity: "product",
        fields: ["id"],
        filters: { sales_channels: { id: channelId } } as any,
        pagination: { take: 1, skip: 0 },
      })
      productCount = prodMeta?.count ?? prodRows.length

      const { data: ordRows, metadata: ordMeta } = await query.graph({
        entity: "order",
        fields: ["id"],
        filters: { sales_channel_id: channelId },
        pagination: { take: 1, skip: 0 },
      })
      orderCount = ordMeta?.count ?? ordRows.length
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

  const merchantName = String(body.name).trim()
  const merchantEmail = String(body.email).trim().toLowerCase()

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

  let created
  try {
    created = await createMerchantSteps(createMerchantOps(req.scope), {
      name: merchantName,
      email: merchantEmail,
      description: body.description,
      firstName: body.first_name,
      lastName: body.last_name,
      password: body.password,
      countries,
      shippingAmount,
      createdBy: (req as any).auth_context?.actor_id || "admin",
    })
  } catch (err) {
    if (err instanceof MerchantSetupError) {
      throw new MedusaError(
        err.kind === "duplicate"
          ? MedusaError.Types.DUPLICATE_ERROR
          : MedusaError.Types.UNEXPECTED_STATE,
        err.message
      )
    }
    throw err
  }

  res.status(201).json({
    message: "Merchant created successfully",
    merchant: {
      user: created.user,
      sales_channel: created.channel,
      stock_location: created.location,
      publishable_key: created.key.token,
      fulfillment: created.fulfillment,
      ...(created.fulfillmentError ? { fulfillment_error: created.fulfillmentError } : {}),
    },
  })
}
