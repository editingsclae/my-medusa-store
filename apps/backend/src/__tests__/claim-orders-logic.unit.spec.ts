import { applyClaim, buildClaimUpdates, undoClaim } from "../workflows/claim-orders-logic"

type Call = Array<{ id: string; customer_id: string }>

// A fake order module that records what it was asked to write
function fakeModule(fail = false) {
  const calls: Call[] = []
  return {
    calls,
    async updateOrders(data: Call) {
      calls.push(data)
      if (fail) throw new Error("db down")
      return data
    },
  }
}

const orders = [
  { id: "order_1", customer_id: "cus_guest" },
  { id: "order_2", customer_id: "cus_guest2" },
  { id: "order_3", customer_id: null },
]

describe("buildClaimUpdates", () => {
  it("writes the new customer and remembers the previous owner", () => {
    expect(buildClaimUpdates(["order_1", "order_2"], orders, "cus_acc")).toEqual([
      { id: "order_1", customer_id: "cus_acc", previous_customer_id: "cus_guest" },
      { id: "order_2", customer_id: "cus_acc", previous_customer_id: "cus_guest2" },
    ])
  })

  it("keeps the order of the ids it was given", () => {
    const ids = buildClaimUpdates(["order_2", "order_1"], orders, "cus_acc").map((u) => u.id)
    expect(ids).toEqual(["order_2", "order_1"])
  })

  it("leaves out an unknown id and an order without an owner", () => {
    expect(buildClaimUpdates(["order_9", "order_3", "order_1"], orders, "cus_acc")).toEqual([
      { id: "order_1", customer_id: "cus_acc", previous_customer_id: "cus_guest" },
    ])
  })

  it("gives nothing for no ids", () => {
    expect(buildClaimUpdates([], orders, "cus_acc")).toEqual([])
    expect(buildClaimUpdates(["order_1"], [], "cus_acc")).toEqual([])
  })
})

describe("applyClaim", () => {
  const updates = buildClaimUpdates(["order_1", "order_2"], orders, "cus_acc")

  it("moves all the orders in one write and gives their ids", async () => {
    const module = fakeModule()
    const moved = await applyClaim(module, updates)
    expect(moved).toEqual(["order_1", "order_2"])
    expect(module.calls).toEqual([
      [
        { id: "order_1", customer_id: "cus_acc" },
        { id: "order_2", customer_id: "cus_acc" },
      ],
    ])
  })

  it("does not write the previous owner into the order data", async () => {
    const module = fakeModule()
    await applyClaim(module, updates)
    expect(JSON.stringify(module.calls).includes("previous")).toBe(false)
  })

  it("writes nothing when there is nothing to move", async () => {
    const module = fakeModule()
    expect(await applyClaim(module, [])).toEqual([])
    expect(module.calls.length).toBe(0)
  })

  it("lets a failure through so the workflow can undo", async () => {
    await expect(applyClaim(fakeModule(true), updates)).rejects.toThrow("db down")
  })
})

describe("undoClaim", () => {
  it("gives every order back to the customer that had it", async () => {
    const module = fakeModule()
    await undoClaim(module, buildClaimUpdates(["order_1", "order_2"], orders, "cus_acc"))
    expect(module.calls).toEqual([
      [
        { id: "order_1", customer_id: "cus_guest" },
        { id: "order_2", customer_id: "cus_guest2" },
      ],
    ])
  })

  it("writes nothing when nothing was moved", async () => {
    const module = fakeModule()
    await undoClaim(module, [])
    expect(module.calls.length).toBe(0)
  })

  it("is the exact reverse of applyClaim", async () => {
    const module = fakeModule()
    const updates = buildClaimUpdates(["order_1"], orders, "cus_acc")
    await applyClaim(module, updates)
    await undoClaim(module, updates)
    expect(module.calls[0][0].customer_id).toBe("cus_acc")
    expect(module.calls[1][0].customer_id).toBe("cus_guest")
  })
})
