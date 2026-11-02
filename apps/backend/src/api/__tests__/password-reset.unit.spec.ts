import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  VERIFICATION_METADATA_KEY,
  hashCode,
  isVerified,
  planSend,
  readState,
  writeState,
} from "../email-verification"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_METADATA_KEY,
  checkPassword,
  emailCandidates,
  forReset,
  isMerchantLoginIdentity,
  isResettableFor,
  isResettableIdentity,
  markVerifiedByReset,
  parseEmail,
  planResetConfirm,
  resetCodeHash,
  resetStateOf,
} from "../password-reset"

const SECRET = "test-secret"
const IDENTITY = "authid_1"
const EMAIL = "amin@example.com"
const NOW = 1_700_000_000_000

function hashOf(code: string, email = EMAIL, identity = IDENTITY) {
  return resetCodeHash(SECRET, identity, email, code)
}

// A reset state with the code "123456" sent at NOW
function sent(extra: Record<string, unknown> = {}) {
  const plan: any = planSend({}, EMAIL, NOW, hashOf("123456"))
  return { ...plan.state, ...extra }
}

function confirm(state: any, submitted: unknown, now = NOW + 1000, email = EMAIL): any {
  return planResetConfirm(state, email, submitted, now, (code) => hashOf(code, email))
}

describe("parseEmail", () => {
  it("accepts an email address and trims it", () => {
    expect(parseEmail("amin@example.com")).toBe("amin@example.com")
    expect(parseEmail("  Amin@Example.com  ")).toBe("Amin@Example.com")
  })

  it("refuses anything that is not an email address", () => {
    for (const bad of ["", "   ", "amin", "amin@", "@example.com", "amin@example", "a b@example.com", "a@@example.com", 5, null, undefined, {}]) {
      expect(parseEmail(bad)).toBe(null)
    }
  })

  it("refuses a very long address", () => {
    expect(parseEmail("a".repeat(250) + "@example.com")).toBe(null)
  })
})

describe("emailCandidates", () => {
  it("gives the typed address and the lower case one", () => {
    expect(emailCandidates("Amin@Example.com")).toEqual(["Amin@Example.com", "amin@example.com"])
  })

  it("gives one address when both are the same", () => {
    expect(emailCandidates("amin@example.com")).toEqual(["amin@example.com"])
  })
})

