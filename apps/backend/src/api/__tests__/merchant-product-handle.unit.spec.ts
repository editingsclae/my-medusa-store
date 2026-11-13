import {
  baseHandle,
  isHandleTakenError,
  merchantTag,
  pickAvailableHandle,
  slugifyHandle,
} from "../admin/merchant/product-handle"

describe("slugifyHandle", () => {
  it("makes a lowercase address from a title", () => {
    expect(slugifyHandle("Nova Air Pro")).toBe("nova-air-pro")
    expect(slugifyHandle("  Nova   Air—Pro!! ")).toBe("nova-air-pro")
  })

  it("removes accents and keeps other languages", () => {
    expect(slugifyHandle("Café Crème")).toBe("cafe-creme")
    expect(slugifyHandle("حقيبة جلد")).toBe("حقيبة-جلد")
  })

  it("never ends or starts with a dash and stays short", () => {
    const slug = slugifyHandle("a".repeat(200))
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slugifyHandle("---x---")).toBe("x")
  })
})

describe("baseHandle", () => {
  it("prefers the requested handle, then the title, then a fallback", () => {
    expect(baseHandle("My Handle", "Title")).toBe("my-handle")
    expect(baseHandle(undefined, "Nova Air Pro")).toBe("nova-air-pro")
    expect(baseHandle("", "!!!")).toBe("product")
  })
})

describe("merchantTag", () => {
  it("uses the end of the sales channel id", () => {
    expect(merchantTag("sc_01JABCDEFGH")).toBe("defgh")
    expect(merchantTag(undefined)).toBe("shop")
  })
})

describe("pickAvailableHandle", () => {
  it("keeps the plain handle when it is free", async () => {
    const handle = await pickAvailableHandle("nova-air-pro", "sc_01ABCDE", async () => false)
    expect(handle).toBe("nova-air-pro")
  })

  it("adds the merchant tag when another merchant has the plain handle", async () => {
    const taken = new Set(["nova-air-pro"])
    const handle = await pickAvailableHandle("nova-air-pro", "sc_01ABCDE", async (h) => taken.has(h))
    expect(handle).toBe("nova-air-pro-abcde")
  })

  it("numbers further copies of the same merchant", async () => {
    const taken = new Set(["nova-air-pro", "nova-air-pro-abcde", "nova-air-pro-abcde-2"])
    const handle = await pickAvailableHandle("nova-air-pro", "sc_01ABCDE", async (h) => taken.has(h))
    expect(handle).toBe("nova-air-pro-abcde-3")
  })

  it("falls back to a random tag when everything is taken", async () => {
    const handle = await pickAvailableHandle("x", "sc_01ABCDE", async (h) => h.split("-").length <= 4 && h !== "")
    expect(handle.startsWith("x-")).toBe(true)
    expect(handle).not.toBe("x")
  })
})

describe("isHandleTakenError", () => {
  it("recognises Medusa's duplicate handle message", () => {
    expect(isHandleTakenError(new Error("Product with handle: nova-air-pro, already exists."))).toBe(true)
    expect(isHandleTakenError(new Error("something else"))).toBe(false)
  })
})
