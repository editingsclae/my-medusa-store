import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  blockMerchantsFromCoreAdmin,
  isScopedMerchant,
} from "../merchant-guard"

describe("isScopedMerchant", () => {
  it("returns false when metadata is null or undefined", () => {
    expect(isScopedMerchant(null)).toBe(false)
    expect(isScopedMerchant(undefined)).toBe(false)
    expect(isScopedMerchant({})).toBe(false)
  })

  it("returns false for platform admin users with role 'admin'", () => {
    expect(isScopedMerchant({ role: "admin" })).toBe(false)
  })

  it("returns false for admin even if sales_channel_id is present", () => {
    expect(
      isScopedMerchant({ role: "admin", sales_channel_id: "sc_123" })
    ).toBe(false)
  })

  it("returns true for merchants with role 'merchant'", () => {
    expect(isScopedMerchant({ role: "merchant" })).toBe(true)
  })

  it("returns true when sales_channel_id is set without role 'admin'", () => {
    expect(isScopedMerchant({ sales_channel_id: "sc_123" })).toBe(true)
    expect(
      isScopedMerchant({ role: "vendor", sales_channel_id: "sc_123" })
    ).toBe(true)
  })
})

describe("blockMerchantsFromCoreAdmin", () => {
  function createMocks({
    actorType = "user",
    actorId = "usr_123",
    authContext,
    originalUrl = "/admin/orders",
    userMetadata = { role: "merchant" } as Record<string, unknown> | null,
    queryError = null as Error | null,
  }: {
    actorType?: string
    actorId?: string
    authContext?: AuthenticatedMedusaRequest["auth_context"] | null
    originalUrl?: string
    userMetadata?: Record<string, unknown> | null
    queryError?: Error | null
  } = {}) {
    const resolvedAuth =
      authContext === undefined
        ? {
            actor_type: actorType,
            actor_id: actorId,
            auth_identity_id: "auth_123",
            app_metadata: {},
          }
        : (authContext ?? undefined)

    const req = {
      auth_context: resolvedAuth,
      originalUrl,
      scope: {
        resolve: jest.fn().mockImplementation((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => {
                if (queryError) {
                  throw queryError
                }
                return {
                  data: [{ id: actorId, metadata: userMetadata }],
                }
              }),
            }
          }
          throw new Error(`Unexpected key: ${key}`)
        }),
      },
    } as unknown as AuthenticatedMedusaRequest

    const jsonMock = jest.fn()
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock })

    const res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as MedusaResponse

    const next = jest.fn() as unknown as MedusaNextFunction

    return { req, res, next, statusMock, jsonMock }
  }

  it("allows non-user actors (e.g. customer) without querying user entity", async () => {
    const { req, res, next } = createMocks({ actorType: "customer" })
    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(req.scope.resolve).not.toHaveBeenCalled()
  })

  it("allows unauthenticated requests to pass through to authenticate middleware", async () => {
    const { req, res, next } = createMocks({ authContext: null })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })

  it("allows platform admin users to access core /admin/orders", async () => {
    const { req, res, next, statusMock } = createMocks({
      originalUrl: "/admin/orders",
      userMetadata: { role: "admin" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(statusMock).not.toHaveBeenCalled()
  })

  it("returns 403 on GET /admin/orders for merchant users", async () => {
    const { req, res, next, statusMock, jsonMock } = createMocks({
      originalUrl: "/admin/orders",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  })

  it("returns 403 on GET /admin/products for merchant users", async () => {
    const { req, res, next, statusMock, jsonMock } = createMocks({
      originalUrl: "/admin/products",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  })

  it("returns 403 on GET /admin/api-keys for merchant users", async () => {
    const { req, res, next, statusMock, jsonMock } = createMocks({
      originalUrl: "/admin/api-keys",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  })

  it("returns 403 on GET /admin/users/me for merchant users", async () => {
    const { req, res, next, statusMock, jsonMock } = createMocks({
      originalUrl: "/admin/users/me",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  })

  it("returns 403 on POST /admin/users/me attempting role escalation", async () => {
    const { req, res, next, statusMock, jsonMock } = createMocks({
      originalUrl: "/admin/users/me",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  })

  it("returns 403 on /admin/merchants (platform provisioning route) for merchants", async () => {
    const { req, res, next, statusMock, jsonMock } = createMocks({
      originalUrl: "/admin/merchants",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(403)
    expect(jsonMock).toHaveBeenCalledWith({
      type: "not_allowed",
      message: "Merchant accounts can only use the merchant portal API",
    })
  })

  it("allows merchant users to access /admin/merchant/me", async () => {
    const { req, res, next, statusMock } = createMocks({
      originalUrl: "/admin/merchant/me",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(statusMock).not.toHaveBeenCalled()
  })

  it("allows merchant users to access sub-routes like /admin/merchant/orders/ord_123", async () => {
    const { req, res, next, statusMock } = createMocks({
      originalUrl: "/admin/merchant/orders/ord_123?expand=items",
      userMetadata: { role: "merchant" },
    })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(statusMock).not.toHaveBeenCalled()
  })

  it("fails closed and calls next(error) when user lookup fails", async () => {
    const dbError = new Error("Database connection lost")
    const { req, res, next } = createMocks({ queryError: dbError })

    await blockMerchantsFromCoreAdmin(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(dbError)
  })
})
