import { RESEND_COOLDOWN_MS, MAX_ATTEMPTS, CODE_TTL_MS } from "../email-verification"
import { resetCodeHash } from "../password-reset"
import {
  confirmReset,
  requestReset,
  type ResetOps,
  type ResetTarget,
} from "../password-reset-flow"

const SECRET = "test-secret"
const TARGET: ResetTarget = { identityId: "authid_1", entityId: "owner@shop.tn" }
const START = 1_700_000_000_000

type Harness = {
  ops: ResetOps
  log: string[]
  sent: Array<{ to: string; code: string }>
  saved: any[]
  passwords: Array<{ entityId: string; password: string }>
  after: number[]
  lookups: string[][]
  locks: string[]
  clock: { now: number }
  state: { value: any }
}

function harness(options: {
  known?: boolean
  sendFails?: boolean
  passwordFails?: boolean
  withAfter?: boolean
  sendGate?: Promise<void>
} = {}): Harness {
  const h: Harness = {
    ops: undefined as any,
    log: [],
    sent: [],
    saved: [],
    passwords: [],
    after: [],
    lookups: [],
    locks: [],
    clock: { now: START },
    state: { value: {} },
  }
  h.ops = {
    find: async (emails) => {
      h.lookups.push(emails)
      return options.known === false ? null : TARGET
    },
    lock: async (identityId, job) => {
      h.locks.push(identityId)
      return job()
    },
    loadState: async () => h.state.value,
    saveState: async (_id, state) => {
      h.saved.push(state)
      h.state.value = state
    },
    sendEmail: async (target, code) => {
      if (options.sendGate) await options.sendGate
      if (options.sendFails) throw { message: "resend is down" }
      h.sent.push({ to: target.entityId, code })
    },
    setPassword: async (entityId, password) => {
      h.passwords.push({ entityId, password })
      return options.passwordFails
        ? { success: false, error: "provider said no" }
        : { success: true }
    },
    afterReset: options.withAfter ? async (_t, now) => void h.after.push(now) : undefined,
    hash: (identityId, entityId, code) => resetCodeHash(SECRET, identityId, entityId, code),
    now: () => h.clock.now,
    newCode: () => "123456",
    log: (message) => void h.log.push(message),
  }
  return h
}

// Asks for a code and waits for the email job
async function ask(h: Harness, email: unknown = "owner@shop.tn") {
  const result = await requestReset(h.ops, email)
  await result.done
  return result
}

const PASSWORD = "a-new-password-1"

describe("requestReset", () => {
  it("refuses something that is not an email, and looks nothing up", async () => {
    const h = harness()
    const result = await requestReset(h.ops, "not an email")
    expect(result.outcome).toBe("invalid_email")
    expect(h.lookups).toEqual([])
    expect(h.sent).toEqual([])
  })

  it("answers the same and sends nothing for an unknown email", async () => {
    const h = harness({ known: false })
    const result = await ask(h)
    expect(result.outcome).toBe("accepted")
    expect(h.sent).toEqual([])
    expect(h.saved).toEqual([])
  })

  it("emails the code and saves the state when the login exists", async () => {
    const h = harness()
    const result = await ask(h)
    expect(result.outcome).toBe("accepted")
    expect(h.sent).toEqual([{ to: "owner@shop.tn", code: "123456" }])
    expect(h.saved.length).toBe(1)
    expect(h.locks).toEqual(["authid_1"])
  })

  it("looks up the typed address and the lower case one", async () => {
    const h = harness()
    await ask(h, "  Owner@Shop.TN ")
    expect(h.lookups).toEqual([["Owner@Shop.TN", "owner@shop.tn"]])
  })

  it("sends nothing for a second request inside the cooldown, and says the same", async () => {
    const h = harness()
    await ask(h)
    h.clock.now += RESEND_COOLDOWN_MS - 1000
    const second = await ask(h)
    expect(second.outcome).toBe("accepted")
    expect(h.sent.length).toBe(1)
  })

  it("sends again after the cooldown", async () => {
    const h = harness()
    await ask(h)
    h.clock.now += RESEND_COOLDOWN_MS + 1000
    await ask(h)
    expect(h.sent.length).toBe(2)
  })

  it("does not save the state when the email could not be sent, and logs the reason", async () => {
    const h = harness({ sendFails: true })
    const result = await ask(h)
    expect(result.outcome).toBe("accepted")
    expect(h.saved).toEqual([])
    expect(h.log.length).toBe(1)
    expect(h.log[0]).toContain("resend is down")
    expect(h.log[0]).not.toContain("[object Object]")
  })

  it("answers before the email is sent", async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const h = harness({ sendGate: gate })
    const result = await requestReset(h.ops, "owner@shop.tn")
    expect(result.outcome).toBe("accepted")
    expect(h.sent).toEqual([])
    release()
    await result.done
    expect(h.sent.length).toBe(1)
  })
})

