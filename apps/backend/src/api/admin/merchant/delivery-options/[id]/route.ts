import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  deleteShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/core-flows"
import { getMerchantContext } from "../../utils"
import { loadMerchantDelivery } from "../../delivery-access"
import {
  MAX_NAME_LENGTH,
  buildPriceUpdate,
  buildRulesForEnabled,
  findOwnedOption,
  leavesNoEnabledOption,
  parseOptionName,
  parsePrice,
  serializeOption,
} from "../../delivery-options"

// The option has to be in the merchant's own delivery zones. Anything else,
// including an option of another merchant, is reported as not found.
async function loadOwnedOption(req: MedusaRequest) {
  const context = await getMerchantContext(req)
  const delivery = await loadMerchantDelivery(req.scope, context)
  const option = findOwnedOption(delivery.options, req.params.id)

  if (!option) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Delivery option ${req.params.id} was not found`
    )
  }
  return { context, delivery, option }
}

// POST /admin/merchant/delivery-options/:id  { name?, price?, enabled? }
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as any
  const { context, delivery, option } = await loadOwnedOption(req)

  const update: Record<string, unknown> = { id: option.id }
  let changed = false

  if (body.name !== undefined) {
    const name = parseOptionName(body.name)
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Name must be 1 to ${MAX_NAME_LENGTH} characters`
      )
    }
    update.name = name
    changed = true
  }

  if (body.price !== undefined) {
    const price = parsePrice(body.price)
    if (price === null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Price must be a number from 0 (free delivery) upwards"
      )
    }
    if ((option.price_type || "flat") !== "flat") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This option has a calculated price and cannot be edited here"
      )
    }
    update.price_type = "flat"
    update.prices = buildPriceUpdate(option.prices || [], price, delivery.currencyCode)
    changed = true
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "enabled must be true or false")
    }
    if (leavesNoEnabledOption(delivery.options, option.id, body.enabled)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Keep at least one delivery option switched on, otherwise shoppers cannot check out"
      )
    }
    update.rules = buildRulesForEnabled(option.rules || [], body.enabled)
    changed = true
  }

  if (!changed) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Send at least one of name, price or enabled"
    )
  }

  await updateShippingOptionsWorkflow(req.scope).run({ input: [update as any] })

  // Read it back so the answer shows what is really stored
  const refreshed = await loadMerchantDelivery(req.scope, context)
  const saved = findOwnedOption(refreshed.options, option.id)

  res.json({
    delivery_option: saved ? serializeOption(saved, refreshed.currencyCode) : null,
  })
}

// DELETE /admin/merchant/delivery-options/:id
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { delivery, option } = await loadOwnedOption(req)

  if (leavesNoEnabledOption(delivery.options, option.id, false)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Keep at least one delivery option, otherwise shoppers cannot check out"
    )
  }

  await deleteShippingOptionsWorkflow(req.scope).run({ input: { ids: [option.id] } })

  res.json({ id: option.id, object: "delivery_option", deleted: true })
}
