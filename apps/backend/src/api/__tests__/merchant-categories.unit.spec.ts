import {
  slugifyHandle,
  toPublicCategoryHandle,
  toStoredCategoryHandle,
} from "../admin/merchant/ownership"
import {
  assertCategoriesOwned,
  getOwnedCategory,
  onlyOwnedCategories,
} from "../admin/merchant/category-access"

// The link definition imports Medusa modules that are not needed here. Only the
// entry point name is used, and the fake query below answers to it.
jest.mock("../../links/sales-channel-product-category", () => ({
  __esModule: true,
  default: { entryPoint: "sales_channel_product_category" },
}))

type Db = {
  links: { sales_channel_id: string; product_category_id: string }[]
  categories: { id: string; name: string; handle: string }[]
}

const asList = (value: unknown): string[] | undefined =>
  value === undefined ? undefined : ([] as string[]).concat(value as any)

// A tiny in-memory stand-in for query.graph, enough for the category helpers
function makeScope(db: Db) {
  const query = {
    graph: async ({ entity, filters = {} }: any) => {
      if (entity === "sales_channel_product_category") {
        const channels = asList(filters.sales_channel_id)
        const categories = asList(filters.product_category_id)
        return {
          data: db.links.filter(
            (l) =>
              (!channels || channels.includes(l.sales_channel_id)) &&
              (!categories || categories.includes(l.product_category_id))
          ),
        }
      }

      if (entity === "product_category") {
        const ids = asList(filters.id)
        return { data: db.categories.filter((c) => !ids || ids.includes(c.id)) }
      }

      throw new Error(`unexpected entity ${entity}`)
    },
  }

  return { resolve: () => query } as any
}

const CHANNEL_A = "sc_AAA"
const CHANNEL_B = "sc_BBB"

// Both merchants have a category called "Electronics"
function twoMerchantsSameName(): Db {
  return {
    links: [
      { sales_channel_id: CHANNEL_A, product_category_id: "pcat_a" },
      { sales_channel_id: CHANNEL_B, product_category_id: "pcat_b" },
    ],
    categories: [
      {
        id: "pcat_a",
        name: "Electronics",
        handle: toStoredCategoryHandle(CHANNEL_A, "electronics"),
      },
      {
        id: "pcat_b",
        name: "Electronics",
        handle: toStoredCategoryHandle(CHANNEL_B, "electronics"),
      },
    ],
  }
}

describe("slugifyHandle", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugifyHandle("  Home  &  Garden ")).toBe("home-garden")
  })

  it("removes accents", () => {
    expect(slugifyHandle("Accessoires électroniques")).toBe(
      "accessoires-electroniques"
    )
  })

  it("returns an empty string when there are no latin letters or digits", () => {
    expect(slugifyHandle("إلكترونيات")).toBe("")
    expect(slugifyHandle(undefined)).toBe("")
    expect(slugifyHandle(42)).toBe("")
  })

  it("never produces the category separator, so the prefix split stays exact", () => {
    expect(slugifyHandle("a -- b")).toBe("a-b")
    expect(slugifyHandle("--x--")).toBe("x")
  })

  it("caps the length without leaving a trailing dash", () => {
    const slug = slugifyHandle(`${"a".repeat(59)} b`)
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug.endsWith("-")).toBe(false)
  })
})

describe("category handles", () => {
  it("gives two merchants different stored handles for the same slug", () => {
    expect(toStoredCategoryHandle(CHANNEL_A, "electronics")).not.toBe(
      toStoredCategoryHandle(CHANNEL_B, "electronics")
    )
  })

  it("shows the merchant the handle without the channel prefix", () => {
    const stored = toStoredCategoryHandle(CHANNEL_A, "electronics")
    expect(toPublicCategoryHandle(CHANNEL_A, stored)).toBe("electronics")
  })

  it("does not strip a prefix that belongs to another merchant", () => {
    const stored = toStoredCategoryHandle(CHANNEL_B, "electronics")
    expect(toPublicCategoryHandle(CHANNEL_A, stored)).toBe(stored)
  })
})

