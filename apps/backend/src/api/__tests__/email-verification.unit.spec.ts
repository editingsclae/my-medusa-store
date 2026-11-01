import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  MAX_SENDS_PER_WINDOW,
  RESEND_COOLDOWN_MS,
  SEND_WINDOW_MS,
  VERIFICATION_METADATA_KEY,
  createKeyedLock,
  generateCode,
  hashCode,
  isVerified,
  parseCode,
  planConfirm,
  planSend,
  readState,
  statusOf,
  writeState,
} from "../email-verification"

const SECRET = "test-secret"
const IDENTITY = "authid_1"
const EMAIL = "amin@example.com"
const NOW = 1_700_000_000_000

function hashOf(code: string, email = EMAIL, identity = IDENTITY) {
  return hashCode(SECRET, identity, email, code)
}

// A state with a code "123456" sent at NOW
function sent(extra: Record<string, unknown> = {}, now = NOW) {
  const plan: any = planSend({}, EMAIL, now, hashOf("123456"))
  return { ...plan.state, ...extra }
}

function confirm(state: any, submitted: unknown, now = NOW + 1000, email = EMAIL): any {
  return planConfirm(state, email, submitted, now, (code) => hashOf(code, email))
}

describe("readState / writeState", () => {
  it("reads nothing as an empty state", () => {
    expect(readState(undefined)).toEqual({})
    expect(readState(null)).toEqual({})
    expect(readState("x")).toEqual({})
    expect(readState({})).toEqual({})
    expect(readState({ [VERIFICATION_METADATA_KEY]: "x" })).toEqual({})
    expect(readState({ [VERIFICATION_METADATA_KEY]: [] })).toEqual({})
  })

  it("reads a saved state back", () => {
    const state = sent({ verified_email: "amin@example.com", verified_at: NOW })
    const saved = writeState({ customer_id: "cus_1" }, state)
    expect(readState(saved)).toEqual(state)
  })

  it("keeps the other keys of app_metadata (the link to the customer)", () => {
    const saved = writeState({ customer_id: "cus_1", other: 1 }, { verified_email: EMAIL })
    expect(saved.customer_id).toBe("cus_1")
    expect(saved.other).toBe(1)
    expect((saved as any)[VERIFICATION_METADATA_KEY]).toEqual({ verified_email: EMAIL })
  })

  it("replaces only the verification key", () => {
    const first = writeState({ customer_id: "cus_1" }, sent())
    const second = writeState(first, { verified_email: EMAIL })
    expect(readState(second).pending).toBe(undefined)
    expect(second.customer_id).toBe("cus_1")
  })

  it("does not save empty values", () => {
    const saved: any = writeState({}, { verified_email: EMAIL, pending: null, last_sent_at: undefined })
    expect(Object.keys(saved[VERIFICATION_METADATA_KEY])).toEqual(["verified_email"])
  })

  it("works with app_metadata that is not an object", () => {
    expect((writeState(null, { verified_email: EMAIL }) as any)[VERIFICATION_METADATA_KEY]).toEqual({
      verified_email: EMAIL,
    })
  })

  it("lower cases stored addresses and drops damaged fields", () => {
    const state = readState({
      [VERIFICATION_METADATA_KEY]: {
        verified_email: " Amin@Example.com ",
        verified_at: "yesterday",
        last_sent_at: NaN,
        send_count: 2,
        pending: { email: "A@B.com", code_hash: "h", expires_at: NOW, attempts: 1 },
      },
    })
    expect(state.verified_email).toBe("amin@example.com")
    expect(state.verified_at).toBe(undefined)
    expect(state.last_sent_at).toBe(undefined)
    expect(state.send_count).toBe(2)
    expect(state.pending?.email).toBe("a@b.com")
  })

  it("drops a pending code that is incomplete", () => {
    expect(readState({ [VERIFICATION_METADATA_KEY]: { pending: { email: EMAIL } } }).pending).toBe(undefined)
    expect(
      readState({
        [VERIFICATION_METADATA_KEY]: { pending: { email: EMAIL, code_hash: "", expires_at: 1, attempts: 0 } },
      }).pending
    ).toBe(undefined)
  })
})

