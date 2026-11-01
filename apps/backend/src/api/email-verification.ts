// Rules for confirming a shopper's email address with a 6 digit code sent by
// email. No framework imports, so the rules can be unit tested on their own.
//
// The state is kept in the metadata of the customer's auth identity, which only
// the server can change. The customer's own metadata cannot be used: a customer
// can write to it from the storefront, so a "verified" flag there could be
// faked.
//
// A code is stored as a keyed hash, never as text. It works for 15 minutes, 5
// wrong tries cancel it, a new one can be asked for once a minute and at most 5
// times an hour.

import { createHmac, randomInt, timingSafeEqual } from "crypto"
import { normalizeEmail } from "./guest-claim"

export const VERIFICATION_METADATA_KEY = "email_verification"

export const CODE_LENGTH = 6
export const CODE_TTL_MS = 15 * 60 * 1000
export const MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_MS = 60 * 1000
export const MAX_SENDS_PER_WINDOW = 5
export const SEND_WINDOW_MS = 60 * 60 * 1000

export type PendingCode = {
  // The address the code was sent to (lower case)
  email: string
  code_hash: string
  // Milliseconds since 1970
  expires_at: number
  attempts: number
}

export type VerificationState = {
  // The address that was confirmed (lower case). The account is verified while
  // this equals the customer's email.
  verified_email?: string
  verified_at?: number
  pending?: PendingCode | null
  last_sent_at?: number
  send_window_start?: number
  send_count?: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

// The state stored in an auth identity's app_metadata under `key` (the email
// confirmation by default; the password reset keeps its own state under another
// key with the same rules). Anything damaged is dropped instead of failing.
export function readState(
  appMetadata: unknown,
  key: string = VERIFICATION_METADATA_KEY
): VerificationState {
  const raw = isObject(appMetadata) ? appMetadata[key] : undefined
  if (!isObject(raw)) {
    return {}
  }

  const state: VerificationState = {}

  if (typeof raw.verified_email === "string" && raw.verified_email !== "") {
    state.verified_email = normalizeEmail(raw.verified_email)
    const at = finiteNumber(raw.verified_at)
    if (at !== undefined) state.verified_at = at
  }

  const lastSent = finiteNumber(raw.last_sent_at)
  if (lastSent !== undefined) state.last_sent_at = lastSent
  const windowStart = finiteNumber(raw.send_window_start)
  if (windowStart !== undefined) state.send_window_start = windowStart
  const sendCount = finiteNumber(raw.send_count)
  if (sendCount !== undefined) state.send_count = sendCount

  const pending = raw.pending
  if (isObject(pending)) {
    const expires = finiteNumber(pending.expires_at)
    const attempts = finiteNumber(pending.attempts)
    if (
      typeof pending.email === "string" &&
      typeof pending.code_hash === "string" &&
      pending.code_hash !== "" &&
      expires !== undefined &&
      attempts !== undefined
    ) {
      state.pending = {
        email: normalizeEmail(pending.email),
        code_hash: pending.code_hash,
        expires_at: expires,
        attempts,
      }
    }
  }

  return state
}

// The app_metadata to save: everything that was there stays (the link to the
// customer is in it), only the verification key changes.
export function writeState(
  appMetadata: unknown,
  state: VerificationState,
  key: string = VERIFICATION_METADATA_KEY
): Record<string, unknown> {
  const current = isObject(appMetadata) ? appMetadata : {}
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined && value !== null) {
      clean[key] = value
    }
  }
  return { ...current, [key]: clean }
}

export function isVerified(state: VerificationState, email: unknown): boolean {
  const normalized = normalizeEmail(email)
  return normalized !== "" && state.verified_email === normalized
}

// -------------------------------------------------------------
// Codes
// -------------------------------------------------------------

export function generateCode(random: (min: number, max: number) => number = randomInt): string {
  return String(random(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0")
}

// What shoppers type: digits, maybe with spaces or dashes ("123 456"). Anything
// that is not exactly 6 digits gives null.
export function parseCode(input: unknown): string | null {
  if (typeof input !== "string") {
    return null
  }
  const code = input.replace(/[\s-]/g, "")
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) ? code : null
}

// The hash is tied to the identity, the address and what the code is for, so a
// code cannot be used for another account, another address or another purpose
// (a confirmation code never works as a password reset code).
export function hashCode(
  secret: string,
  identityId: string,
  email: string,
  code: string,
  purpose: string = "email-verification"
): string {
  return createHmac("sha256", secret)
    .update(`${purpose}|${identityId}|${normalizeEmail(email)}|${code}`)
    .digest("hex")
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  return left.length === right.length && timingSafeEqual(left, right)
}

// -------------------------------------------------------------
// Status
// -------------------------------------------------------------

export type VerificationStatus = {
  verified: boolean
  // A code was sent and can still be used
  code_pending: boolean
  // Seconds until a new code can be asked for (0: now)
  can_resend_in: number
  // Seconds the pending code still works (0: none)
  expires_in: number
}

function seconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000))
}

