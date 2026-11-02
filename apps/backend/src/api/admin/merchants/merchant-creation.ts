// The steps that make a new merchant, in order, with the undo of each one. No
// framework imports: everything that touches the database comes in through
// `MerchantOps`, so the order of the steps and the clean up after a failure can
// be unit tested with fake operations.
//
// What it guarantees:
//  - nothing is created when the email is already used by a user or a login
//  - when a step fails, everything created before it is deleted again (newest
//    first) and the original error is thrown; a clean up that fails is reported
//    but never hides the original error
//  - when a password is given, the login has to be created: if it cannot be, the
//    merchant is not left behind without a way to sign in
//  - delivery setup is the one step that may fail on its own: the merchant is
//    kept and the problem is reported, because it can be repeated later with the
//    backfill script

import { createUndoStack, type UndoFailure } from "./undo-stack"

export type MerchantInput = {
  name: string
  email: string
  description?: string
  firstName?: string
  lastName?: string
  password?: string
  countries: string[]
  shippingAmount: number
  // Who creates the merchant (for the audit field of the API key)
  createdBy: string
}

export type FulfillmentSetup = {
  created: boolean
  fulfillment_set_id: string
  shipping_option_id?: string
  [key: string]: unknown
}

type Entity = { id: string; [key: string]: any }

export type MerchantOps = {
  userEmailExists(email: string): Promise<boolean>
  loginExists(email: string): Promise<boolean>

  createChannel(name: string, description: string): Promise<Entity>
  deleteChannel(id: string): Promise<unknown>

  createLocation(name: string): Promise<Entity>
  deleteLocation(id: string): Promise<unknown>
  linkLocationToChannel(locationId: string, channelId: string): Promise<unknown>

  provisionFulfillment(options: {
    merchantName: string
    stockLocationId: string
    countries: string[]
    shippingAmount: number
  }): Promise<FulfillmentSetup>
  deleteFulfillment(setup: { shippingOptionId?: string; fulfillmentSetId: string }): Promise<unknown>

  createKey(title: string, createdBy: string): Promise<Entity>
  linkKeyToChannel(keyId: string, channelId: string): Promise<unknown>
  deleteKey(id: string): Promise<unknown>

  createUser(data: {
    email: string
    first_name: string
    last_name: string
    metadata: Record<string, unknown>
  }): Promise<Entity>
  deleteUser(id: string): Promise<unknown>

  // Creates the email and password login. Throws when it cannot.
  registerLogin(email: string, password: string): Promise<Entity>
  deleteLogin(id: string): Promise<unknown>
  attachLoginToUser(loginId: string, userId: string): Promise<unknown>

  // For clean ups that did not work
  report(message: string): void
}

export type CreatedMerchant = {
  channel: Entity
  location: Entity
  key: Entity
  user: Entity
  fulfillment: FulfillmentSetup | null
  fulfillmentError: string | null
}

// The reason a merchant could not be created, for the caller to turn into an
// answer. "duplicate": the email is taken. "login": the login could not be made.
export class MerchantSetupError extends Error {
  kind: "duplicate" | "login"

  constructor(kind: "duplicate" | "login", message: string) {
    super(message)
    this.name = "MerchantSetupError"
    this.kind = kind
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function createMerchantSteps(
  ops: MerchantOps,
  input: MerchantInput
): Promise<CreatedMerchant> {
  // Refuse before anything exists
  if (await ops.userEmailExists(input.email)) {
    throw new MerchantSetupError(
      "duplicate",
      `A user with the email ${input.email} already exists`
    )
  }
  if (input.password && (await ops.loginExists(input.email))) {
    throw new MerchantSetupError(
      "duplicate",
      `A login with the email ${input.email} already exists (for example a shopper account). Use another email.`
    )
  }

  const undo = createUndoStack()

  try {
    const channel = await ops.createChannel(
      input.name,
      input.description || `Sales channel for ${input.name}`
    )
    undo.add(`sales channel ${channel.id}`, () => ops.deleteChannel(channel.id))

    const location = await ops.createLocation(`${input.name} Warehouse`)
    undo.add(`stock location ${location.id}`, () => ops.deleteLocation(location.id))

    await ops.linkLocationToChannel(location.id, channel.id)

    let fulfillment: FulfillmentSetup | null = null
    let fulfillmentError: string | null = null
    try {
      fulfillment = await ops.provisionFulfillment({
        merchantName: input.name,
        stockLocationId: location.id,
        countries: input.countries,
        shippingAmount: input.shippingAmount,
      })
    } catch (err) {
      fulfillmentError = describe(err)
      ops.report(`Could not set up merchant fulfillment: ${fulfillmentError}`)
    }
    if (fulfillment?.created) {
      const setup = fulfillment
      undo.add(`delivery setup ${setup.fulfillment_set_id}`, () =>
        ops.deleteFulfillment({
          shippingOptionId: setup.shipping_option_id,
          fulfillmentSetId: setup.fulfillment_set_id,
        })
      )
    }

    const key = await ops.createKey(`${input.name} Storefront Key`, input.createdBy)
    undo.add(`publishable key ${key.id}`, () => ops.deleteKey(key.id))

    await ops.linkKeyToChannel(key.id, channel.id)

    const user = await ops.createUser({
      email: input.email,
      first_name: input.firstName || input.name,
      last_name: input.lastName || "",
      metadata: {
        role: "merchant",
        sales_channel_id: channel.id,
        stock_location_id: location.id,
      },
    })
    undo.add(`user ${user.id}`, () => ops.deleteUser(user.id))

    if (input.password) {
      let login: Entity
      try {
        login = await ops.registerLogin(input.email, input.password)
      } catch (err) {
        throw new MerchantSetupError(
          "login",
          `The login for ${input.email} could not be created: ${describe(err)}`
        )
      }
      undo.add(`login ${login.id}`, () => ops.deleteLogin(login.id))

      try {
        await ops.attachLoginToUser(login.id, user.id)
      } catch (err) {
        throw new MerchantSetupError(
          "login",
          `The login for ${input.email} could not be linked to the merchant: ${describe(err)}`
        )
      }
    }

    return { channel, location, key, user, fulfillment, fulfillmentError }
  } catch (err) {
    const left: UndoFailure[] = await undo.rollback()
    if (left.length > 0) {
      ops.report(
        `Merchant "${input.name}" could not be created (${describe(err)}) and the clean up was not complete. ` +
          `Left behind, delete by hand: ${left.map((l) => `${l.label} (${l.error})`).join("; ")}`
      )
    }
    throw err
  }
}
