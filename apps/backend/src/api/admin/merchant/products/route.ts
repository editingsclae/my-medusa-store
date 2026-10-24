import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createProductsWorkflow, createInventoryLevelsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"
import { assertCategoriesOwned, onlyOwnedCategories } from "../category-access"
import { getDefaultShippingProfileId } from "../fulfillment"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0
  const search = req.query.q as string | undefined
  const status = req.query.status as string | undefined

  const filters: Record<string, any> = {}

  if (context.salesChannelId) {
    filters["sales_channels"] = {
      id: context.salesChannelId,
    }
  }

  if (status) {
    filters["status"] = status
  }

  if (search) {
    filters["title"] = {
      $ilike: `%${search}%`,
    }
  }

  const { data: products, metadata } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "subtitle",
      "description",
      "status",
      "thumbnail",
      "images.*",
      "created_at",
      "updated_at",
      "sales_channels.id",
      "sales_channels.name",
      "categories.id",
      "categories.name",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.*",
      "variants.options.*",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.*",
      "options.*",
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

  const visibleProducts = await onlyOwnedCategories(
    req.scope,
    context.salesChannelId,
    (products || []) as any[]
  )

  // Compute inventory_quantity for each variant from its location_levels
  const enhancedProducts = visibleProducts.map((product: any) => {
    const variants = (product.variants || []).map((v: any) => {
      let totalStock = 0
      const inventoryItems = v.inventory_items || []
      for (const item of inventoryItems) {
        const levels = item.inventory?.location_levels || []
        for (const level of levels) {
          totalStock += Number(level.stocked_quantity || 0)
        }
      }
      return {
        ...v,
        inventory_quantity: totalStock,
      }
    })
    return {
      ...product,
      variants,
    }
  })

  res.json({
    products: enhancedProducts,
    count: metadata?.count ?? enhancedProducts.length,
    limit,
    offset,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const body = req.body as any

  if (!body.title) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Product title is required"
    )
  }

  if (!context.salesChannelId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot create product without an assigned sales channel"
    )
  }

  // Every category id must be one of this merchant's own categories
  const categoryIds =
    body.category_ids !== undefined
      ? await assertCategoriesOwned(req.scope, context.salesChannelId, body.category_ids)
      : []

  const initialStock = body.inventory_quantity !== undefined ? Number(body.inventory_quantity) : 10

  // Format product input for createProductsWorkflow
  const productInput: any = {
    title: body.title,
    subtitle: body.subtitle,
    description: body.description,
    handle: body.handle,
    status: body.status || "published",
    thumbnail: body.thumbnail,
    images: body.images?.map((url: string | { url: string }) =>
      typeof url === "string" ? { url } : url
    ),
    // Without a shipping profile Medusa cannot complete a cart that contains this product
    shipping_profile_id: await getDefaultShippingProfileId(req.scope),
    sales_channels: [
      {
        id: context.salesChannelId,
      },
    ],
    ...(categoryIds.length > 0 ? { category_ids: categoryIds } : {}),
    options: body.options?.length
      ? body.options
      : [{ title: "Default Option", values: ["Default"] }],
  }

  // Handle variants and pricing
  if (body.variants?.length) {
    productInput.variants = body.variants.map((v: any) => ({
      title: v.title || "Default Variant",
      sku: v.sku,
      manage_inventory: true,
      prices: v.prices || [
        {
          currency_code: (v.currency_code || context.currencyCode).toLowerCase(),
          amount: Number(v.price ?? v.amount ?? 0),
        },
      ],
      options: v.options || { "Default Option": "Default" },
    }))
  } else {
    // Default single variant if none provided
    productInput.variants = [
      {
        title: "Default Variant",
        sku: body.sku,
        manage_inventory: true,
        prices: [
          {
            currency_code: (body.currency_code || context.currencyCode).toLowerCase(),
            amount: Number(body.price ?? 0),
          },
        ],
        options: { "Default Option": "Default" },
      },
    ]
  }

  const { result } = await createProductsWorkflow(req.scope).run({
    input: {
      products: [productInput],
    },
  })

  const createdProduct = result[0]

  // If a stock quantity was specified and a stock location is available, create inventory levels
  if (context.stockLocationId && initialStock >= 0 && createdProduct?.id) {
    try {
      // Query created variant's inventory item
      const { data: freshProducts } = await query.graph({
        entity: "product",
        fields: [
          "id",
          "variants.id",
          "variants.inventory_items.inventory.id",
        ],
        filters: { id: createdProduct.id },
      })

      const invLevelsToCreate: { inventory_item_id: string; location_id: string; stocked_quantity: number }[] = []
      const freshVariants = freshProducts?.[0]?.variants || []

      for (const fv of freshVariants) {
        for (const item of ((fv as any).inventory_items || [])) {
          if (item && item.inventory && item.inventory.id) {
            invLevelsToCreate.push({
              inventory_item_id: item.inventory.id,
              location_id: context.stockLocationId,
              stocked_quantity: initialStock,
            })
          }
        }
      }

      if (invLevelsToCreate.length > 0) {
        await createInventoryLevelsWorkflow(req.scope).run({
          input: {
            inventory_levels: invLevelsToCreate,
          },
        })
      }
    } catch (invErr) {
      console.warn("Failed to set initial inventory levels:", invErr)
    }
  }

  res.status(201).json({
    product: createdProduct,
  })
}