describe("isVerified", () => {
  it("is true only for the confirmed address", () => {
    const state = { verified_email: EMAIL }
    expect(isVerified(state, "amin@example.com")).toBe(true)
    expect(isVerified(state, "  AMIN@Example.com ")).toBe(true)
    expect(isVerified(state, "other@example.com")).toBe(false)
  })

  it("is false without a confirmed address or without an email", () => {
    expect(isVerified({}, EMAIL)).toBe(false)
    expect(isVerified({ verified_email: EMAIL }, "")).toBe(false)
    expect(isVerified({ verified_email: EMAIL }, undefined)).toBe(false)
    expect(isVerified({ verified_email: EMAIL }, null)).toBe(false)
  })

  it("ends when the customer changes email", () => {
    const state = { verified_email: "old@example.com" }
    expect(isVerified(state, "new@example.com")).toBe(false)
  })
})

describe("generateCode / parseCode", () => {
  it("makes 6 digits, with leading zeros", () => {
    expect(generateCode(() => 7)).toBe("000007")
    expect(generateCode(() => 123456)).toBe("123456")
    expect(generateCode(() => 999999)).toBe("999999")
  })

  it("asks for a random number below 1000000", () => {
    let range: number[] = []
    generateCode((min, max) => {
      range = [min, max]
      return 1
    })
    expect(range).toEqual([0, 1000000])
  })

  it("makes real codes of 6 digits", () => {
    for (let i = 0; i < 50; i++) {
      expect(/^\d{6}$/.test(generateCode())).toBe(true)
    }
  })

  it("accepts digits, with spaces or dashes", () => {
    expect(parseCode("123456")).toBe("123456")
    expect(parseCode(" 123 456 ")).toBe("123456")
    expect(parseCode("123-456")).toBe("123456")
    expect(parseCode("000000")).toBe("000000")
  })

  it("refuses anything else", () => {
    expect(parseCode("12345")).toBe(null)
    expect(parseCode("1234567")).toBe(null)
    expect(parseCode("12345a")).toBe(null)
    expect(parseCode("")).toBe(null)
    expect(parseCode(123456)).toBe(null)
    expect(parseCode(undefined)).toBe(null)
    expect(parseCode({})).toBe(null)
    expect(parseCode("١٢٣٤٥٦")).toBe(null)
  })
})

describe("hashCode", () => {
  it("is the same for the same input and does not contain the code", () => {
    expect(hashOf("123456")).toBe(hashOf("123456"))
    expect(hashOf("123456").includes("123456")).toBe(false)
    expect(/^[0-9a-f]{64}$/.test(hashOf("123456"))).toBe(true)
  })

  it("changes with the code, the account, the address and the secret", () => {
    const base = hashOf("123456")
    expect(hashOf("123457")).not.toBe(base)
    expect(hashOf("123456", EMAIL, "authid_2")).not.toBe(base)
    expect(hashOf("123456", "other@example.com")).not.toBe(base)
    expect(hashCode("other-secret", IDENTITY, EMAIL, "123456")).not.toBe(base)
  })

  it("ignores the case of the address", () => {
    expect(hashOf("123456", "AMIN@example.com")).toBe(hashOf("123456"))
  })
})

