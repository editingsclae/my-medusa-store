// Rules for the options and variants of a product that a merchant saves: what is
// allowed, and what has to change to go from the variants a product has now to
// the ones the merchant wants. No framework imports, so they can be unit tested
// on their own.
//
// A product has options (for example Size: S, M, L and Color: Black, White) and
// one variant for each combination that is sold (S / Black, S / White...). Each
// variant has its own price and stock.

import { parsePrice, parseStock } from "./product-inputs"

export const MAX_OPTIONS = 3
export const MAX_VALUES_PER_OPTION = 20
export const MAX_VARIANTS = 100
export const MAX_NAME_LENGTH = 40

// The option Medusa gives a product that has no options of its own ("Default Option",
// with the value "Default"). A product that gets real options keeps it, hidden:
// its variants cannot be moved off it while orders are reserved against them.
export const DEFAULT_OPTION_TITLE = "Default Option"

export type OptionInput = { title: string; values: string[] }

export type VariantInput = {
  // Set when the variant exists already
  id?: string
  // The value chosen for every option, by option title
  options: Record<string, string>
  price: number
  inventory_quantity: number
}

export type VariantsDraft = { options: OptionInput[]; variants: VariantInput[] }

export type ParsedDraft =
  | { ok: true; value: VariantsDraft }
  | { ok: false; message: string }

const fail = (message: string): ParsedDraft => ({ ok: false, message })

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// True when the request describes options or variants, as opposed to the plain
// price and stock of a product that has a single variant.
export function hasVariantsDraft(body: { options?: unknown; variants?: unknown } | null | undefined): boolean {
  return (
    (Array.isArray(body?.options) && body!.options.length > 0) ||
    (Array.isArray(body?.variants) && body!.variants.length > 0)
  )
}

// The name of a variant: its values in the order of the options ("S / Black").
export function variantTitle(optionTitles: string[], options: Record<string, string>): string {
  return optionTitles.map((title) => options[title]).join(" / ")
}

// Identifies a combination of values, whatever the spelling of the capitals.
// The values cannot collide because they are joined with a character that
// the rules below keep out of values.
export function comboKey(optionTitles: string[], options: Record<string, string>): string {
  return optionTitles.map((title) => (options[title] ?? "").toLowerCase()).join("\u0000")
}

export function parseVariantsDraft(input: { options?: unknown; variants?: unknown }): ParsedDraft {
  const rawOptions = input.options
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    return fail("Add at least one option, for example Size or Color.")
  }
  if (rawOptions.length > MAX_OPTIONS) {
    return fail(`A product can have at most ${MAX_OPTIONS} options.`)
  }

  const options: OptionInput[] = []
  for (const raw of rawOptions) {
    const title = typeof raw?.title === "string" ? raw.title.trim() : ""
    if (!title) {
      return fail("Every option needs a name, for example Size.")
    }
    if (title.length > MAX_NAME_LENGTH) {
      return fail(`The option name "${title}" is too long (at most ${MAX_NAME_LENGTH} characters).`)
    }
    if (options.some((o) => same(o.title, title))) {
      return fail(`The option "${title}" is listed twice.`)
    }
    if (!Array.isArray(raw.values) || raw.values.length === 0) {
      return fail(`The option "${title}" needs at least one value.`)
    }
    if (raw.values.length > MAX_VALUES_PER_OPTION) {
      return fail(`The option "${title}" can have at most ${MAX_VALUES_PER_OPTION} values.`)
    }
    const values: string[] = []
    for (const rawValue of raw.values) {
      const value = typeof rawValue === "string" ? rawValue.trim() : ""
      if (!value) {
        return fail(`A value of the option "${title}" is empty.`)
      }
      if (value.length > MAX_NAME_LENGTH) {
        return fail(`The value "${value}" of "${title}" is too long (at most ${MAX_NAME_LENGTH} characters).`)
      }
      if (value.includes("\u0000")) {
        return fail(`The value "${value}" of "${title}" has a character that is not allowed.`)
      }
      if (values.some((v) => same(v, value))) {
        return fail(`The value "${value}" is listed twice in "${title}".`)
      }
      values.push(value)
    }
    options.push({ title, values })
  }

  const rawVariants = input.variants
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return fail("Keep at least one combination to sell.")
  }
  if (rawVariants.length > MAX_VARIANTS) {
    return fail(`A product can have at most ${MAX_VARIANTS} variants.`)
  }

  const titles = options.map((o) => o.title)
  const variants: VariantInput[] = []
  const seen = new Set<string>()
  const seenIds = new Set<string>()

  for (const raw of rawVariants) {
    const given = raw?.options
    if (!given || typeof given !== "object" || Array.isArray(given)) {
      return fail("Every variant needs a value for each option.")
    }

    // Each variant picks exactly one value of every option, spelled as the option lists it
    const chosen: Record<string, string> = {}
    const givenTitles = Object.keys(given)
    for (const key of givenTitles) {
      if (!titles.some((t) => same(t, key))) {
        return fail(`A variant uses the option "${key}", which the product does not have.`)
      }
    }
    for (const option of options) {
      const key = givenTitles.find((k) => same(k, option.title))
      const given_value = key === undefined ? undefined : (given as Record<string, unknown>)[key]
      const value = typeof given_value === "string" ? given_value.trim() : ""
      if (!value) {
        return fail(`A variant has no value for "${option.title}".`)
      }
      const match = option.values.find((v) => same(v, value))
      if (!match) {
        return fail(`A variant uses "${value}" for "${option.title}", but that value is not in the list.`)
      }
      chosen[option.title] = match
    }

    const name = variantTitle(titles, chosen)

    const key = comboKey(titles, chosen)
    if (seen.has(key)) {
      return fail(`The combination ${name} is listed twice.`)
    }
    seen.add(key)

    const price = parsePrice(raw.price)
    if (!price.ok) {
      return fail(`${name}: ${price.message}.`)
    }
    const stock = parseStock(raw.inventory_quantity)
    if (!stock.ok) {
      return fail(`${name}: ${stock.message}.`)
    }

    let id: string | undefined
    if (raw.id !== undefined && raw.id !== null && raw.id !== "") {
      if (typeof raw.id !== "string") {
        return fail(`${name}: the variant id is not valid.`)
      }
      if (seenIds.has(raw.id)) {
        return fail(`The same variant is listed twice (${name}).`)
      }
      seenIds.add(raw.id)
      id = raw.id
    }

    variants.push({ ...(id ? { id } : {}), options: chosen, price: price.value, inventory_quantity: stock.value })
  }

  return { ok: true, value: { options, variants } }
}