describe("two merchants with the same category name", () => {
  it("lets each merchant use only its own category", async () => {
    const scope = makeScope(twoMerchantsSameName())

    await expect(assertCategoriesOwned(scope, CHANNEL_A, ["pcat_a"])).resolves.toEqual(["pcat_a"])
    await expect(assertCategoriesOwned(scope, CHANNEL_B, ["pcat_b"])).resolves.toEqual(["pcat_b"])
  })

  it("rejects the other merchant's category even though the name matches", async () => {
    const scope = makeScope(twoMerchantsSameName())

    await expect(assertCategoriesOwned(scope, CHANNEL_A, ["pcat_b"])).rejects.toThrow(
      "do not belong to this merchant"
    )
    await expect(assertCategoriesOwned(scope, CHANNEL_B, ["pcat_a"])).rejects.toThrow(
      "do not belong to this merchant"
    )
  })

  it("rejects a list that mixes own and foreign categories", async () => {
    const scope = makeScope(twoMerchantsSameName())

    await expect(
      assertCategoriesOwned(scope, CHANNEL_A, ["pcat_a", "pcat_b"])
    ).rejects.toThrow("do not belong to this merchant")
  })

  it("keeps the other merchant's category after one merchant deletes theirs", async () => {
    const db = twoMerchantsSameName()

    // Merchant A deletes Electronics: the category row and its link are removed
    db.categories = db.categories.filter((c) => c.id !== "pcat_a")
    db.links = db.links.filter((l) => l.product_category_id !== "pcat_a")

    const scope = makeScope(db)

    const stillThere = await getOwnedCategory(scope, CHANNEL_B, "pcat_b")
    expect(stillThere.name).toBe("Electronics")
    await expect(assertCategoriesOwned(scope, CHANNEL_B, ["pcat_b"])).resolves.toEqual(["pcat_b"])

    // and merchant A can no longer find or use it
    await expect(getOwnedCategory(scope, CHANNEL_A, "pcat_a")).rejects.toThrow("Category not found")
  })

  it("treats a stale link to a deleted category as missing", async () => {
    const db = twoMerchantsSameName()
    db.categories = db.categories.filter((c) => c.id !== "pcat_a")

    const scope = makeScope(db)

    await expect(assertCategoriesOwned(scope, CHANNEL_A, ["pcat_a"])).rejects.toThrow(
      "do not exist"
    )
    await expect(getOwnedCategory(scope, CHANNEL_A, "pcat_a")).rejects.toThrow("Category not found")
  })

  it("gives the same not found error for a foreign category as for a missing one", async () => {
    const scope = makeScope(twoMerchantsSameName())

    const foreign = getOwnedCategory(scope, CHANNEL_A, "pcat_b")
    const missing = getOwnedCategory(scope, CHANNEL_A, "pcat_nope")

    await expect(foreign).rejects.toThrow("Category not found")
    await expect(missing).rejects.toThrow("Category not found")
  })
})

describe("assertCategoriesOwned input checks", () => {
  const scope = makeScope(twoMerchantsSameName())

  it("accepts an empty array, which clears a product's categories", async () => {
    await expect(assertCategoriesOwned(scope, CHANNEL_A, [])).resolves.toEqual([])
  })

  it("removes duplicate ids", async () => {
    await expect(
      assertCategoriesOwned(scope, CHANNEL_A, ["pcat_a", "pcat_a"])
    ).resolves.toEqual(["pcat_a"])
  })

  it("rejects values that are not an array of non-empty strings", async () => {
    for (const bad of ["pcat_a", null, undefined, { id: "pcat_a" }, [1], [""], [null]]) {
      await expect(assertCategoriesOwned(scope, CHANNEL_A, bad)).rejects.toThrow(
        "category_ids must be an array"
      )
    }
  })
})

describe("onlyOwnedCategories", () => {
  const product = {
    id: "prod_1",
    categories: [
      { id: "pcat_a", name: "Electronics", handle: "sc_aaa--electronics" },
      { id: "pcat_b", name: "Electronics", handle: "sc_bbb--electronics" },
      null,
    ],
  }

  it("keeps only this merchant's categories and drops the stored handle", async () => {
    const scope = makeScope(twoMerchantsSameName())

    const [result] = await onlyOwnedCategories(scope, CHANNEL_A, [product])

    expect(result.categories).toEqual([{ id: "pcat_a", name: "Electronics" }])
  })

  it("leaves products untouched for a platform admin without a selected channel", async () => {
    const scope = makeScope(twoMerchantsSameName())

    const result = await onlyOwnedCategories(scope, "", [product])

    expect(result[0]).toBe(product)
  })

  it("gives a product without categories an empty list", async () => {
    const scope = makeScope(twoMerchantsSameName())

    const [result] = await onlyOwnedCategories(scope, CHANNEL_A, [{ id: "prod_2" } as any])

    expect(result.categories).toEqual([])
  })
})