describe("checkPassword", () => {
  it("accepts a password of the right length, spaces included", () => {
    const check: any = checkPassword("  secret pass  ")
    expect(check.ok).toBe(true)
    expect(check.password).toBe("  secret pass  ")
  })

  it("refuses a short password", () => {
    expect(checkPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toEqual({ ok: false, reason: "too_short" })
    expect(checkPassword("a".repeat(MIN_PASSWORD_LENGTH)).ok).toBe(true)
  })

  it("refuses a very long password", () => {
    expect(checkPassword("a".repeat(MAX_PASSWORD_LENGTH + 1))).toEqual({ ok: false, reason: "too_long" })
    expect(checkPassword("a".repeat(MAX_PASSWORD_LENGTH)).ok).toBe(true)
  })

  it("refuses what is not text", () => {
    for (const bad of [undefined, null, 12345678, {}, ["abcdefgh"]]) {
      expect(checkPassword(bad)).toEqual({ ok: false, reason: "not_text" })
    }
  })
})

describe("isResettableIdentity", () => {
  it("is true for a shopper identity", () => {
    expect(isResettableIdentity({ customer_id: "cus_1" })).toBe(true)
    expect(isResettableIdentity({ customer_id: "cus_1", [VERIFICATION_METADATA_KEY]: {} })).toBe(true)
  })

  it("is false for a merchant (admin) identity", () => {
    expect(isResettableIdentity({ user_id: "user_1" })).toBe(false)
  })

  it("is false when the identity is both, so an admin login is never reset here", () => {
    expect(isResettableIdentity({ customer_id: "cus_1", user_id: "user_1" })).toBe(false)
  })

  it("is false without a customer", () => {
    for (const meta of [{}, null, undefined, "x", [], { customer_id: "" }, { customer_id: 5 }]) {
      expect(isResettableIdentity(meta)).toBe(false)
    }
  })
})

describe("resetCodeHash", () => {
  it("is not the hash of an email confirmation code", () => {
    expect(resetCodeHash(SECRET, IDENTITY, EMAIL, "123456")).not.toBe(hashCode(SECRET, IDENTITY, EMAIL, "123456"))
  })

  it("changes with the account, the address and the code", () => {
    const base = hashOf("123456")
    expect(hashOf("123457")).not.toBe(base)
    expect(hashOf("123456", EMAIL, "authid_2")).not.toBe(base)
    expect(hashOf("123456", "other@example.com")).not.toBe(base)
    expect(hashOf("123456", "AMIN@example.com")).toBe(base)
  })
})

describe("reset state is kept apart from the email confirmation", () => {
  it("is read and written under its own key", () => {
    const meta = writeState({ customer_id: "cus_1" }, sent(), PASSWORD_RESET_METADATA_KEY) as any
    expect(meta.customer_id).toBe("cus_1")
    expect(meta[PASSWORD_RESET_METADATA_KEY].pending.email).toBe(EMAIL)
    expect(meta[VERIFICATION_METADATA_KEY]).toBe(undefined)
    expect(readState(meta)).toEqual({})
    expect(resetStateOf(meta).pending?.email).toBe(EMAIL)
  })

  it("saving one state keeps the other", () => {
    const first = writeState({ customer_id: "cus_1" }, { verified_email: EMAIL }, VERIFICATION_METADATA_KEY)
    const second: any = writeState(first, sent(), PASSWORD_RESET_METADATA_KEY)
    expect(readState(second).verified_email).toBe(EMAIL)
    expect(resetStateOf(second).pending?.email).toBe(EMAIL)
    const third: any = writeState(second, { verified_email: EMAIL, verified_at: NOW }, VERIFICATION_METADATA_KEY)
    expect(resetStateOf(third).pending?.email).toBe(EMAIL)
  })

  it("never counts as verified, even when damaged", () => {
    const damaged = { ...sent(), verified_email: EMAIL, verified_at: NOW }
    const clean = forReset(damaged)
    expect(clean.verified_email).toBe(undefined)
    expect(clean.verified_at).toBe(undefined)
    expect(clean.pending?.email).toBe(EMAIL)
    const meta = { [PASSWORD_RESET_METADATA_KEY]: damaged }
    expect(resetStateOf(meta).verified_email).toBe(undefined)
  })
})

describe("reset code sending uses the shared limits", () => {
  it("waits a minute between two emails", () => {
    const plan: any = planSend(forReset(sent()), EMAIL, NOW + 10_000, hashOf("654321"))
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("too_soon")
    expect(planSend(forReset(sent()), EMAIL, NOW + RESEND_COOLDOWN_MS, hashOf("654321")).ok).toBe(true)
  })

  it("a damaged verified field does not stop a code from being sent", () => {
    const damaged = forReset({ verified_email: EMAIL } as any)
    expect(planSend(damaged, EMAIL, NOW, "h").ok).toBe(true)
  })
})

describe("planResetConfirm", () => {
  it("accepts the right code and uses it up", () => {
    const plan = confirm(sent(), "123456")
    expect(plan.ok).toBe(true)
    expect(plan.state.pending).toBe(undefined)
    expect(plan.state.verified_email).toBe(undefined)
    expect(plan.state.last_sent_at).toBe(NOW)
  })

  it("the same code does not work a second time", () => {
    const first = confirm(sent(), "123456")
    const second = confirm(first.state, "123456")
    expect(second.ok).toBe(false)
    expect(second.reason).toBe("no_code")
  })

  it("accepts the code with spaces", () => {
    expect(confirm(sent(), "123 456").ok).toBe(true)
  })

  it("refuses a wrong code and counts the try", () => {
    const plan = confirm(sent(), "654321")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("wrong_code")
    expect(plan.state.pending.attempts).toBe(1)
  })

  it("cancels the code after 5 wrong tries, even for the right code after that", () => {
    let state = sent()
    let last: any
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      last = confirm(state, "000000")
      state = last.state
    }
    expect(last.reason).toBe("too_many_attempts")
    expect(state.pending).toBe(undefined)
    expect(confirm(state, "123456").ok).toBe(false)
  })

  it("refuses an expired code", () => {
    const plan = confirm(sent(), "123456", NOW + CODE_TTL_MS)
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("code_expired")
  })

  it("refuses a code that is not 6 digits without counting it", () => {
    const state = sent()
    const plan = confirm(state, "12ab")
    expect(plan.ok).toBe(false)
    expect(plan.reason).toBe("invalid_format")
    expect(plan.state.pending.attempts).toBe(0)
  })

  it("refuses when no code was asked for", () => {
    expect(confirm({}, "123456").reason).toBe("no_code")
  })

  it("does not work with an email confirmation code", () => {
    const plan: any = planSend({}, EMAIL, NOW, hashCode(SECRET, IDENTITY, EMAIL, "123456"))
    const result = confirm(plan.state, "123456")
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("wrong_code")
  })

  it("does not work for another account's code", () => {
    const plan: any = planSend({}, EMAIL, NOW, hashOf("123456", EMAIL, "authid_other"))
    expect(confirm(plan.state, "123456").ok).toBe(false)
  })

  it("does not trust a verified field in the state", () => {
    const damaged = { ...sent(), verified_email: EMAIL }
    expect(confirm(damaged, "000000").ok).toBe(false)
    expect(confirm(damaged, undefined).ok).toBe(false)
    const ok = confirm(damaged, "123456")
    expect(ok.ok).toBe(true)
    expect(ok.state.verified_email).toBe(undefined)
  })

  it("does not change the state it was given", () => {
    const state = sent()
    const copy = JSON.parse(JSON.stringify(state))
    confirm(state, "000000")
    confirm(state, "123456")
    expect(state).toEqual(copy)
  })
})

