import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  updateProductsWorkflow,
  deleteProductsWorkflow,
  updateProductVariantsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  createInventoryItemsWorkflow,
} from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import {
  assertCategoriesOwned,
  onlyOwnedCategories,
  requireSalesChannelId,
} from "../../category-access"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.params.id

  const { data: products } = await query.graph({
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
    filters: {
      id: productId,
    },
  })

  const product = products?.[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  // Verify ownership
  if (context.salesChannelId) {
    const belongsToChannel = product.sales_channels?.some(
      (sc: any) => sc.id === context.salesChannelId
    )
    if (!belongsToChannel && !context.isSuperAdmin) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "You do not have access to this product"
      )
    }
  }

  // Calculate inventory_quantity on variants
  const enhancedVariants = (product.variants || []).map((v: any) => {
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

  const [visibleProduct] = await onlyOwnedCategories(
    req.scope,
    context.salesChannelId,
    [product as any]
  )

  res.json({
    product: {
      ...visibleProduct,
      variants: enhancedVariants,
    },
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.params.id
  const body = req.body as any

  // Verify product exists and belongs to merchant
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "sales_channels.id",
      "variants.id",
      "variants.prices.*",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.*",
    ],
    filters: { id: productId },
  })

  const product = products?.[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  if (context.salesChannelId) {
    const belongsToChannel = product.sales_channels?.some(
      (sc: any) => sc.id === context.salesChannelId
    )
    if (!belongsToChannel && !context.isSuperAdmin) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "You do not have permission to update this product"
      )
    }
  }

  const updateData: any = {}

  // category_ids replaces the product's categories, so every id must be one of
  // this merchant's own. Sending an empty array clears them.
  if (body.category_ids !== undefined) {
    updateData.category_ids = await assertCategoriesOwned(
      req.scope,
      requireSalesChannelId(context),
      body.category_ids
    )
  }

  if (body.title !== undefined) updateData.title = body.title
  if (body.subtitle !== undefined) updateData.subtitle = body.subtitle
  if (body.description !== undefined) updateData.description = body.description
  if (body.handle !== undefined) updateData.handle = body.handle
  if (body.status !== undefined) updateData.status = body.status
  if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail
  if (body.images !== undefined) {
    updateData.images = body.images.map((url: string | { url: string }) =>
      typeof url === "string" ? { url } : url
    )
  }

  const { result } = await updateProductsWorkflow(req.scope).run({
    input: {
      selector: { id: productId },
      update: updateData,
    },
  })

  // Update variant price and ensure manage_inventory: true
  if (product.variants?.length) {
    const variantId = product.variants[0].id
    const currency = (body.currency_code || context.currencyCode || "usd").toLowerCase()

    try {
      const variantUpdate: any = { id: variantId, manage_inventory: true }
      if (body.price !== undefined) {
        variantUpdate.prices = [
          {
            amount: Number(body.price),
            currency_code: currency,
          },
        ]
      }
      await updateProductVariantsWorkflow(req.scope).run({
        input: {
          product_variants: [variantUpdate],
        },
      })
    } catch (variantErr) {
      console.warn("Failed to update variant:", variantErr)
    }

    // Update or create inventory quantity
    if (body.inventory_quantity !== undefined && context.stockLocationId) {
      const targetStock = Number(body.inventory_quantity)
      try {
        const firstVariant = product.variants[0] as any
        const invItems = firstVariant.inventory_items || []
        const primaryItem = invItems[0]

        if (primaryItem && primaryItem.inventory && primaryItem.inventory.id) {
          const invItemId = primaryItem.inventory.id
          const levels = primaryItem.inventory.location_levels || []
          const existingLevel = levels.find((l: any) => l.location_id === context.stockLocationId)

          if (existingLevel) {
            await updateInventoryLevelsWorkflow(req.scope).run({
              input: {
                updates: [
                  {
                    id: existingLevel.id,
                    inventory_item_id: invItemId,
                    location_id: context.stockLocationId,
                    stocked_quantity: targetStock,
                  },
                ],
              },
            })
          } else {
            await createInventoryLevelsWorkflow(req.scope).run({
              input: {
                inventory_levels: [
                  {
                    inventory_item_id: invItemId,
                    location_id: context.stockLocationId,
                    stocked_quantity: targetStock,
                  },
                ],
              },
            })
          }
        } else {
          // If no inventory item exists yet for this variant, create one and link it
          const { result: createdItems } = await createInventoryItemsWorkflow(req.scope).run({
            input: {
              items: [
                {
                  title: `${product.title || 'Product'} - Variant`,
                  location_levels: [
                    {
                      location_id: context.stockLocationId,
                      stocked_quantity: targetStock,
                    },
                  ],
                },
              ],
            },
          })

          if (createdItems?.length) {
            const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
            await link.create({
              [Modules.PRODUCT]: {
                variant_id: variantId,
              },
              [Modules.INVENTORY]: {
                inventory_item_id: createdItems[0].id,
              },
            })
          }
        }
      } catch (stockErr) {
        console.warn("Failed to update inventory level:", stockErr)
      }
    }
  }

  res.json({ product: result[0] })
}

export const PATCH = POST

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.params.id

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "sales_channels.id"],
    filters: { id: productId },
  })

  const product = products?.[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  if (context.salesChannelId) {
    const belongsToChannel = product.sales_channels?.some(
      (sc: any) => sc.id === context.salesChannelId
    )
    if (!belongsToChannel && !context.isSuperAdmin) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "You do not have permission to delete this product"
      )
    }
  }

  await deleteProductsWorkflow(req.scope).run({
    input: {
      ids: [productId],
    },
  })

  res.json({
    id: productId,
    object: "product",
    deleted: true,
  })
}