describe("planSend", () => {
  it("sends a first code and remembers it", () => {
    const plan: any = planSend({}, "Amin@Example.com", NOW, "hash")
    expect(plan.ok).toBe(true)
    expect(plan.state.pending).toEqual({
      email: EMAIL,
      code_hash: "hash",
      expires_at: NOW + CODE_TTL_MS,
      attempts: 0,
    })
    expect(plan.state.last_sent_at).toBe(NOW)
    expect(plan.state.send_count).toBe(1)
    expect(plan.state.send_window_start).toBe(NOW)
  })

  it("does not change the state it was given", () => {
    const state = Object.freeze({})
    expect(() => planSend(state, EMAIL, NOW, "hash")).not.toThrow()
  })

  it("refuses when the address is already confirmed", () => {
    const plan: any = planSend({ verified_email: EMAIL }, EMAIL, NOW, "hash")
    expect(plan).toEqual({ ok: false, reason: "already_verified" })
  })

  it("asks for a new confirmation when the customer changed email", () => {
    const plan: any = planSend({ verified_email: "old@example.com" }, EMAIL, NOW, "hash")
    expect(plan.ok).toBe(true)
    expect(plan.state.verified_email).toBe("old@example.com")
  })

  it("waits one minute between two emails", () => {
    const plan: any = planSend(sent(), EMAIL, NOW + 20_000, "hash2")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("too_soon")
    expect(plan.retryAfter).toBe(40)
  })

  it("allows a new code once the pause is over", () => {
    const plan: any = planSend(sent(), EMAIL, NOW + RESEND_COOLDOWN_MS, "hash2")
    expect(plan.ok).toBe(true)
    expect(plan.state.pending.code_hash).toBe("hash2")
    expect(plan.state.send_count).toBe(2)
  })

  it("a new code replaces the old one and resets the tries", () => {
    const old = sent({ pending: { ...sent().pending, attempts: 4 } })
    const plan: any = planSend(old, EMAIL, NOW + RESEND_COOLDOWN_MS, "hash2")
    expect(plan.state.pending.attempts).toBe(0)
    expect(plan.state.pending.code_hash).toBe("hash2")
    expect(plan.state.pending.expires_at).toBe(NOW + RESEND_COOLDOWN_MS + CODE_TTL_MS)
  })

  it("allows 5 emails an hour and then waits for the hour to end", () => {
    let state: any = {}
    let now = NOW
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i++) {
      const plan: any = planSend(state, EMAIL, now, `hash${i}`)
      expect(plan.ok).toBe(true)
      state = plan.state
      now += RESEND_COOLDOWN_MS
    }
    const refused: any = planSend(state, EMAIL, now, "more")
    expect(refused.ok).toBe(false)
    expect(refused.reason).toBe("too_many")
    expect(refused.retryAfter).toBe(Math.ceil((NOW + SEND_WINDOW_MS - now) / 1000))
  })

  it("starts a new hour after the first one ended", () => {
    let state: any = {}
    let now = NOW
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i++) {
      state = (planSend(state, EMAIL, now, `hash${i}`) as any).state
      now += RESEND_COOLDOWN_MS
    }
    const later = NOW + SEND_WINDOW_MS
    const plan: any = planSend(state, EMAIL, later, "fresh")
    expect(plan.ok).toBe(true)
    expect(plan.state.send_count).toBe(1)
    expect(plan.state.send_window_start).toBe(later)
  })

  it("keeps the address of the pending code in lower case", () => {
    const plan: any = planSend({}, "AMIN@EXAMPLE.COM", NOW, "h")
    expect(plan.state.pending.email).toBe(EMAIL)
  })
})