describe("confirmReset", () => {
  it("refuses a weak password first, before anything is looked up or counted", async () => {
    const h = harness()
    await ask(h)
    const savedBefore = h.saved.length
    h.lookups.length = 0
    const outcome = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: "short" })
    expect(outcome.status).toBe("weak_password")
    expect(h.lookups).toEqual([])
    expect(h.saved.length).toBe(savedBefore)
    expect(h.passwords).toEqual([])
  })

  it("says invalid_code for an email that is not an email or has no login", async () => {
    const h = harness({ known: false })
    expect((await confirmReset(h.ops, { email: "nope", code: "123456", password: PASSWORD })).status).toBe("invalid_code")
    expect((await confirmReset(h.ops, { email: "a@b.co", code: "123456", password: PASSWORD })).status).toBe("invalid_code")
    expect(h.passwords).toEqual([])
  })

  it("says invalid_code when no code was asked for, and counts nothing", async () => {
    const h = harness()
    const outcome = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(outcome.status).toBe("invalid_code")
    expect(h.saved).toEqual([])
    expect(h.passwords).toEqual([])
  })

  it("resets the password with the right code and uses the code up", async () => {
    const h = harness({ withAfter: true })
    await ask(h)
    const outcome = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(outcome).toEqual({ status: "reset", email: "owner@shop.tn" })
    expect(h.passwords).toEqual([{ entityId: "owner@shop.tn", password: PASSWORD }])
    expect(h.after).toEqual([START])
    expect(h.log).toEqual([])

    const again = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: "another-password-2" })
    expect(again.status).toBe("invalid_code")
    expect(h.passwords.length).toBe(1)
  })

  it("does not run the after step when there is none (merchant logins)", async () => {
    const h = harness()
    await ask(h)
    const outcome = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(outcome.status).toBe("reset")
    expect(h.after).toEqual([])
  })

  it("counts a wrong code and keeps the right one working", async () => {
    const h = harness()
    await ask(h)
    const savedBefore = h.saved.length
    const wrong = await confirmReset(h.ops, { email: "owner@shop.tn", code: "000000", password: PASSWORD })
    expect(wrong.status).toBe("invalid_code")
    expect(h.saved.length).toBe(savedBefore + 1)
    expect(h.passwords).toEqual([])

    const right = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(right.status).toBe("reset")
  })

  it("locks the code after too many wrong tries, even for the right code", async () => {
    const h = harness()
    await ask(h)
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await confirmReset(h.ops, { email: "owner@shop.tn", code: "000000", password: PASSWORD })
    }
    const right = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(right.status).toBe("invalid_code")
    expect(h.passwords).toEqual([])
  })

  it("refuses an expired code", async () => {
    const h = harness()
    await ask(h)
    h.clock.now += CODE_TTL_MS + 1000
    const outcome = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(outcome.status).toBe("invalid_code")
    expect(h.passwords).toEqual([])
  })

  it("reports a failed password change, logs it, and skips the after step", async () => {
    const h = harness({ passwordFails: true, withAfter: true })
    await ask(h)
    const outcome = await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(outcome.status).toBe("failed")
    expect(h.after).toEqual([])
    expect(h.log.length).toBe(1)
    expect(h.log[0]).toContain("provider said no")
  })

  it("runs under the lock of the login", async () => {
    const h = harness()
    await ask(h)
    h.locks.length = 0
    await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: PASSWORD })
    expect(h.locks).toEqual(["authid_1"])
  })

  it("keeps the password as typed, spaces included", async () => {
    const h = harness()
    await ask(h)
    await confirmReset(h.ops, { email: "owner@shop.tn", code: "123456", password: "  spaced password  " })
    expect(h.passwords[0].password).toBe("  spaced password  ")
  })
})
