import {
  comboKey,
  currentVariantsFrom,
  hasVariantsDraft,
  MAX_OPTIONS,
  MAX_VALUES_PER_OPTION,
  MAX_VARIANTS,
  parseVariantsDraft,
  planVariantSync,
  variantTitle,
  type CurrentOption,
  type CurrentVariant,
} from "../admin/merchant/variant-rules"

const draftBody = (over: any = {}) => ({
  options: [
    { title: "Size", values: ["S", "M"] },
    { title: "Color", values: ["Black", "White"] },
  ],
  variants: [
    { options: { Size: "S", Color: "Black" }, price: 50, inventory_quantity: 5 },
    { options: { Size: "S", Color: "White" }, price: 50, inventory_quantity: 4 },
    { options: { Size: "M", Color: "Black" }, price: 55, inventory_quantity: 3 },
  ],
  ...over,
})

const message = (r: any) => (r.ok ? "" : r.message)

describe("hasVariantsDraft", () => {
  it("is true when options or variants are given", () => {
    expect(hasVariantsDraft({ options: [{ title: "Size", values: ["S"] }] })).toBe(true)
    expect(hasVariantsDraft({ variants: [{}] })).toBe(true)
  })
  it("is false for a plain product", () => {
    expect(hasVariantsDraft({})).toBe(false)
    expect(hasVariantsDraft({ options: [], variants: [] })).toBe(false)
    expect(hasVariantsDraft(null)).toBe(false)
    expect(hasVariantsDraft({ options: "x" })).toBe(false)
  })
})

describe("variantTitle and comboKey", () => {
  it("joins the values in the order of the options", () => {
    expect(variantTitle(["Size", "Color"], { Color: "Black", Size: "S" })).toBe("S / Black")
  })
  it("ignores capitals and keeps different tuples apart", () => {
    const t = ["A", "B"]
    expect(comboKey(t, { A: "x", B: "Y" })).toBe(comboKey(t, { A: "X", B: "y" }))
    expect(comboKey(t, { A: "x y", B: "z" })).not.toBe(comboKey(t, { A: "x", B: "y z" }))
  })
})

