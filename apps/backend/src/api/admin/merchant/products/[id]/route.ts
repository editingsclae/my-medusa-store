import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateProductsWorkflow, deleteProductsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import { parsePrice, parseStock, partialSaveMessage } from "../../product-inputs"
import { setVariantStock, updateVariantPrice } from "../../product-stock"
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
      "title",
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

  // Check the price and stock before anything is saved, so a bad value cannot
  // leave the product half updated
  let newPrice: number | null = null
  if (body.price !== undefined) {
    const parsed = parsePrice(body.price)
    if (!parsed.ok) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.message)
    }
    newPrice = parsed.value
  }
  let newStock: number | null = null
  if (body.inventory_quantity !== undefined) {
    const parsed = parseStock(body.inventory_quantity)
    if (!parsed.ok) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.message)
    }
    newStock = parsed.value
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

  // Update variant price and ensure manage_inventory: true. A failure here is
  // reported to the merchant: the product details above are already saved.
  if (product.variants?.length) {
    const firstVariant = product.variants[0] as any
    const currency = (body.currency_code || context.currencyCode || "usd").toLowerCase()

    try {
      await updateVariantPrice(
        req.scope,
        firstVariant.id,
        newPrice === null ? null : { amount: newPrice, currencyCode: currency }
      )
    } catch (variantErr) {
      console.error("Failed to update variant:", variantErr)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        partialSaveMessage(newPrice === null ? "stock tracking" : "price", variantErr)
      )
    }

    if (newStock !== null && context.stockLocationId) {
      try {
        await setVariantStock(req.scope, {
          variantId: firstVariant.id,
          productTitle: product.title as string | undefined,
          inventoryItems: firstVariant.inventory_items,
          locationId: context.stockLocationId,
          quantity: newStock,
        })
      } catch (stockErr) {
        console.error("Failed to update inventory level:", stockErr)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          partialSaveMessage("stock", stockErr)
        )
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
