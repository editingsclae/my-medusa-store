import { createUndoStack } from "../admin/merchants/undo-stack"
import {
  createMerchantSteps,
  MerchantSetupError,
  type MerchantInput,
  type MerchantOps,
} from "../admin/merchants/merchant-creation"

describe("createUndoStack", () => {
  it("runs the undo steps newest first", async () => {
    const order: string[] = []
    const stack = createUndoStack()
    stack.add("a", async () => void order.push("a"))
    stack.add("b", async () => void order.push("b"))
    stack.add("c", async () => void order.push("c"))

    const failed = await stack.rollback()

    expect(order).toEqual(["c", "b", "a"])
    expect(failed).toEqual([])
    expect(stack.size).toBe(0)
  })

  it("keeps going when one undo fails and reports it", async () => {
    const order: string[] = []
    const stack = createUndoStack()
    stack.add("first", async () => void order.push("first"))
    stack.add("broken", async () => {
      throw new Error("db down")
    })
    stack.add("last", async () => void order.push("last"))

    const failed = await stack.rollback()

    expect(order).toEqual(["last", "first"])
    expect(failed).toEqual([{ label: "broken", error: "db down" }])
  })

  it("reads the message of a thrown plain object instead of [object Object]", async () => {
    const stack = createUndoStack()
    stack.add("key", async () => {
      throw { message: "Cannot delete api keys that are not revoked", name: "Error" }
    })
    const failed = await stack.rollback()
    expect(failed).toEqual([
      { label: "key", error: "Cannot delete api keys that are not revoked" },
    ])
  })

  it("does nothing a second time", async () => {
    const order: string[] = []
    const stack = createUndoStack()
    stack.add("a", async () => void order.push("a"))
    await stack.rollback()
    await stack.rollback()
    expect(order).toEqual(["a"])
  })
})

type Calls = string[]

// Fake operations that record what was called. `failAt` makes one operation throw.
function makeOps(
  calls: Calls,
  opts: {
    failAt?: string
    undoFailAt?: string
    userExists?: boolean
    loginExists?: boolean
    fulfillmentCreated?: boolean
  } = {}
): MerchantOps {
  const run = async (name: string, value?: any) => {
    calls.push(name)
    if (opts.failAt === name) {
      throw new Error(`${name} failed`)
    }
    return value
  }
  const undo = async (name: string) => {
    calls.push(name)
    if (opts.undoFailAt === name) {
      throw new Error(`${name} failed`)
    }
  }
  return {
    userEmailExists: async () => !!opts.userExists,
    loginExists: async () => !!opts.loginExists,
    createChannel: () => run("createChannel", { id: "sc_1" }),
    deleteChannel: () => undo("deleteChannel"),
    createLocation: () => run("createLocation", { id: "sloc_1" }),
    deleteLocation: () => undo("deleteLocation"),
    linkLocationToChannel: () => run("linkLocationToChannel"),
    provisionFulfillment: () =>
      run("provisionFulfillment", {
        created: opts.fulfillmentCreated !== false,
        fulfillment_set_id: "fuset_1",
        shipping_option_id: "so_1",
      }),
    deleteFulfillment: () => undo("deleteFulfillment"),
    createKey: () => run("createKey", { id: "apk_1", token: "pk_1" }),
    linkKeyToChannel: () => run("linkKeyToChannel"),
    deleteKey: () => undo("deleteKey"),
    createUser: () => run("createUser", { id: "user_1" }),
    deleteUser: () => undo("deleteUser"),
    registerLogin: () => run("registerLogin", { id: "auth_1" }),
    deleteLogin: () => undo("deleteLogin"),
    attachLoginToUser: () => run("attachLoginToUser"),
    report: (message: string) => void calls.push(`report: ${message}`),
  }
}

const input: MerchantInput = {
  name: "Zara",
  email: "owner@zara.tn",
  password: "secret123",
  countries: ["tn"],
  shippingAmount: 7,
  createdBy: "user_admin",
}