describe("planConfirm", () => {
  it("confirms the right code", () => {
    const plan = confirm(sent(), "123456")
    expect(plan.ok).toBe(true)
    expect(plan.state.verified_email).toBe(EMAIL)
    expect(plan.state.verified_at).toBe(NOW + 1000)
    expect(plan.state.pending).toBe(undefined)
    expect(isVerified(plan.state, EMAIL)).toBe(true)
  })

  it("accepts the code with spaces", () => {
    expect(confirm(sent(), "123 456").ok).toBe(true)
  })

  it("keeps the send limits after confirming", () => {
    const plan = confirm(sent(), "123456")
    expect(plan.state.send_count).toBe(1)
    expect(plan.state.last_sent_at).toBe(NOW)
  })

  it("refuses a wrong code and counts the try", () => {
    const plan = confirm(sent(), "654321")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("wrong_code")
    expect(plan.attemptsLeft).toBe(MAX_ATTEMPTS - 1)
    expect(plan.state.pending.attempts).toBe(1)
    expect(plan.state.verified_email).toBe(undefined)
  })

  it("cancels the code after 5 wrong tries", () => {
    let state = sent()
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const plan = confirm(state, "000000")
      expect(plan.reason).toBe("wrong_code")
      expect(plan.attemptsLeft).toBe(MAX_ATTEMPTS - i)
      state = plan.state
    }
    const last = confirm(state, "000000")
    expect(last.ok).toBe(false)
    expect(last.reason).toBe("too_many_attempts")
    expect(last.state.pending).toBe(undefined)
  })

  it("does not accept the right code after the code was cancelled", () => {
    let state = sent()
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      state = confirm(state, "000000").state
    }
    const plan = confirm(state, "123456")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("no_code")
  })

  it("does not accept the right code once the tries are used up", () => {
    const state = sent()
    state.pending.attempts = MAX_ATTEMPTS
    const plan = confirm(state, "123456")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("too_many_attempts")
    expect(plan.state.pending).toBe(undefined)
  })

  it("accepts the right code on the last try", () => {
    const state = sent()
    state.pending.attempts = MAX_ATTEMPTS - 1
    expect(confirm(state, "123456").ok).toBe(true)
  })

  it("refuses an expired code, even the right one", () => {
    const plan = confirm(sent(), "123456", NOW + CODE_TTL_MS)
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("code_expired")
    expect(plan.state.pending).toBe(undefined)
  })

  it("accepts the code until the last moment", () => {
    expect(confirm(sent(), "123456", NOW + CODE_TTL_MS - 1).ok).toBe(true)
  })

  it("says there is no code when none was asked for", () => {
    const plan = confirm({}, "123456")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("no_code")
  })

  it("does not count a code that is not 6 digits", () => {
    const state = sent()
    const plan = confirm(state, "12ab")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("invalid_format")
    expect(plan.state).toEqual(state)
    expect(confirm(state, undefined).reason).toBe("invalid_format")
  })

  it("a code sent to another address does not work", () => {
    const plan: any = planSend({}, "old@example.com", NOW, hashOf("123456", "old@example.com"))
    const result = confirm(plan.state, "123456", NOW + 1000, EMAIL)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("no_code")
  })

  it("a code made for another account does not work", () => {
    const state: any = (planSend({}, EMAIL, NOW, hashOf("123456", EMAIL, "authid_other")) as any).state
    const result = confirm(state, "123456")
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("wrong_code")
  })

  it("confirming twice is fine", () => {
    const first = confirm(sent(), "123456")
    const second = confirm(first.state, "anything")
    expect(second.ok).toBe(true)
    expect(second.state).toEqual(first.state)
  })

  it("does not change the state it was given", () => {
    const state = sent()
    const copy = JSON.parse(JSON.stringify(state))
    confirm(state, "000000")
    confirm(state, "123456")
    expect(state).toEqual(copy)
  })
})

