// Applies the options and variants a merchant wants to a product. Failures are
// thrown, not hidden: the caller turns them into an answer the merchant sees.

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createAndLinkProductOptionsToProductWorkflow,
  createProductVariantsWorkflow,
  deleteProductVariantsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/core-flows"
import { setVariantStock } from "./product-stock"
import {
  comboKey,
  currentVariantsFrom,
  planVariantSync,
  type CurrentOption,
  type VariantPlan,
  type VariantsDraft,
} from "./variant-rules"

// The fields to read, next to the product's own, to compare it with a draft
export const VARIANT_FIELDS = [
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "variants.options.id",
  "variants.options.value",
  "variants.options.option.title",
]

export function currentOptionsFrom(product: any): CurrentOption[] {
  return (product?.options || []).map((option: any) => ({
    id: option.id,
    title: option.title,
    values: (option.values || []).map((v: any) => ({ id: v.id, value: v.value })),
  }))
}

// Builds the plan for a product that was read with VARIANT_FIELDS
export function planFor(product: any, draft: VariantsDraft): VariantPlan {
  return planVariantSync(currentOptionsFrom(product), currentVariantsFrom(product?.variants || []), draft)
}

// The variants a product has, with what is needed to set their stock
async function readVariants(scope: MedusaContainer, productId: string): Promise<any[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "variants.id",
      "variants.options.value",
      "variants.options.option.title",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.*",
    ],
    filters: { id: productId },
  })
  return ((data?.[0] as any)?.variants as any[]) || []
}

// Carries out a plan, step by step. The order matters: a variant has to be gone
// before an option or a value it uses can be removed, and the options have to be
// in place before the variants that use them are created.
export async function applyVariantPlan(
  scope: MedusaContainer,
  options: {
    productId: string
    productTitle?: string
    currencyCode: string
    locationId: string | null | undefined
    plan: VariantPlan
  }
): Promise<void> {
  const { productId, plan, currencyCode } = options

  if (plan.deleteVariantIds.length) {
    await deleteProductVariantsWorkflow(scope).run({ input: { ids: plan.deleteVariantIds } })
  }

  // Options that are new are added before the old ones go, so the product
  // never has no options at all
  if (plan.addOptions.length) {
    await createAndLinkProductOptionsToProductWorkflow(scope).run({
      input: {
        product_id: productId,
        // Exclusive: the option belongs to this product only, never shared with another merchant
        add: plan.addOptions.map((o) => ({ title: o.title, values: o.values, is_exclusive: true })),
      },
    })
  }
  if (plan.removeOptionIds.length) {
    await createAndLinkProductOptionsToProductWorkflow(scope).run({
      input: { product_id: productId, remove: plan.removeOptionIds },
    })
  }
  if (plan.updateOptionValues.length) {
    await createAndLinkProductOptionsToProductWorkflow(scope).run({
      input: {
        product_id: productId,
        update: plan.updateOptionValues.map((u) => ({
          product_option_id: u.optionId,
          add: u.addValues.map((value) => ({ value })),
          remove: u.removeValueIds,
        })),
      },
    })
  }

  if (plan.createVariants.length) {
    await createProductVariantsWorkflow(scope).run({
      input: {
        product_variants: plan.createVariants.map((v) => ({
          product_id: productId,
          title: v.title,
          options: v.options,
          manage_inventory: true,
          prices: [{ amount: v.price, currency_code: currencyCode }],
        })),
      },
    })
  }

  if (plan.updateVariants.length) {
    await updateProductVariantsWorkflow(scope).run({
      input: {
        product_variants: plan.updateVariants.map((v) => ({
          id: v.id,
          manage_inventory: true,
          prices: [{ amount: v.price, currency_code: currencyCode }],
        })),
      },
    })
  }

  // The stock of the variants that were created or kept
  if (options.locationId) {
    const stockByCombo = new Map(plan.createVariants.map((v) => [comboKey(plan.optionTitles, v.options), v.stock]))
    await applyStock(scope, {
      productId,
      productTitle: options.productTitle,
      locationId: options.locationId,
      titles: plan.optionTitles,
      stockByCombo,
      stockById: new Map(plan.updateVariants.map((v) => [v.id, v.stock])),
    })
  }
}

// Sets the stock of the variants of a product. A variant is found by its id, or
// by its combination of values when it was just created.
async function applyStock(
  scope: MedusaContainer,
  options: {
    productId: string
    productTitle?: string
    locationId: string
    titles: string[]
    stockByCombo: Map<string, number>
    stockById?: Map<string, number>
  }
): Promise<void> {
  for (const variant of await readVariants(scope, options.productId)) {
    const own: Record<string, string> = {}
    for (const entry of variant.options || []) {
      if (entry?.option?.title && typeof entry.value === "string") own[entry.option.title] = entry.value
    }
    const quantity = options.stockById?.get(variant.id) ?? options.stockByCombo.get(comboKey(options.titles, own))
    if (quantity === undefined) continue
    await setVariantStock(scope, {
      variantId: variant.id,
      productTitle: options.productTitle,
      inventoryItems: variant.inventory_items,
      locationId: options.locationId,
      quantity,
    })
  }
}

// The first stock of a product that was just created with several variants:
// each variant gets its own quantity, found by its combination of values.
export async function setInitialVariantStock(
  scope: MedusaContainer,
  options: {
    productId: string
    productTitle?: string
    locationId: string
    draft: VariantsDraft
  }
): Promise<void> {
  const titles = options.draft.options.map((o) => o.title)
  await applyStock(scope, {
    productId: options.productId,
    productTitle: options.productTitle,
    locationId: options.locationId,
    titles,
    stockByCombo: new Map(options.draft.variants.map((v) => [comboKey(titles, v.options), v.inventory_quantity])),
  })
}