describe("markVerifiedByReset", () => {
  it("confirms the email and drops a waiting confirmation code", () => {
    const state = { ...sent(), last_sent_at: NOW, send_count: 2 }
    const marked = markVerifiedByReset(state, "Amin@Example.com", NOW + 5)
    expect(marked.verified_email).toBe(EMAIL)
    expect(marked.verified_at).toBe(NOW + 5)
    expect(marked.pending).toBe(undefined)
    expect(marked.send_count).toBe(2)
    expect(isVerified(marked, EMAIL)).toBe(true)
  })

  it("does not change the state it was given", () => {
    const state = sent()
    markVerifiedByReset(state, EMAIL, NOW)
    expect(state.pending === undefined).toBe(false)
  })
})

describe("merchant logins", () => {
  it("recognises a merchant portal login by its user and no customer", () => {
    expect(isMerchantLoginIdentity({ user_id: "user_1" })).toBe(true)
    expect(isMerchantLoginIdentity({ user_id: "user_1", password_reset: {} })).toBe(true)
  })

  it("refuses shopper logins, empty ids and non objects", () => {
    expect(isMerchantLoginIdentity({ customer_id: "cus_1" })).toBe(false)
    expect(isMerchantLoginIdentity({ user_id: "user_1", customer_id: "cus_1" })).toBe(false)
    expect(isMerchantLoginIdentity({ user_id: "" })).toBe(false)
    expect(isMerchantLoginIdentity({})).toBe(false)
    expect(isMerchantLoginIdentity(null)).toBe(false)
    expect(isMerchantLoginIdentity(["user_1"])).toBe(false)
  })

  it("keeps the two kinds apart", () => {
    const shopper = { customer_id: "cus_1" }
    const merchant = { user_id: "user_1" }
    expect(isResettableFor("shopper", shopper)).toBe(true)
    expect(isResettableFor("shopper", merchant)).toBe(false)
    expect(isResettableFor("merchant", merchant)).toBe(true)
    expect(isResettableFor("merchant", shopper)).toBe(false)
  })
})