describe("statusOf", () => {
  it("is empty for a new account", () => {
    expect(statusOf({}, EMAIL, NOW)).toEqual({
      verified: false,
      code_pending: false,
      can_resend_in: 0,
      expires_in: 0,
    })
  })

  it("shows a pending code with its time left and the pause", () => {
    expect(statusOf(sent(), EMAIL, NOW + 10_000)).toEqual({
      verified: false,
      code_pending: true,
      can_resend_in: 50,
      expires_in: Math.ceil((CODE_TTL_MS - 10_000) / 1000),
    })
  })

  it("lets the shopper ask again once the pause is over", () => {
    const status = statusOf(sent(), EMAIL, NOW + RESEND_COOLDOWN_MS)
    expect(status.can_resend_in).toBe(0)
    expect(status.code_pending).toBe(true)
  })

  it("does not show an expired code", () => {
    const status = statusOf(sent(), EMAIL, NOW + CODE_TTL_MS)
    expect(status.code_pending).toBe(false)
    expect(status.expires_in).toBe(0)
  })

  it("does not show a code that was sent to another address", () => {
    expect(statusOf(sent(), "other@example.com", NOW + 1000).code_pending).toBe(false)
  })

  it("is verified for the confirmed address and has nothing to wait for", () => {
    const state = { ...sent(), verified_email: EMAIL }
    expect(statusOf(state, EMAIL, NOW + 1000)).toEqual({
      verified: true,
      code_pending: false,
      can_resend_in: 0,
      expires_in: 0,
    })
  })

  it("is not verified after the email changed", () => {
    expect(statusOf({ verified_email: "old@example.com" }, EMAIL, NOW).verified).toBe(false)
  })

  it("tells how long to wait when the hourly limit is reached", () => {
    let state: any = {}
    let now = NOW
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i++) {
      state = (planSend(state, EMAIL, now, `h${i}`) as any).state
      now += RESEND_COOLDOWN_MS
    }
    const status = statusOf(state, EMAIL, now)
    expect(status.can_resend_in).toBe(Math.ceil((NOW + SEND_WINDOW_MS - now) / 1000))
    expect(status.can_resend_in > 60).toBe(true)
  })
})

describe("createKeyedLock", () => {
  it("runs the tasks of one key one after the other", async () => {
    const run = createKeyedLock()
    const events: string[] = []
    const task = (name: string, ms: number) => async () => {
      events.push(`${name} start`)
      await new Promise((resolve) => setTimeout(resolve, ms))
      events.push(`${name} end`)
      return name
    }

    const results = await Promise.all([run("a", task("1", 20)), run("a", task("2", 1)), run("a", task("3", 1))])

    expect(results).toEqual(["1", "2", "3"])
    expect(events).toEqual(["1 start", "1 end", "2 start", "2 end", "3 start", "3 end"])
  })

  it("does not make different keys wait for each other", async () => {
    const run = createKeyedLock()
    const events: string[] = []
    const slow = run("a", async () => {
      events.push("a start")
      await new Promise((resolve) => setTimeout(resolve, 30))
      events.push("a end")
    })
    const fast = run("b", async () => {
      events.push("b")
    })
    await Promise.all([slow, fast])
    expect(events).toEqual(["a start", "b", "a end"])
  })

  it("goes on after a task failed, and the failure reaches its caller", async () => {
    const run = createKeyedLock()
    const failing = run("a", async () => {
      throw new Error("boom")
    })
    const next = run("a", async () => "ok")

    let error: any = null
    try {
      await failing
    } catch (e) {
      error = e
    }
    expect(error?.message).toBe("boom")
    expect(await next).toBe("ok")
  })

  it("two requests cannot both use the same try", async () => {
    // The read-decide-save sequence as the route does it
    const run = createKeyedLock()
    let saved: any = sent()
    const tryCode = (code: string) =>
      run("id", async () => {
        const state = saved
        await new Promise((resolve) => setTimeout(resolve, 5))
        const plan = confirm(state, code)
        saved = plan.state
        return plan
      })

    const results = await Promise.all(Array.from({ length: 8 }, () => tryCode("000000")))
    expect(results.filter((r) => r.reason === "wrong_code").length).toBe(MAX_ATTEMPTS - 1)
    expect(results.filter((r) => r.reason === "too_many_attempts").length).toBe(1)
    expect(results.filter((r) => r.reason === "no_code").length).toBe(8 - MAX_ATTEMPTS)
  })

  it("forgets keys that are finished", async () => {
    const run = createKeyedLock()
    await run("a", async () => 1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await run("a", async () => 2)).toBe(2)
  })
})