describe("parseVariantsDraft", () => {
  it("accepts options with the combinations the merchant keeps", () => {
    const r = parseVariantsDraft(draftBody())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.options.length).toBe(2)
      expect(r.value.variants.length).toBe(3)
      expect(r.value.variants[2]).toEqual({ options: { Size: "M", Color: "Black" }, price: 55, inventory_quantity: 3 })
    }
  })

  it("trims names and values and takes the spelling of the option list", () => {
    const r = parseVariantsDraft({
      options: [{ title: " Size ", values: [" S ", "M"] }],
      variants: [{ options: { size: "s" }, price: "10", inventory_quantity: "2" }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.options[0]).toEqual({ title: "Size", values: ["S", "M"] })
      expect(r.value.variants[0]).toEqual({ options: { Size: "S" }, price: 10, inventory_quantity: 2 })
    }
  })

  it("keeps the id of an existing variant", () => {
    const r = parseVariantsDraft({
      options: [{ title: "Size", values: ["S"] }],
      variants: [{ id: "variant_1", options: { Size: "S" }, price: 1, inventory_quantity: 1 }],
    })
    expect(r.ok && r.value.variants[0].id).toBe("variant_1")
  })

  it("needs options and at least one variant", () => {
    expect(message(parseVariantsDraft({ variants: draftBody().variants }))).toContain("at least one option")
    expect(message(parseVariantsDraft({ options: [], variants: [] }))).toContain("at least one option")
    expect(message(parseVariantsDraft(draftBody({ variants: [] })))).toContain("at least one combination")
    expect(message(parseVariantsDraft(draftBody({ variants: undefined })))).toContain("at least one combination")
  })

  it("limits the number of options, values and variants", () => {
    const many = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => ({ title: "O" + i, values: ["a"] }))
    expect(message(parseVariantsDraft({ options: many, variants: [] }))).toContain("at most " + MAX_OPTIONS + " options")

    const values = Array.from({ length: MAX_VALUES_PER_OPTION + 1 }, (_, i) => "v" + i)
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values }], variants: [] }))).toContain("at most " + MAX_VALUES_PER_OPTION + " values")

    // 101 combinations of two options: 11 x 10 = 110 values pairs
    const a = Array.from({ length: 11 }, (_, i) => "a" + i)
    const b = Array.from({ length: 10 }, (_, i) => "b" + i)
    const variants: any[] = []
    for (const x of a) for (const y of b) variants.push({ options: { A: x, B: y }, price: 1, inventory_quantity: 1 })
    const r = parseVariantsDraft({ options: [{ title: "A", values: a }, { title: "B", values: b }], variants })
    expect(variants.length > MAX_VARIANTS).toBe(true)
    expect(message(r)).toContain("at most " + MAX_VARIANTS + " variants")
    expect(parseVariantsDraft({ options: [{ title: "A", values: a }, { title: "B", values: b }], variants: variants.slice(0, MAX_VARIANTS) }).ok).toBe(true)
  })

  it("allows 3 options, 20 values and 100 variants, and no more", () => {
    const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ title: "O" + i, values: ["a"] }))
    expect(message(parseVariantsDraft({ options: opts(4), variants: [] }))).toContain("at most 3 options")
    const three = parseVariantsDraft({
      options: opts(3),
      variants: [{ options: { O0: "a", O1: "a", O2: "a" }, price: 1, inventory_quantity: 1 }],
    })
    expect(three.ok).toBe(true)
    const vals = (n: number) => Array.from({ length: n }, (_, i) => "v" + i)
    expect(message(parseVariantsDraft({ options: [{ title: "S", values: vals(21) }], variants: [] }))).toContain("at most 20 values")
    expect(parseVariantsDraft({
      options: [{ title: "S", values: vals(20) }],
      variants: [{ options: { S: "v19" }, price: 1, inventory_quantity: 1 }],
    }).ok).toBe(true)
  })

  it("refuses bad option names and values", () => {
    expect(message(parseVariantsDraft({ options: [{ title: "  ", values: ["a"] }], variants: [] }))).toContain("needs a name")
    expect(message(parseVariantsDraft({ options: [{ title: "x".repeat(41), values: ["a"] }], variants: [] }))).toContain("too long")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: ["a"] }, { title: "size", values: ["b"] }], variants: [] }))).toContain("listed twice")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: [] }], variants: [] }))).toContain("at least one value")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: ["S", " s "] }], variants: [] }))).toContain("listed twice")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: ["S", ""] }], variants: [] }))).toContain("empty")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: ["S", 5] }], variants: [] }))).toContain("empty")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: ["x".repeat(41)] }], variants: [] }))).toContain("too long")
    expect(message(parseVariantsDraft({ options: [{ title: "Size", values: ["a\u0000b"] }], variants: [] }))).toContain("not allowed")
    expect(message(parseVariantsDraft({ options: [null], variants: [] }))).toContain("needs a name")
  })

  it("refuses a variant that does not match the options", () => {
    const one = (v: any) => parseVariantsDraft(draftBody({ variants: [v] }))
    expect(message(one({ options: { Size: "S" }, price: 1, inventory_quantity: 1 }))).toContain('no value for "Color"')
    expect(message(one({ options: { Size: "XL", Color: "Black" }, price: 1, inventory_quantity: 1 }))).toContain("not in the list")
    expect(message(one({ options: { Size: "S", Color: "Black", Weight: "1" }, price: 1, inventory_quantity: 1 }))).toContain('"Weight"')
    expect(message(one({ price: 1, inventory_quantity: 1 }))).toContain("value for each option")
    expect(message(one({ options: ["S"], price: 1, inventory_quantity: 1 }))).toContain("value for each option")
    expect(message(one(null))).toContain("value for each option")
    expect(message(one({ options: { Size: 3, Color: "Black" }, price: 1, inventory_quantity: 1 }))).toContain('no value for "Size"')
  })

  it("refuses a combination listed twice, even with other capitals", () => {
    const v = (size: string) => ({ options: { Size: size, Color: "Black" }, price: 1, inventory_quantity: 1 })
    const r = parseVariantsDraft(draftBody({ variants: [v("S"), v("s")] }))
    expect(message(r)).toContain("S / Black is listed twice")
  })

  it("refuses a bad price or stock and says which variant", () => {
    const one = (price: any, stock: any) =>
      parseVariantsDraft(draftBody({ variants: [{ options: { Size: "M", Color: "White" }, price, inventory_quantity: stock }] }))
    expect(message(one(-1, 1))).toContain("M / White: price")
    expect(message(one("", 1))).toContain("M / White: price")
    expect(message(one(1, 1.5))).toContain("M / White: inventory_quantity")
    expect(message(one(1, -2))).toContain("M / White: inventory_quantity")
    expect(message(one(1, undefined))).toContain("inventory_quantity")
    expect(one(0, 0).ok).toBe(true)
  })

  it("refuses an id that is not text or is used twice", () => {
    const base = { options: { Size: "S", Color: "Black" }, price: 1, inventory_quantity: 1 }
    expect(message(parseVariantsDraft(draftBody({ variants: [{ ...base, id: 5 }] })))).toContain("not valid")
    const other = { options: { Size: "S", Color: "White" }, price: 1, inventory_quantity: 1 }
    expect(message(parseVariantsDraft(draftBody({ variants: [{ ...base, id: "v1" }, { ...other, id: "v1" }] })))).toContain("listed twice")
  })
})

