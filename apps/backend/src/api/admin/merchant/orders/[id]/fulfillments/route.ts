import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../../utils"
import { findForeignIds } from "../../../ownership"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id
  const body = req.body as any

  // Verify order ownership
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "sales_channel_id",
      "items.id",
      "items.quantity",
      "shipping_methods.shipping_option_id",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  if (context.salesChannelId && order.sales_channel_id !== context.salesChannelId && !context.isSuperAdmin) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You do not have permission to fulfill this order"
    )
  }

  // Determine items to fulfill — ensure quantity is always a positive integer
  const orderItems = (order.items || []).filter(Boolean)

  let items: { id: string; quantity: number }[]
  if (body.items && Array.isArray(body.items) && body.items.length > 0) {
    // Validate that every item has a positive quantity
    items = body.items.map((i: any) => {
      const qty = Number(i.quantity)
      if (!i.id || isNaN(qty) || qty <= 0) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid item: each item must have an id and a positive quantity`
        )
      }
      return { id: i.id, quantity: qty }
    })
  } else {
    // Auto-build from unfulfilled order items
    items = orderItems
      .filter((i: any) => i.id && Number(i.quantity) > 0)
      .map((i: any) => ({
        id: i.id,
        quantity: Number(i.quantity),
      }))
  }

  if (items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No items to fulfill"
    )
  }

  // Every item must be a line item of this order
  if (
    findForeignIds(items.map((i) => i.id), orderItems.map((i: any) => i.id)).length > 0
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Items do not belong to this order"
    )
  }

  // A shipping option in the body must be one the order was placed with
  if (
    body.shipping_option_id &&
    findForeignIds(
      [body.shipping_option_id],
      (order.shipping_methods || [])
        .map((sm: any) => sm?.shipping_option_id)
        .filter(Boolean)
    ).length > 0
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Shipping option does not belong to this order"
    )
  }

  // A merchant can only fulfill from its own stock location. Without this a
  // merchant could name another merchant's warehouse in the body.
  const requestedLocationId: string | undefined = body.location_id
  if (
    requestedLocationId &&
    !context.isSuperAdmin &&
    requestedLocationId !== context.stockLocationId
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "You can only fulfill from your own stock location"
    )
  }

  const locationId: string | undefined = requestedLocationId || context.stockLocationId
  if (!locationId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No stock location found for this merchant. Please link a warehouse to your sales channel."
    )
  }

  const labels = body.tracking_number
    ? [
        {
          tracking_number: String(body.tracking_number),
          tracking_url: String(body.tracking_url || ""),
          label_url: "",
        },
      ]
    : []

  const { result } = await createOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      items,
      location_id: locationId,
      shipping_option_id: body.shipping_option_id,
      labels,
    },
  })

  res.status(201).json({ fulfillment: result })
}

/**
 * GET /admin/merchant/orders/:id/fulfillments
 * Returns fulfillment context info: location name, available shipping options
 * so the portal can pre-populate the Fulfill Items panel.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id

  // Get location name
  let locationName = "Merchant Warehouse"
  if (context.stockLocationId) {
    try {
      const { data: locs } = await query.graph({
        entity: "stock_location",
        fields: ["id", "name"],
        filters: { id: context.stockLocationId },
      })
      if (locs?.[0]?.name) {
        locationName = locs[0].name
      }
    } catch {
      // use default
    }
  }

  // Get the order's shipping methods to return shipping option info
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "sales_channel_id",
      "items.id",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.variant_title",
      "items.thumbnail",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.shipping_option_id",
      "shipping_methods.amount",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  if (context.salesChannelId && order.sales_channel_id !== context.salesChannelId && !context.isSuperAdmin) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Access denied")
  }

  res.json({
    location_id: context.stockLocationId || null,
    location_name: locationName,
    shipping_methods: order.shipping_methods || [],
    items: (order.items || []).map((i: any) => ({
      id: i.id,
      title: i.title,
      quantity: Number(i.quantity) || 1,
      unit_price: i.unit_price,
      variant_title: i.variant_title,
      thumbnail: i.thumbnail,
    })),
  })
}