// ---------------------------------------------------------------------------
// What the product has now

export type CurrentOption = { id: string; title: string; values: Array<{ id: string; value: string }> }

export type CurrentVariant = {
  id: string
  // The value of every option, by option title
  options: Record<string, string>
}

export type VariantPlan = {
  // The option titles in the draft's order, spelled as the product spells them
  optionTitles: string[]
  // Variants that go away: removed by the merchant, or no longer fit the options
  deleteVariantIds: string[]
  // Options that go away (a variant must have a value for every option, so all
  // variants are rebuilt whenever the list of options changes)
  removeOptionIds: string[]
  addOptions: OptionInput[]
  // For options that stay: values that are new, and ids of values that go away
  updateOptionValues: Array<{ optionId: string; title: string; addValues: string[]; removeValueIds: string[] }>
  // Variants that stay: their price and stock are set
  updateVariants: Array<{ id: string; price: number; stock: number }>
  // Variants that stay but become another combination (an option was added, for
  // example S becomes S / Black). They are kept, not deleted and created again,
  // because a variant with orders reserved against it cannot be deleted.
  reuseVariants: Array<{ id: string; title: string; options: Record<string, string>; price: number; stock: number }>
  // New combinations. `options` uses the titles and values as the product spells them.
  createVariants: Array<{ title: string; options: Record<string, string>; price: number; stock: number }>
}

