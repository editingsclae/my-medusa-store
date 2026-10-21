import { randomBytes } from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  deleteProductCategoriesWorkflow,
} from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"
import { listCategoryLinks, requireSalesChannelId } from "../category-access"
import {
  slugifyHandle,
  toPublicCategoryHandle,
  toStoredCategoryHandle,
} from "../ownership"

const MAX_NAME_LENGTH = 100

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const links = await listCategoryLinks(req.scope, [salesChannelId])
  const ids = links.map((link) => link.product_category_id)

  if (ids.length === 0) {
    return res.json({ categories: [], count: 0 })
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "is_active",
      "rank",
      "created_at",
      "updated_at",
    ],
    filters: { id: ids },
  })

  // Only this merchant's own products are counted
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "categories.id"],
    filters: { sales_channels: { id: salesChannelId } } as any,
    pagination: { take: 5000 },
  })

  const counts = new Map<string, number>()
  for (const product of products as any[]) {
    for (const category of product.categories || []) {
      counts.set(category.id, (counts.get(category.id) || 0) + 1)
    }
  }

  const result = (categories as any[])
    .map((category) => ({
      id: category.id,
      name: category.name,
      handle: toPublicCategoryHandle(salesChannelId, category.handle),
      description: category.description,
      is_active: category.is_active,
      rank: category.rank,
      product_count: counts.get(category.id) || 0,
      created_at: category.created_at,
      updated_at: category.updated_at,
    }))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name))

  res.json({ categories: result, count: result.length })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const body = (req.body || {}) as any

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Category name is required and must be at most ${MAX_NAME_LENGTH} characters`
    )
  }

  // The handle comes from the name unless the merchant sent one. Names without
  // Latin letters give an empty slug, so a short random one is used instead.
  const slug =
    slugifyHandle(body.handle ?? name) ||
    `category-${randomBytes(3).toString("hex")}`
  const storedHandle = toStoredCategoryHandle(salesChannelId, slug)

  // The stored handle starts with this merchant's channel id, so a match can
  // only be one of its own categories.
  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { handle: storedHandle },
  })
  if (existing?.length) {
    throw new MedusaError(
      MedusaError.Types.DUPLICATE_ERROR,
      "You already have a category with this handle"
    )
  }

  const { result } = await createProductCategoriesWorkflow(req.scope).run({
    input: {
      product_categories: [
        {
          name,
          handle: storedHandle,
          description:
            typeof body.description === "string" ? body.description : "",
          // Merchant categories are never internal and are visible by default
          is_active: body.is_active === undefined ? true : Boolean(body.is_active),
          is_internal: false,
        },
      ],
    },
  })

  const created = result[0]

  // Link the new category to this merchant. If that fails, remove the category
  // again, otherwise it would be an orphan that holds the handle.
  try {
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
    await link.create({
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
      [Modules.PRODUCT]: { product_category_id: created.id },
    })
  } catch (err) {
    await deleteProductCategoriesWorkflow(req.scope).run({
      input: [created.id],
    })
    throw err
  }

  res.status(201).json({
    category: {
      id: created.id,
      name: created.name,
      handle: slug,
      description: created.description,
      is_active: created.is_active,
      rank: created.rank,
      product_count: 0,
    },
  })
}
