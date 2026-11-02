import {
  errorText,
  parsePrice,
  parseStock,
  partialSaveMessage,
  planStockUpdate,
} from "../admin/merchant/product-inputs"

describe("parsePrice", () => {
  it("accepts numbers and numeric text, zero included", () => {
    expect(parsePrice(25)).toEqual({ ok: true, value: 25 })
    expect(parsePrice("19.9")).toEqual({ ok: true, value: 19.9 })
    expect(parsePrice(0)).toEqual({ ok: true, value: 0 })
  })

  it("refuses empty, negative and non numeric values", () => {
    for (const bad of ["", "  ", null, undefined, -1, "-3", "abc", NaN, Infinity, true, {}]) {
      expect(parsePrice(bad).ok).toBe(false)
    }
  })

  it("explains what is wrong", () => {
    const result = parsePrice("abc")
    expect(result.ok === false && result.message).toContain("price")
  })
})

describe("parseStock", () => {
  it("accepts whole numbers, zero included", () => {
    expect(parseStock(10)).toEqual({ ok: true, value: 10 })
    expect(parseStock("7")).toEqual({ ok: true, value: 7 })
    expect(parseStock(0)).toEqual({ ok: true, value: 0 })
  })

  it("refuses fractions, negatives, empty and non numeric values", () => {
    for (const bad of [1.5, "2.5", -1, "", null, undefined, "abc", NaN, false]) {
      expect(parseStock(bad).ok).toBe(false)
    }
  })
})

describe("planStockUpdate", () => {
  const item = (levels: Array<{ id: string; location_id: string }>) => ({
    inventory: { id: "iitem_1", location_levels: levels },
  })

  it("updates the level at the merchant location", () => {
    const plan = planStockUpdate(
      [item([{ id: "level_other", location_id: "sloc_2" }, { id: "level_1", location_id: "sloc_1" }])],
      "sloc_1"
    )
    expect(plan).toEqual({ kind: "update-level", inventoryItemId: "iitem_1", levelId: "level_1" })
  })

  it("creates a level when the item has none at this location", () => {
    const plan = planStockUpdate([item([{ id: "level_other", location_id: "sloc_2" }])], "sloc_1")
    expect(plan).toEqual({ kind: "create-level", inventoryItemId: "iitem_1" })
  })

  it("creates an item when the variant has none", () => {
    expect(planStockUpdate(undefined, "sloc_1")).toEqual({ kind: "create-item" })
    expect(planStockUpdate([], "sloc_1")).toEqual({ kind: "create-item" })
    expect(planStockUpdate([null], "sloc_1")).toEqual({ kind: "create-item" })
    expect(planStockUpdate([{ inventory: null }], "sloc_1")).toEqual({ kind: "create-item" })
  })

  it("uses the first inventory item", () => {
    const plan = planStockUpdate(
      [item([]), { inventory: { id: "iitem_2", location_levels: [] } }],
      "sloc_1"
    )
    expect(plan).toEqual({ kind: "create-level", inventoryItemId: "iitem_1" })
  })
})

describe("messages", () => {
  it("reads the text of an error or a plain value", () => {
    expect(errorText(new Error("boom"))).toBe("boom")
    expect(errorText("plain")).toBe("plain")
  })

  it("tells the merchant what was saved and what was not", () => {
    const message = partialSaveMessage("stock", new Error("no location"))
    expect(message).toContain("details were saved")
    expect(message).toContain("stock could not be updated")
    expect(message).toContain("no location")
    expect(message).toContain("save again")
  })
})