// ---------------------------------------------------------------------------

const opt = (id: string, title: string, values: string[]): CurrentOption => ({
  id,
  title,
  values: values.map((v) => ({ id: `${id}_${v.toLowerCase()}`, value: v })),
})
const cv = (id: string, options: Record<string, string>): CurrentVariant => ({ id, options })

const currentOptions = [opt("o_size", "Size", ["S", "M"]), opt("o_color", "Color", ["Black", "White"])]
const currentVariants = [
  cv("v1", { Size: "S", Color: "Black" }),
  cv("v2", { Size: "S", Color: "White" }),
  cv("v3", { Size: "M", Color: "Black" }),
  cv("v4", { Size: "M", Color: "White" }),
]

const draftOf = (body: any) => {
  const r = parseVariantsDraft(body)
  if (!r.ok) throw new Error(r.message)
  return r.value
}
const full = (price = 10, stock = 1) => ({
  options: [
    { title: "Size", values: ["S", "M"] },
    { title: "Color", values: ["Black", "White"] },
  ],
  variants: [
    { id: "v1", options: { Size: "S", Color: "Black" }, price, inventory_quantity: stock },
    { id: "v2", options: { Size: "S", Color: "White" }, price, inventory_quantity: stock },
    { id: "v3", options: { Size: "M", Color: "Black" }, price, inventory_quantity: stock },
    { id: "v4", options: { Size: "M", Color: "White" }, price, inventory_quantity: stock },
  ],
})