// What has to change to turn the product the way it is into the draft. It is
// computed from the product as it stands now each time, so if a save stopped
// half way, saving again finishes the job.
export function planVariantSync(
  currentOptions: CurrentOption[],
  currentVariants: CurrentVariant[],
  draft: VariantsDraft
): VariantPlan {
  // Options that stay keep the spelling the product has, and so do their values
  const keptByTitle = new Map<string, CurrentOption>()
  const addOptions: OptionInput[] = []
  const canonicalOptions: OptionInput[] = []
  for (const option of draft.options) {
    const current = currentOptions.find((c) => same(c.title, option.title))
    if (current) {
      keptByTitle.set(option.title, current)
      canonicalOptions.push({
        title: current.title,
        values: option.values.map((value) => current.values.find((v) => same(v.value, value))?.value ?? value),
      })
    } else {
      addOptions.push(option)
      canonicalOptions.push(option)
    }
  }
  // The placeholder option stays when the draft does not mention it: every variant
  // keeps its value, and the merchant never sees it
  const hiddenDefault = draft.options.some((o) => same(o.title, DEFAULT_OPTION_TITLE))
    ? undefined
    : currentOptions.find((c) => c.title === DEFAULT_OPTION_TITLE)
  const hidden = hiddenDefault
    ? { title: hiddenDefault.title, value: hiddenDefault.values[0]?.value ?? "Default" }
    : undefined

  const removeOptionIds = currentOptions
    .filter((c) => c !== hiddenDefault && !draft.options.some((o) => same(o.title, c.title)))
    .map((c) => c.id)

  const visibleTitles = canonicalOptions.map((o) => o.title)
  const titles = hidden ? [...visibleTitles, hidden.title] : visibleTitles
  const structureChanged = removeOptionIds.length > 0 || addOptions.length > 0

  // The draft's variants, in the product's spelling
  const wanted = draft.variants.map((variant) => {
    const options: Record<string, string> = {}
    draft.options.forEach((option, index) => {
      const key = Object.keys(variant.options).find((k) => same(k, option.title)) as string
      const raw = variant.options[key]
      const match = canonicalOptions[index].values.find((v) => same(v, raw)) ?? raw
      options[canonicalOptions[index].title] = match
    })
    if (hidden) options[hidden.title] = hidden.value
    return { ...variant, options }
  })

  const keptIds = new Set<string>()
  const updateVariants: VariantPlan["updateVariants"] = []
  const matched = new Set<number>()

  if (!structureChanged) {
    for (const current of currentVariants) {
      const index = wanted.findIndex((w) => w.id === current.id)
      if (index < 0) continue
      // Same variant only if it still stands for the same combination
      if (comboKey(titles, wanted[index].options) !== comboKey(titles, current.options)) continue
      keptIds.add(current.id)
      matched.add(index)
      updateVariants.push({
        id: current.id,
        price: wanted[index].price,
        stock: wanted[index].inventory_quantity,
      })
    }
  }

  // A variant that is not kept as it is can become one of the combinations that are
  // still missing, if its own values agree with it. That is possible as long as no
  // option goes away: a variant must have a value for every option the product has.
  const reuseVariants: VariantPlan["reuseVariants"] = []
  if (removeOptionIds.length === 0) {
    for (const current of currentVariants) {
      if (keptIds.has(current.id)) continue
      const index = wanted.findIndex(
        (w, i) =>
          !matched.has(i) &&
          Object.entries(current.options).every(
            ([title, value]) => w.options[title] === undefined || same(w.options[title], value)
          )
      )
      if (index < 0) continue
      matched.add(index)
      keptIds.add(current.id)
      reuseVariants.push({
        id: current.id,
        title: variantTitle(visibleTitles, wanted[index].options),
        options: wanted[index].options,
        price: wanted[index].price,
        stock: wanted[index].inventory_quantity,
      })
    }
  }

  const deleteVariantIds = currentVariants.filter((v) => !keptIds.has(v.id)).map((v) => v.id)

  const createVariants = wanted
    .map((variant, index) => ({ variant, index }))
    .filter(({ index }) => !matched.has(index))
    .map(({ variant }) => ({
      title: variantTitle(visibleTitles, variant.options),
      options: variant.options,
      price: variant.price,
      stock: variant.inventory_quantity,
    }))

  const updateOptionValues: VariantPlan["updateOptionValues"] = []
  for (const option of draft.options) {
    const current = keptByTitle.get(option.title)
    if (!current) continue
    const addValues = option.values.filter((value) => !current.values.some((v) => same(v.value, value)))
    const removeValueIds = current.values
      .filter((v) => !option.values.some((value) => same(value, v.value)))
      .map((v) => v.id)
    if (addValues.length || removeValueIds.length) {
      updateOptionValues.push({ optionId: current.id, title: current.title, addValues, removeValueIds })
    }
  }

  return {
    optionTitles: titles,
    deleteVariantIds,
    removeOptionIds,
    addOptions,
    updateOptionValues,
    updateVariants,
    reuseVariants,
    createVariants,
  }
}

// The option titles of the current product, with each variant's values by title,
// from what the query returns.
export function currentVariantsFrom(
  variants: Array<{ id: string; options?: Array<{ value?: string; option?: { title?: string } | null }> | null }>
): CurrentVariant[] {
  return variants.map((variant) => {
    const options: Record<string, string> = {}
    for (const entry of variant.options || []) {
      const title = entry?.option?.title
      if (typeof title === "string" && typeof entry.value === "string") {
        options[title] = entry.value
      }
    }
    return { id: variant.id, options }
  })
}