// How long until a new code may be asked for: the one minute pause between two
// emails, and the limit of 5 emails an hour.
function waitBeforeNextSend(state: VerificationState, now: number): number {
  let wait = 0

  if (state.last_sent_at !== undefined) {
    wait = Math.max(wait, state.last_sent_at + RESEND_COOLDOWN_MS - now)
  }

  const start = state.send_window_start
  const inWindow = start !== undefined && now - start < SEND_WINDOW_MS
  if (inWindow && (state.send_count ?? 0) >= MAX_SENDS_PER_WINDOW) {
    wait = Math.max(wait, (start as number) + SEND_WINDOW_MS - now)
  }

  return seconds(wait)
}

export function statusOf(state: VerificationState, email: unknown, now: number): VerificationStatus {
  const normalized = normalizeEmail(email)
  const verified = isVerified(state, normalized)
  const pending = state.pending
  const live = !!pending && pending.email === normalized && pending.expires_at > now

  return {
    verified,
    code_pending: !verified && live,
    can_resend_in: verified ? 0 : waitBeforeNextSend(state, now),
    expires_in: !verified && live ? seconds((pending as PendingCode).expires_at - now) : 0,
  }
}

// -------------------------------------------------------------
// Sending a code
// -------------------------------------------------------------

export type SendPlan =
  | { ok: true; state: VerificationState }
  | { ok: false; reason: "already_verified" }
  | { ok: false; reason: "too_soon" | "too_many"; retryAfter: number }

// Decides whether a code may be sent now and gives the state to save once the
// email is really sent. A new code replaces the one before it.
export function planSend(
  state: VerificationState,
  email: unknown,
  now: number,
  codeHash: string
): SendPlan {
  const normalized = normalizeEmail(email)

  if (isVerified(state, normalized)) {
    return { ok: false, reason: "already_verified" }
  }

  if (state.last_sent_at !== undefined && now - state.last_sent_at < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: "too_soon", retryAfter: waitBeforeNextSend(state, now) }
  }

  let windowStart = state.send_window_start
  let count = state.send_count ?? 0
  if (windowStart === undefined || now - windowStart >= SEND_WINDOW_MS) {
    windowStart = now
    count = 0
  }
  if (count >= MAX_SENDS_PER_WINDOW) {
    return {
      ok: false,
      reason: "too_many",
      retryAfter: seconds(windowStart + SEND_WINDOW_MS - now),
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      pending: {
        email: normalized,
        code_hash: codeHash,
        expires_at: now + CODE_TTL_MS,
        attempts: 0,
      },
      last_sent_at: now,
      send_window_start: windowStart,
      send_count: count + 1,
    },
  }
}

// -------------------------------------------------------------
// Confirming a code
// -------------------------------------------------------------

export type ConfirmPlan =
  | { ok: true; state: VerificationState }
  | {
      ok: false
      reason: "invalid_format" | "no_code" | "code_expired" | "wrong_code" | "too_many_attempts"
      // The state to save (a wrong try is counted, a spent code is removed)
      state: VerificationState
      attemptsLeft?: number
    }

function withoutPending(state: VerificationState): VerificationState {
  const rest = { ...state }
  delete rest.pending
  return rest
}

// Checks the code a shopper typed. `hashOf` gives the hash of a code for this
// identity and address.
export function planConfirm(
  state: VerificationState,
  email: unknown,
  submitted: unknown,
  now: number,
  hashOf: (code: string) => string
): ConfirmPlan {
  const normalized = normalizeEmail(email)

  // Confirming twice is fine
  if (isVerified(state, normalized)) {
    return { ok: true, state }
  }

  const code = parseCode(submitted)
  if (!code) {
    // Not a guess, so it does not use a try
    return { ok: false, reason: "invalid_format", state }
  }

  const pending = state.pending
  if (!pending || pending.email !== normalized) {
    return { ok: false, reason: "no_code", state }
  }

  if (pending.expires_at <= now) {
    return { ok: false, reason: "code_expired", state: withoutPending(state) }
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts", state: withoutPending(state) }
  }

  if (sameHash(pending.code_hash, hashOf(code))) {
    return {
      ok: true,
      state: { ...withoutPending(state), verified_email: normalized, verified_at: now },
    }
  }

  const attempts = pending.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts", state: withoutPending(state) }
  }
  return {
    ok: false,
    reason: "wrong_code",
    state: { ...state, pending: { ...pending, attempts } },
    attemptsLeft: MAX_ATTEMPTS - attempts,
  }
}

// -------------------------------------------------------------
// One request at a time per account
// -------------------------------------------------------------

// Runs tasks with the same key one after the other. Without it two requests at
// the same moment would both read "0 tries used" and could try many codes at
// once, or both send an email. It covers one server process.
export function createKeyedLock() {
  const tails = new Map<string, Promise<unknown>>()

  return function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve()
    const result = previous.then(task, task)
    const tail = result.catch(() => undefined)
    tails.set(key, tail)
    void tail.then(() => {
      if (tails.get(key) === tail) {
        tails.delete(key)
      }
    })
    return result
  }
}
