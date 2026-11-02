// Checks and decisions for the price and stock of a product that a merchant
// saves. No framework imports, so they can be unit tested on their own.

import { errorText } from "../../error-text"

export { errorText }

export type Parsed =
  | { ok: true; value: number }
  | { ok: false; message: string }

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value)
  }
  return null
}

// A price is a number that is zero or more. Empty values are refused: they would
// otherwise turn into a price of 0.
export function parsePrice(value: unknown): Parsed {
  const amount = toNumber(value)
  if (amount === null || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: "price must be a number that is zero or more" }
  }
  return { ok: true, value: amount }
}

// A stock quantity is a whole number that is zero or more.
export function parseStock(value: unknown): Parsed {
  const quantity = toNumber(value)
  if (quantity === null || !Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, message: "inventory_quantity must be a whole number that is zero or more" }
  }
  return { ok: true, value: quantity }
}

type InventoryItemRef = {
  inventory?: {
    id?: string
    location_levels?: Array<{ id: string; location_id: string }>
  } | null
} | null

export type StockPlan =
  // the variant has an inventory item with a level at this location
  | { kind: "update-level"; inventoryItemId: string; levelId: string }
  // the variant has an inventory item but no level at this location yet
  | { kind: "create-level"; inventoryItemId: string }
  // the variant has no inventory item at all
  | { kind: "create-item" }

// What has to be done to set the stock of a variant at one location.
export function planStockUpdate(
  inventoryItems: InventoryItemRef[] | undefined,
  locationId: string
): StockPlan {
  const primary = (inventoryItems || [])[0]
  const inventoryItemId = primary?.inventory?.id
  if (!inventoryItemId) {
    return { kind: "create-item" }
  }
  const level = (primary?.inventory?.location_levels || []).find(
    (l) => l.location_id === locationId
  )
  if (level) {
    return { kind: "update-level", inventoryItemId, levelId: level.id }
  }
  return { kind: "create-level", inventoryItemId }
}


// The message a merchant sees when the product itself was saved but a part of
// it was not. It says what was saved, so they know a second save is safe.
export function partialSaveMessage(part: string, err: unknown): string {
  return `The product details were saved, but the ${part} could not be updated: ${errorText(err)}. Please save again.`
}