describe("planVariantSync", () => {
  it("only sets price and stock when nothing else changed", () => {
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(full(99, 7)))
    expect(plan.deleteVariantIds).toEqual([])
    expect(plan.removeOptionIds).toEqual([])
    expect(plan.addOptions).toEqual([])
    expect(plan.updateOptionValues).toEqual([])
    expect(plan.createVariants).toEqual([])
    expect(plan.updateVariants.length).toBe(4)
    expect(plan.updateVariants[0]).toEqual({ id: "v1", price: 99, stock: 7 })
    expect(plan.optionTitles).toEqual(["Size", "Color"])
  })

  it("deletes the combinations the merchant removed and keeps the others", () => {
    const body = full()
    body.variants = body.variants.filter((v) => v.id !== "v2")
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.deleteVariantIds).toEqual(["v2"])
    expect(plan.updateVariants.map((v) => v.id)).toEqual(["v1", "v3", "v4"])
    expect(plan.createVariants).toEqual([])
  })

  it("adds a value to an option and creates the new combinations", () => {
    const body = full()
    body.options[0].values.push("L")
    body.variants.push(
      { id: undefined as any, options: { Size: "L", Color: "Black" }, price: 12, inventory_quantity: 6 },
      { id: undefined as any, options: { Size: "L", Color: "White" }, price: 12, inventory_quantity: 2 }
    )
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.updateOptionValues).toEqual([{ optionId: "o_size", title: "Size", addValues: ["L"], removeValueIds: [] }])
    expect(plan.createVariants).toEqual([
      { title: "L / Black", options: { Size: "L", Color: "Black" }, price: 12, stock: 6 },
      { title: "L / White", options: { Size: "L", Color: "White" }, price: 12, stock: 2 },
    ])
    expect(plan.deleteVariantIds).toEqual([])
    expect(plan.updateVariants.length).toBe(4)
  })

  it("removes a value together with the variants that use it", () => {
    const body = {
      options: [
        { title: "Size", values: ["S"] },
        { title: "Color", values: ["Black", "White"] },
      ],
      variants: [
        { id: "v1", options: { Size: "S", Color: "Black" }, price: 1, inventory_quantity: 1 },
        { id: "v2", options: { Size: "S", Color: "White" }, price: 1, inventory_quantity: 1 },
      ],
    }
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.deleteVariantIds).toEqual(["v3", "v4"])
    expect(plan.updateOptionValues).toEqual([{ optionId: "o_size", title: "Size", addValues: [], removeValueIds: ["o_size_m"] }])
    expect(plan.updateVariants.map((v) => v.id)).toEqual(["v1", "v2"])
  })

  it("rebuilds every variant when an option is added", () => {
    const body = {
      options: [...full().options, { title: "Material", values: ["Cotton"] }],
      variants: full().variants.map((v) => ({ options: { ...v.options, Material: "Cotton" }, price: 5, inventory_quantity: 2 })),
    }
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.addOptions).toEqual([{ title: "Material", values: ["Cotton"] }])
    expect(plan.removeOptionIds).toEqual([])
    expect(plan.deleteVariantIds).toEqual(["v1", "v2", "v3", "v4"])
    expect(plan.updateVariants).toEqual([])
    expect(plan.createVariants.length).toBe(4)
    expect(plan.createVariants[0].title).toBe("S / Black / Cotton")
  })

  it("rebuilds every variant when an option is removed", () => {
    const body = {
      options: [{ title: "Size", values: ["S", "M"] }],
      variants: [
        { options: { Size: "S" }, price: 1, inventory_quantity: 1 },
        { options: { Size: "M" }, price: 1, inventory_quantity: 1 },
      ],
    }
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.removeOptionIds).toEqual(["o_color"])
    expect(plan.deleteVariantIds.length).toBe(4)
    expect(plan.createVariants.map((v) => v.title)).toEqual(["S", "M"])
    expect(plan.updateOptionValues).toEqual([])
  })

  it("does not keep a variant by its id when an option was removed", () => {
    // same ids as before, but the product no longer has the Color option
    const body = {
      options: [{ title: "Size", values: ["S", "M"] }],
      variants: [
        { id: "v1", options: { Size: "S" }, price: 1, inventory_quantity: 1 },
        { id: "v3", options: { Size: "M" }, price: 1, inventory_quantity: 1 },
      ],
    }
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.deleteVariantIds).toEqual(["v1", "v2", "v3", "v4"])
    expect(plan.updateVariants).toEqual([])
    expect(plan.createVariants.map((v) => v.title)).toEqual(["S", "M"])
  })

  it("turns the single default variant of a product into real variants", () => {
    const options = [opt("o_def", "Default Option", ["Default"])]
    const variants = [cv("v0", { "Default Option": "Default" })]
    const body = {
      options: [{ title: "Size", values: ["S", "M"] }],
      variants: [
        { id: "v0", options: { Size: "S" }, price: 30, inventory_quantity: 4 },
        { options: { Size: "M" }, price: 30, inventory_quantity: 4 },
      ],
    }
    const plan = planVariantSync(options, variants, draftOf(body))
    expect(plan.deleteVariantIds).toEqual(["v0"])
    expect(plan.removeOptionIds).toEqual(["o_def"])
    expect(plan.addOptions).toEqual([{ title: "Size", values: ["S", "M"] }])
    expect(plan.updateVariants).toEqual([])
    expect(plan.createVariants.length).toBe(2)
  })

  it("does not keep a variant under an id that now stands for another combination", () => {
    const body = full()
    body.variants[0] = { id: "v1", options: { Size: "M", Color: "Black" }, price: 1, inventory_quantity: 1 }
    body.variants[2] = { id: "v3", options: { Size: "S", Color: "Black" }, price: 1, inventory_quantity: 1 }
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.deleteVariantIds.sort()).toEqual(["v1", "v3"])
    expect(plan.createVariants.length).toBe(2)
    expect(plan.updateVariants.map((v) => v.id)).toEqual(["v2", "v4"])
  })

  it("creates a variant whose id is not in the product any more", () => {
    const body = full()
    body.variants[0].id = "gone"
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.deleteVariantIds).toEqual(["v1"])
    expect(plan.createVariants.map((v) => v.title)).toEqual(["S / Black"])
  })

  it("finishes the job when an earlier save stopped half way", () => {
    // the variants were deleted and the option added, but nothing was created
    const options = [opt("o_def", "Default Option", ["Default"]), opt("o_size", "Size", ["S", "M"])]
    const body = {
      options: [{ title: "Size", values: ["S", "M"] }],
      variants: [
        { id: "v0", options: { Size: "S" }, price: 30, inventory_quantity: 4 },
        { options: { Size: "M" }, price: 30, inventory_quantity: 4 },
      ],
    }
    const plan = planVariantSync(options, [], draftOf(body))
    expect(plan.removeOptionIds).toEqual(["o_def"])
    expect(plan.addOptions).toEqual([])
    expect(plan.updateOptionValues).toEqual([])
    expect(plan.createVariants.length).toBe(2)
  })

  it("uses the spelling the product already has", () => {
    const body = {
      options: [
        { title: "size", values: ["s", "m", "XL"] },
        { title: "COLOR", values: ["black", "white"] },
      ],
      variants: [
        { id: "v1", options: { size: "S", COLOR: "BLACK" }, price: 1, inventory_quantity: 1 },
        { options: { size: "XL", COLOR: "white" }, price: 2, inventory_quantity: 2 },
      ],
    }
    const plan = planVariantSync(currentOptions, currentVariants, draftOf(body))
    expect(plan.optionTitles).toEqual(["Size", "Color"])
    expect(plan.addOptions).toEqual([])
    expect(plan.removeOptionIds).toEqual([])
    expect(plan.updateOptionValues).toEqual([
      { optionId: "o_size", title: "Size", addValues: ["XL"], removeValueIds: [] },
      { optionId: "o_color", title: "Color", addValues: [], removeValueIds: [] },
    ].filter((u) => u.addValues.length || u.removeValueIds.length))
    expect(plan.updateVariants).toEqual([{ id: "v1", price: 1, stock: 1 }])
    expect(plan.createVariants).toEqual([
      { title: "XL / White", options: { Size: "XL", Color: "White" }, price: 2, stock: 2 },
    ])
    expect(plan.deleteVariantIds.sort()).toEqual(["v2", "v3", "v4"])
  })

  it("plans nothing for a product with no variants and a draft that creates them", () => {
    const plan = planVariantSync([], [], draftOf(full()))
    expect(plan.deleteVariantIds).toEqual([])
    expect(plan.addOptions.length).toBe(2)
    expect(plan.createVariants.length).toBe(4)
  })
})

describe("currentVariantsFrom", () => {
  it("reads the value of each option by its title", () => {
    const result = currentVariantsFrom([
      { id: "v1", options: [{ value: "S", option: { title: "Size" } }, { value: "Black", option: { title: "Color" } }] },
      { id: "v2", options: null },
      { id: "v3", options: [{ value: "x", option: null }, { option: { title: "Size" } }] },
    ])
    expect(result).toEqual([
      { id: "v1", options: { Size: "S", Color: "Black" } },
      { id: "v2", options: {} },
      { id: "v3", options: {} },
    ])
  })
})
