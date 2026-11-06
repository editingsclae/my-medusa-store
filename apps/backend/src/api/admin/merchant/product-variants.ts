// Applies the options and variants a merchant wants to a product. Failures are
// thrown, not hidden: the caller turns them into an answer the merchant sees.

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
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

// Medusa does not delete a variant while an order that is not delivered yet has stock
// reserved for it. Checked before anything is changed, so a refusal leaves the product as it was.
async function assertNoReservations(scope: MedusaContainer, variantIds: string[]): Promise<void> {
  if (variantIds.length === 0) return
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variants",
    fields: ["id", "title", "inventory_items.inventory_item_id"],
    filters: { id: variantIds },
  })
  const itemToVariant = new Map<string, string>()
  for (const variant of (data as any[]) || []) {
    for (const link of variant.inventory_items || []) {
      if (link?.inventory_item_id) itemToVariant.set(link.inventory_item_id, variant.title || variant.id)
    }
  }
  if (itemToVariant.size === 0) return

  const inventory = scope.resolve(Modules.INVENTORY) as any
  const reservations = await inventory.listReservationItems({ inventory_item_id: [...itemToVariant.keys()] })
  const reserved = new Set<string>()
  for (const reservation of reservations || []) {
    const name = itemToVariant.get(reservation.inventory_item_id)
    if (name) reserved.add(name)
  }
  if (reserved.size > 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `These variants have orders that are not delivered yet, so they cannot be removed: ${[...reserved].join(", ")}. ` +
        `Keep them on sale (set their stock to 0 if you stop selling them), or remove them after those orders are delivered.`
    )
  }
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

  await assertNoReservations(scope, plan.deleteVariantIds)
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
  // New values first: variants that are re-optioned or created below use them
  const valuesToAdd = plan.updateOptionValues.filter((u) => u.addValues.length)
  if (valuesToAdd.length) {
    await createAndLinkProductOptionsToProductWorkflow(scope).run({
      input: {
        product_id: productId,
        update: valuesToAdd.map((u) => ({
          product_option_id: u.optionId,
          add: u.addValues.map((value) => ({ value })),
        })),
      },
    })
  }

  // Variants that become another combination, so they can leave the values below
  if (plan.reuseVariants.length) {
    await updateProductVariantsWorkflow(scope).run({
      input: {
        product_variants: plan.reuseVariants.map((v) => ({
          id: v.id,
          title: v.title,
          options: v.options,
          manage_inventory: true,
          prices: [{ amount: v.price, currency_code: currencyCode }],
        })),
      },
    })
  }

  // Values go away only once no variant uses them
  const valuesToRemove = plan.updateOptionValues.filter((u) => u.removeValueIds.length)
  if (valuesToRemove.length) {
    await createAndLinkProductOptionsToProductWorkflow(scope).run({
      input: {
        product_id: productId,
        update: valuesToRemove.map((u) => ({ product_option_id: u.optionId, remove: u.removeValueIds })),
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
      stockById: new Map([...plan.updateVariants, ...plan.reuseVariants].map((v) => [v.id, v.stock])),
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
