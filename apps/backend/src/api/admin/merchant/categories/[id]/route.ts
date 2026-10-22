import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  deleteProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import { getOwnedCategory, requireSalesChannelId } from "../../category-access"
import {
  slugifyHandle,
  toPublicCategoryHandle,
  toStoredCategoryHandle,
} from "../../ownership"

const MAX_NAME_LENGTH = 100

function present(salesChannelId: string, category: Record<string, any>) {
  return {
    id: category.id,
    name: category.name,
    handle: toPublicCategoryHandle(salesChannelId, category.handle),
    description: category.description,
    is_active: category.is_active,
    rank: category.rank,
    created_at: category.created_at,
    updated_at: category.updated_at,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const category = await getOwnedCategory(req.scope, salesChannelId, req.params.id)

  res.json({ category: present(salesChannelId, category) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const body = (req.body || {}) as any

  const category = await getOwnedCategory(req.scope, salesChannelId, req.params.id)

  // Only these fields can change. parent_category_id, is_internal, metadata and
  // the sales channel are never taken from the request, so categories stay flat
  // and tied to their merchant.
  const update: Record<string, any> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name || name.length > MAX_NAME_LENGTH) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Category name must be 1 to ${MAX_NAME_LENGTH} characters`
      )
    }
    update.name = name
  }

  if (body.description !== undefined) {
    update.description =
      typeof body.description === "string" ? body.description : ""
  }

  if (body.is_active !== undefined) {
    update.is_active = Boolean(body.is_active)
  }

  if (body.rank !== undefined) {
    const rank = Number(body.rank)
    if (!Number.isInteger(rank) || rank < 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "rank must be a whole number, 0 or more"
      )
    }
    update.rank = rank
  }

  if (body.handle !== undefined) {
    const slug = slugifyHandle(body.handle)
    if (!slug) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Handle must contain letters or numbers"
      )
    }

    const storedHandle = toStoredCategoryHandle(salesChannelId, slug)
    if (storedHandle !== category.handle) {
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
      update.handle = storedHandle
    }
  }

  if (Object.keys(update).length === 0) {
    return res.json({ category: present(salesChannelId, category) })
  }

  const { result } = await updateProductCategoriesWorkflow(req.scope).run({
    input: {
      selector: { id: category.id },
      update,
    },
  })

  res.json({ category: present(salesChannelId, { ...category, ...result[0] }) })
}

export const PATCH = POST

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const salesChannelId = requireSalesChannelId(context)

  const category = await getOwnedCategory(req.scope, salesChannelId, req.params.id)

  // Products that had this category simply lose it. The products stay.
  await deleteProductCategoriesWorkflow(req.scope).run({
    input: [category.id],
  })

  // Remove the ownership link as well. A stale link is harmless because every
  // lookup also checks that the category itself still exists, so this is best
  // effort.
  try {
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
    await link.dismiss({
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
      [Modules.PRODUCT]: { product_category_id: category.id },
    })
  } catch (err) {
    console.warn("Could not remove category link:", err)
  }

  res.json({
    id: category.id,
    object: "product_category",
    deleted: true,
  })
}
