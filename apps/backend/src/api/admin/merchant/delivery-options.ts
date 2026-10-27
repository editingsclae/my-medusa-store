// Pure helpers for the merchant delivery settings. They have no framework
// imports so they can be unit tested on their own.
//
// A "delivery option" is a Medusa shipping option that sits in a service zone
// of the merchant's own stock location. Two facts about how Medusa lists
// options for a cart drive the code below:
//   - an option is offered to shoppers while its `enabled_in_store` rule is
//     "true", so switching an option off means changing that rule, not
//     deleting the option;
//   - an option's price is a set of price rows: one in the currency plus one
//     per region that uses it, and optionally rows that only apply above a cart
//     total (`item_total` rules).

export const MAX_NAME_LENGTH = 60
export const MAX_PRICE = 100000
export const MAX_OPTIONS_PER_MERCHANT = 10

export const ENABLED_RULE_ATTRIBUTE = "enabled_in_store"

type PriceRule = {
  attribute?: string | null
  operator?: string | null
  value?: string | number | null
}

export type RawPrice = {
  id: string
  amount: number | string
  currency_code?: string | null
  price_rules?: PriceRule[] | null
}

export type RawRule = {
  id: string
  attribute: string
  operator?: string | null
  values?: Array<{ value: string }> | null
  value?: string | string[] | null
}

export type RawOption = {
  id: string
  name: string
  price_type?: string | null
  provider_id?: string | null
  shipping_profile_id?: string | null
  service_zone_id?: string | null
  prices?: RawPrice[] | null
  rules?: RawRule[] | null
}

export type DeliveryOption = {
  id: string
  name: string
  price: number | null
  currency_code: string
  enabled: boolean
  is_flat: boolean
}

// A name shown to shoppers at checkout. Whitespace is collapsed. Returns null
// when it is empty or too long.
export function parseOptionName(input: unknown): string | null {
  if (typeof input !== "string") {
    return null
  }

  const name = input.replace(/\s+/g, " ").trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return null
  }
  return name
}

// A delivery price in the store currency. Zero is allowed (free delivery) but
// it must be given: a missing price is an error, not free delivery. A comma is
// accepted as the decimal mark. Tunisian dinars have three decimals.
export function parsePrice(input: unknown): number | null {
  if (typeof input === "number") {
    return normalizePrice(input)
  }
  if (typeof input !== "string" || input.trim() === "") {
    return null
  }
  return normalizePrice(Number(input.trim().replace(",", ".")))
}

function normalizePrice(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
    return null
  }
  return Math.round(value * 1000) / 1000
}

function ruleValues(rule: RawRule): string[] {
  if (Array.isArray(rule.values)) {
    return rule.values.map((v) => String(v.value))
  }
  if (Array.isArray(rule.value)) {
    return rule.value.map(String)
  }
  return rule.value === undefined || rule.value === null ? [] : [String(rule.value)]
}

// Prices that depend on the cart total (free delivery above an amount, for
// example) are kept as they are and never edited here.
function itemTotalRules(price: RawPrice): PriceRule[] {
  return (price.price_rules || []).filter((r) => r.attribute === "item_total")
}

function regionIdOf(price: RawPrice): string | null {
  const rule = (price.price_rules || []).find((r) => r.attribute === "region_id")
  return rule && rule.value ? String(rule.value) : null
}

// The price a shopper pays: the plain price row in the store currency, without
// a region or a cart total condition.
export function readOptionPrice(option: RawOption, currencyCode: string): number | null {
  const currency = currencyCode.toLowerCase()
  const plain = (option.prices || []).filter(
    (p) => !regionIdOf(p) && itemTotalRules(p).length === 0
  )
  const row =
    plain.find((p) => (p.currency_code || "").toLowerCase() === currency) || plain[0]

  if (!row) {
    return null
  }
  const amount = Number(row.amount)
  return Number.isFinite(amount) ? amount : null
}

// An option with no enabled_in_store rule is offered to everybody, so only an
// explicit "false" switches it off.
export function isOptionEnabled(option: RawOption): boolean {
  const rule = (option.rules || []).find((r) => r.attribute === ENABLED_RULE_ATTRIBUTE)
  if (!rule) {
    return true
  }
  const values = ruleValues(rule)
  return !(values.length === 1 && values[0] === "false")
}

export function serializeOption(option: RawOption, currencyCode: string): DeliveryOption {
  return {
    id: option.id,
    name: option.name,
    price: readOptionPrice(option, currencyCode),
    currency_code: currencyCode.toLowerCase(),
    enabled: isOptionEnabled(option),
    is_flat: (option.price_type || "flat") === "flat",
  }
}

// Medusa replaces an option's price rows with the list it is given: a row with
// an id is updated, a row without one is created, and a row that is missing is
// deleted. So every existing row goes back in. Plain and per-region rows get
// the new amount, rows tied to a cart total keep their own amount and rules.
export function buildPriceUpdate(
  existing: RawPrice[],
  amount: number,
  currencyCode: string
): Array<Record<string, unknown>> {
  const currency = currencyCode.toLowerCase()
  const rows: Array<Record<string, unknown>> = []
  let hasPlainRow = false

  for (const price of existing) {
    const regionId = regionIdOf(price)
    const base: Record<string, unknown> = regionId
      ? { id: price.id, region_id: regionId }
      : { id: price.id, currency_code: (price.currency_code || currency).toLowerCase() }
    const conditions = itemTotalRules(price)

    if (conditions.length > 0) {
      rows.push({
        ...base,
        amount: Number(price.amount),
        rules: conditions.map((r) => ({
          attribute: "item_total",
          operator: r.operator || "eq",
          value: Number(r.value),
        })),
      })
      continue
    }

    if (!regionId) {
      hasPlainRow = true
    }
    rows.push({ ...base, amount })
  }

  if (!hasPlainRow) {
    rows.push({ currency_code: currency, amount })
  }
  return rows
}

// Rules for switching an option on or off. Every existing rule goes back in,
// because a rule that is left out is removed. Only enabled_in_store changes.
export function buildRulesForEnabled(
  existing: RawRule[],
  enabled: boolean
): Array<Record<string, unknown>> {
  const value = enabled ? "true" : "false"
  const rules: Array<Record<string, unknown>> = []
  let found = false

  for (const rule of existing) {
    if (rule.attribute === ENABLED_RULE_ATTRIBUTE) {
      found = true
      rules.push({ id: rule.id, attribute: rule.attribute, operator: "eq", value })
      continue
    }
    const values = ruleValues(rule)
    rules.push({
      id: rule.id,
      attribute: rule.attribute,
      operator: rule.operator || "eq",
      value: values.length === 1 ? values[0] : values,
    })
  }

  if (!found) {
    rules.push({ attribute: ENABLED_RULE_ATTRIBUTE, operator: "eq", value })
  }
  return rules
}

export function findOwnedOption(options: RawOption[], id: unknown): RawOption | undefined {
  if (typeof id !== "string") {
    return undefined
  }
  return options.find((o) => o.id === id)
}

// Checkout needs at least one option shoppers can pick. Switching off or
// deleting the last enabled option would stop every order of the merchant.
export function leavesNoEnabledOption(
  options: RawOption[],
  targetId: string,
  targetStaysEnabled: boolean
): boolean {
  if (targetStaysEnabled) {
    return false
  }
  return !options.some((o) => o.id !== targetId && isOptionEnabled(o))
}
