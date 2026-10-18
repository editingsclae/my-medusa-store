import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"

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
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.*",
      "variants.options.*",
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

  res.json({
    products,
    count: metadata?.count ?? products.length,
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
    sales_channels: [
      {
        id: context.salesChannelId,
      },
    ],
    options: body.options?.length
      ? body.options
      : [{ title: "Default Option", values: ["Default"] }],
  }

  // Handle variants and pricing
  if (body.variants?.length) {
    productInput.variants = body.variants.map((v: any) => ({
      title: v.title || "Default Variant",
      sku: v.sku,
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

  res.status(201).json({
    product: result[0],
  })
}
