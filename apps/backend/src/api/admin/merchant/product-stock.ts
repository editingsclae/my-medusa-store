// Sets the price and stock of a variant. Failures are thrown, not hidden: the
// caller turns them into an answer the merchant sees.

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateProductVariantsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  createInventoryItemsWorkflow,
} from "@medusajs/core-flows"
import { planStockUpdate } from "./product-inputs"

// Turns stock tracking on and, when a price is given, replaces it.
export async function updateVariantPrice(
  scope: MedusaContainer,
  variantId: string,
  price: { amount: number; currencyCode: string } | null
): Promise<void> {
  const variantUpdate: any = { id: variantId, manage_inventory: true }
  if (price) {
    variantUpdate.prices = [{ amount: price.amount, currency_code: price.currencyCode }]
  }
  await updateProductVariantsWorkflow(scope).run({
    input: { product_variants: [variantUpdate] },
  })
}

export async function setVariantStock(
  scope: MedusaContainer,
  options: {
    variantId: string
    productTitle?: string
    inventoryItems: any[] | undefined
    locationId: string
    quantity: number
  }
): Promise<void> {
  const { variantId, locationId, quantity } = options
  const plan = planStockUpdate(options.inventoryItems, locationId)

  if (plan.kind === "update-level") {
    await updateInventoryLevelsWorkflow(scope).run({
      input: {
        updates: [
          {
            id: plan.levelId,
            inventory_item_id: plan.inventoryItemId,
            location_id: locationId,
            stocked_quantity: quantity,
          },
        ],
      },
    })
    return
  }

  if (plan.kind === "create-level") {
    await createInventoryLevelsWorkflow(scope).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: plan.inventoryItemId,
            location_id: locationId,
            stocked_quantity: quantity,
          },
        ],
      },
    })
    return
  }

  // No inventory item yet for this variant: create one and link it
  const { result: createdItems } = await createInventoryItemsWorkflow(scope).run({
    input: {
      items: [
        {
          title: `${options.productTitle || "Product"} - Variant`,
          location_levels: [{ location_id: locationId, stocked_quantity: quantity }],
        },
      ],
    },
  })
  if (createdItems?.length) {
    const link = scope.resolve(ContainerRegistrationKeys.LINK)
    await link.create({
      [Modules.PRODUCT]: { variant_id: variantId },
      [Modules.INVENTORY]: { inventory_item_id: createdItems[0].id },
    })
  }
}

// Creates the first stock level of every inventory item of a new product.
export async function setInitialStock(
  scope: MedusaContainer,
  productId: string,
  locationId: string,
  quantity: number
): Promise<void> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: freshProducts } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.inventory_items.inventory.id"],
    filters: { id: productId },
  })

  const levels: { inventory_item_id: string; location_id: string; stocked_quantity: number }[] = []
  for (const variant of freshProducts?.[0]?.variants || []) {
    for (const item of (variant as any).inventory_items || []) {
      if (item?.inventory?.id) {
        levels.push({
          inventory_item_id: item.inventory.id,
          location_id: locationId,
          stocked_quantity: quantity,
        })
      }
    }
  }

  if (levels.length > 0) {
    await createInventoryLevelsWorkflow(scope).run({
      input: { inventory_levels: levels },
    })
  }
}