describe("createMerchantSteps", () => {
  it("creates everything in order and keeps it", async () => {
    const calls: Calls = []
    const result = await createMerchantSteps(makeOps(calls), input)

    expect(calls).toEqual([
      "createChannel",
      "createLocation",
      "linkLocationToChannel",
      "provisionFulfillment",
      "createKey",
      "linkKeyToChannel",
      "createUser",
      "registerLogin",
      "attachLoginToUser",
    ])
    expect(result.channel.id).toBe("sc_1")
    expect(result.key.token).toBe("pk_1")
    expect(result.user.id).toBe("user_1")
    expect(result.fulfillmentError).toBe(null)
  })

  it("skips the login when no password is given", async () => {
    const calls: Calls = []
    await createMerchantSteps(makeOps(calls), { ...input, password: undefined })
    expect(calls.includes("registerLogin")).toBe(false)
    expect(calls.includes("attachLoginToUser")).toBe(false)
  })

  it("refuses a used user email before creating anything", async () => {
    const calls: Calls = []
    let error: any
    try {
      await createMerchantSteps(makeOps(calls, { userExists: true }), input)
    } catch (err) {
      error = err
    }
    expect(error instanceof MerchantSetupError).toBe(true)
    expect(error.kind).toBe("duplicate")
    expect(calls).toEqual([])
  })

  it("refuses an email that already has a login, before creating anything", async () => {
    const calls: Calls = []
    let error: any
    try {
      await createMerchantSteps(makeOps(calls, { loginExists: true }), input)
    } catch (err) {
      error = err
    }
    expect(error.kind).toBe("duplicate")
    expect(calls).toEqual([])
  })

  it("does not check logins when no password is given", async () => {
    const calls: Calls = []
    await createMerchantSteps(makeOps(calls, { loginExists: true }), {
      ...input,
      password: undefined,
    })
    expect(calls[0]).toBe("createChannel")
  })

  it("deletes what was created, newest first, when the user cannot be created", async () => {
    const calls: Calls = []
    let error: any
    try {
      await createMerchantSteps(makeOps(calls, { failAt: "createUser" }), input)
    } catch (err) {
      error = err
    }
    expect(error.message).toBe("createUser failed")
    expect(calls.slice(calls.indexOf("createUser") + 1)).toEqual([
      "deleteKey",
      "deleteFulfillment",
      "deleteLocation",
      "deleteChannel",
    ])
  })

  it("deletes the merchant when the login cannot be created", async () => {
    const calls: Calls = []
    let error: any
    try {
      await createMerchantSteps(makeOps(calls, { failAt: "registerLogin" }), input)
    } catch (err) {
      error = err
    }
    expect(error instanceof MerchantSetupError).toBe(true)
    expect(error.kind).toBe("login")
    expect(error.message).toContain("registerLogin failed")
    expect(calls.slice(calls.indexOf("registerLogin") + 1)).toEqual([
      "deleteUser",
      "deleteKey",
      "deleteFulfillment",
      "deleteLocation",
      "deleteChannel",
    ])
  })

  it("also deletes the login when linking it to the user fails", async () => {
    const calls: Calls = []
    let error: any
    try {
      await createMerchantSteps(makeOps(calls, { failAt: "attachLoginToUser" }), input)
    } catch (err) {
      error = err
    }
    expect(error.kind).toBe("login")
    expect(calls.slice(calls.indexOf("attachLoginToUser") + 1)[0]).toBe("deleteLogin")
    expect(calls.includes("deleteChannel")).toBe(true)
  })

  it("removes the sales channel when the stock location fails", async () => {
    const calls: Calls = []
    try {
      await createMerchantSteps(makeOps(calls, { failAt: "createLocation" }), input)
    } catch {
      // expected
    }
    expect(calls).toEqual(["createChannel", "createLocation", "deleteChannel"])
  })

  it("keeps the merchant when only the delivery setup fails", async () => {
    const calls: Calls = []
    const result = await createMerchantSteps(
      makeOps(calls, { failAt: "provisionFulfillment" }),
      input
    )
    expect(result.fulfillment).toBe(null)
    expect(result.fulfillmentError).toBe("provisionFulfillment failed")
    expect(calls.includes("createUser")).toBe(true)
    expect(calls.includes("deleteChannel")).toBe(false)
    expect(calls.some((c) => c.startsWith("report: Could not set up"))).toBe(true)
  })

  it("does not delete a delivery setup that already existed", async () => {
    const calls: Calls = []
    try {
      await createMerchantSteps(
        makeOps(calls, { fulfillmentCreated: false, failAt: "createKey" }),
        input
      )
    } catch {
      // expected
    }
    expect(calls.includes("deleteFulfillment")).toBe(false)
  })

  it("throws the original error and reports what a failed clean up left behind", async () => {
    const calls: Calls = []
    let error: any
    try {
      await createMerchantSteps(
        makeOps(calls, { failAt: "createUser", undoFailAt: "deleteKey" }),
        input
      )
    } catch (err) {
      error = err
    }
    expect(error.message).toBe("createUser failed")
    // the clean up went on after the failed one
    expect(calls.includes("deleteChannel")).toBe(true)
    const report = calls.find((c) => c.startsWith("report: Merchant"))
    expect(report === undefined).toBe(false)
    expect(report).toContain("publishable key apk_1")
    expect(report).toContain("deleteKey failed")
  })

  it("stays quiet when the clean up worked", async () => {
    const calls: Calls = []
    try {
      await createMerchantSteps(makeOps(calls, { failAt: "createUser" }), input)
    } catch {
      // expected
    }
    expect(calls.some((c) => c.startsWith("report: Merchant"))).toBe(false)
  })

  it("passes the merchant details on", async () => {
    const created: any[] = []
    const ops = makeOps([])
    ops.createUser = async (data) => {
      created.push(data)
      return { id: "user_1" }
    }
    await createMerchantSteps(ops, { ...input, firstName: "Sami", lastName: "B" })
    expect(created[0]).toEqual({
      email: "owner@zara.tn",
      first_name: "Sami",
      last_name: "B",
      metadata: { role: "merchant", sales_channel_id: "sc_1", stock_location_id: "sloc_1" },
    })

    const defaults: any[] = []
    const ops2 = makeOps([])
    ops2.createUser = async (data) => {
      defaults.push(data)
      return { id: "user_1" }
    }
    await createMerchantSteps(ops2, input)
    expect(defaults[0].first_name).toBe("Zara")
    expect(defaults[0].last_name).toBe("")
  })
})
