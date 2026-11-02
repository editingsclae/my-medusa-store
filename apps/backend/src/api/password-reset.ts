// Rules for resetting a shopper's password with a 6 digit code sent by email.
// No framework imports, so the rules can be unit tested on their own.
//
// It uses the same code rules as the email confirmation (15 minutes, 5 wrong
// tries, one email a minute, 5 an hour) with a state of its own, kept in the
// auth identity's app_metadata under another key. A reset code is hashed for a
// different purpose, so a confirmation code can never reset a password.
//
// Nothing here tells a caller whether an email has an account: the routes
// answer the same either way.

import {
  hashCode,
  planConfirm,
  readState,
  type VerificationState,
} from "./email-verification"
import { normalizeEmail } from "./guest-claim"

export const PASSWORD_RESET_METADATA_KEY = "password_reset"
export const PASSWORD_RESET_PURPOSE = "password-reset"

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254

// An email as typed: trimmed, with one @ and a dot in the domain. Anything else
// gives null.
export function parseEmail(input: unknown): string | null {
  if (typeof input !== "string") {
    return null
  }
  const email = input.trim()
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return null
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// The email provider keeps the address exactly as it was typed when the account
// was made and matches it exactly at login. A shopper may type another case
// when asking for a reset, so both the typed and the lower case address are
// looked up.
export function emailCandidates(email: string): string[] {
  return Array.from(new Set([email, normalizeEmail(email)]))
}

export type PasswordCheck =
  | { ok: true; password: string }
  | { ok: false; reason: "not_text" | "too_short" | "too_long" }

// The password is not trimmed: spaces are part of it.
export function checkPassword(input: unknown): PasswordCheck {
  if (typeof input !== "string") {
    return { ok: false, reason: "not_text" }
  }
  if (input.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "too_short" }
  }
  if (input.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: "too_long" }
  }
  return { ok: true, password: input }
}

// Only the identity of a shopper may be reset here. The same email provider also
// holds the logins of the merchant portal (admin users): those carry a user_id
// and must never be reset from a storefront.
export function isResettableIdentity(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== "object" || Array.isArray(appMetadata)) {
    return false
  }
  const meta = appMetadata as Record<string, unknown>
  const customerId = meta.customer_id
  const hasCustomer = typeof customerId === "string" && customerId !== ""
  const hasUser = meta.user_id !== undefined && meta.user_id !== null && meta.user_id !== ""
  return hasCustomer && !hasUser
}

// The login of a merchant portal user (an admin user): it has a user_id and no
// customer. Only these may be reset from the merchant portal, and a shopper
// login must never be.
export function isMerchantLoginIdentity(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== "object" || Array.isArray(appMetadata)) {
    return false
  }
  const meta = appMetadata as Record<string, unknown>
  const userId = meta.user_id
  const hasUser = typeof userId === "string" && userId !== ""
  const customerId = meta.customer_id
  const hasCustomer = customerId !== undefined && customerId !== null && customerId !== ""
  return hasUser && !hasCustomer
}

export type IdentityKind = "shopper" | "merchant"

// Which logins a reset may touch
export function isResettableFor(kind: IdentityKind, appMetadata: unknown): boolean {
  return kind === "merchant"
    ? isMerchantLoginIdentity(appMetadata)
    : isResettableIdentity(appMetadata)
}

export function resetCodeHash(
  secret: string,
  identityId: string,
  email: string,
  code: string
): string {
  return hashCode(secret, identityId, email, code, PASSWORD_RESET_PURPOSE)
}

// The reset state never means "verified": any such field is dropped, so a
// damaged state cannot make a code check pass.
function withoutVerified(state: VerificationState): VerificationState {
  const rest = { ...state }
  delete rest.verified_email
  delete rest.verified_at
  return rest
}

// A state read from the password reset key, cleaned for use here
export function forReset(state: VerificationState): VerificationState {
  return withoutVerified(state)
}

// The password reset state in an identity's app_metadata
export function resetStateOf(appMetadata: unknown): VerificationState {
  return forReset(readState(appMetadata, PASSWORD_RESET_METADATA_KEY))
}

export type ResetConfirm =
  | { ok: true; state: VerificationState }
  | {
      ok: false
      // For the log only: the caller answers the same for every reason
      reason: "invalid_format" | "no_code" | "code_expired" | "wrong_code" | "too_many_attempts"
      state: VerificationState
    }

// Checks the code typed with the new password. A good code is used up (the state
// to save has no pending code); a wrong one is counted.
export function planResetConfirm(
  state: VerificationState,
  email: unknown,
  submitted: unknown,
  now: number,
  hashOf: (code: string) => string
): ResetConfirm {
  const plan = planConfirm(withoutVerified(state), email, submitted, now, hashOf)
  if (plan.ok) {
    return { ok: true, state: withoutVerified(plan.state) }
  }
  return { ok: false, reason: plan.reason, state: withoutVerified(plan.state) }
}

// A reset proves the shopper reads this mailbox, so the email counts as
// confirmed too. Only the email confirmation state changes.
export function markVerifiedByReset(
  state: VerificationState,
  email: unknown,
  now: number
): VerificationState {
  const rest = { ...state }
  delete rest.pending
  return { ...rest, verified_email: normalizeEmail(email), verified_at: now }
}
