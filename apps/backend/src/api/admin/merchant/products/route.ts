import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createProductsWorkflow, deleteProductsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"
import { errorText, parseStock } from "../product-inputs"
import { setInitialStock } from "../product-stock"
import { setInitialVariantStock } from "../product-variants"
import { hasVariantsDraft, parseVariantsDraft, variantTitle, type VariantsDraft } from "../variant-rules"
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
      "options.values.*",
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

  // Options and variants (Size, Color...) with a price and stock for each one.
  // They are checked here, before anything is created.
  let draft: VariantsDraft | null = null
  if (hasVariantsDraft(body)) {
    const parsed = parseVariantsDraft(body)
    if (!parsed.ok) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.message)
    }
    draft = parsed.value
  }

  // New products start with 10 in stock unless the merchant says otherwise
  const stockInput = parseStock(body.inventory_quantity !== undefined ? body.inventory_quantity : 10)
  if (!stockInput.ok && !draft) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, stockInput.message)
  }
  const initialStock = stockInput.ok ? stockInput.value : 10

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
    options: draft
      ? draft.options.map((o) => ({ title: o.title, values: o.values }))
      : [{ title: "Default Option", values: ["Default"] }],
  }

  // Handle variants and pricing
  if (draft) {
    const titles = draft.options.map((o) => o.title)
    productInput.variants = draft.variants.map((v) => ({
      title: variantTitle(titles, v.options),
      manage_inventory: true,
      prices: [{ currency_code: (body.currency_code || context.currencyCode).toLowerCase(), amount: v.price }],
      options: v.options,
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

  // Create the first stock levels. If that fails the product is deleted again,
  // so the merchant is never left with a product that cannot be sold.
  if (context.stockLocationId && createdProduct?.id) {
    try {
      if (draft) {
        await setInitialVariantStock(req.scope, {
          productId: createdProduct.id,
          productTitle: body.title,
          locationId: context.stockLocationId,
          draft,
        })
      } else {
        await setInitialStock(req.scope, createdProduct.id, context.stockLocationId, initialStock)
      }
    } catch (invErr) {
      console.error("Failed to set initial inventory levels:", invErr)
      try {
        await deleteProductsWorkflow(req.scope).run({ input: { ids: [createdProduct.id] } })
      } catch (cleanupErr) {
        console.error(`Product ${createdProduct.id} could not be removed after the stock failed:`, cleanupErr)
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `The product could not be created because its stock could not be set: ${errorText(invErr)}. Please try again.`
      )
    }
  }

  res.status(201).json({
    product: createdProduct,
  })
}
