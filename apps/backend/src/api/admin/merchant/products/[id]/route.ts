import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateProductsWorkflow, deleteProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"

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
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.*",
      "variants.options.*",
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

  res.json({ product })
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

  // Update variant price if provided
  if (body.price !== undefined && product.variants?.length) {
    try {
      const variantId = product.variants[0].id
      const currency = (body.currency_code || context.currencyCode || "usd").toLowerCase()
      await updateProductVariantsWorkflow(req.scope).run({
        input: {
          product_variants: [
            {
              id: variantId,
              prices: [
                {
                  amount: Number(body.price),
                  currency_code: currency,
                },
              ],
            },
          ],
        },
      })
    } catch (variantErr) {
      console.warn("Failed to update variant price:", variantErr)
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
