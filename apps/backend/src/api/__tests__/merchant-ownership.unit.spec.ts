import {
  findForeignIds,
  uniqueAddresses,
} from "../admin/merchant/ownership"

describe("findForeignIds", () => {
  it("returns nothing when every id is allowed", () => {
    expect(findForeignIds(["a", "b"], ["a", "b", "c"])).toEqual([])
  })

  it("returns the ids that are not allowed", () => {
    expect(findForeignIds(["a", "x"], ["a", "b"])).toEqual(["x"])
  })

  it("rejects everything when the allowed set is empty", () => {
    expect(findForeignIds(["a"], [])).toEqual(["a"])
  })

  it("reports values that are not strings", () => {
    expect(findForeignIds([undefined, null, 1, { id: "a" }], ["a"])).toHaveLength(4)
  })

  it("accepts any iterable as the allowed set", () => {
    expect(findForeignIds(["a"], new Set(["a"]))).toEqual([])
  })
})

describe("uniqueAddresses", () => {
  const base = {
    first_name: "Amin",
    last_name: "R",
    address_1: "1 Main St",
    city: "Tunis",
    postal_code: "1000",
    country_code: "tn",
    phone: "20123456",
  }

  it("skips null and undefined addresses", () => {
    expect(uniqueAddresses([null, undefined])).toEqual([])
  })

  it("removes duplicates ignoring case and spacing", () => {
    const result = uniqueAddresses([
      { id: "a1", ...base },
      { id: "a2", ...base, city: " TUNIS " },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("a1")
  })

  it("keeps addresses that differ", () => {
    const result = uniqueAddresses([
      { id: "a1", ...base },
      { id: "a2", ...base, address_1: "2 Other St" },
    ])

    expect(result.map((a) => a.id)).toEqual(["a1", "a2"])
  })

  it("only returns known address fields", () => {
    const [address] = uniqueAddresses([
      { id: "a1", ...base, customer_id: "cus_1", metadata: { secret: true } },
    ])

    expect(address).not.toHaveProperty("customer_id")
    expect(address).not.toHaveProperty("metadata")
    expect(address.address_2).toBeNull()
  })
})
