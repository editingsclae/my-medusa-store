// The steps of a password reset by 6 digit code, for shoppers and for merchant
// portal users alike. No framework imports: everything that touches the database
// or sends an email comes in through `ResetOps`, so the rules (what is counted,
// what is used up, what is never revealed) can be unit tested with fakes.
//
// Nothing here tells a caller whether an email has an account: a request is
// answered the same either way, and every code failure looks the same.

import { generateCode, planSend, type VerificationState } from "./email-verification"
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  checkPassword,
  emailCandidates,
  forReset,
  parseEmail,
  planResetConfirm,
} from "./password-reset"
import { errorText } from "./error-text"

export type ResetTarget = {
  identityId: string
  // The address as the email provider stores it
  entityId: string
}

export type ResetOps = {
  // The login of the right kind for one of the addresses, or null
  find(emails: string[]): Promise<ResetTarget | null>
  // One job at a time per login
  lock<T>(identityId: string, job: () => Promise<T>): Promise<T>
  loadState(identityId: string): Promise<VerificationState>
  saveState(identityId: string, state: VerificationState): Promise<void>
  // Throws when the email was not sent
  sendEmail(target: ResetTarget, code: string): Promise<void>
  setPassword(entityId: string, password: string): Promise<{ success: boolean; error?: string }>
  // Runs after a successful reset (shoppers: the email counts as confirmed)
  afterReset?(target: ResetTarget, now: number): Promise<void>
  hash(identityId: string, entityId: string, code: string): string
  now(): number
  newCode?(): string
  log(message: string): void
}

export type RequestOutcome = {
  outcome: "invalid_email" | "accepted"
  // Settles when the email job is over. The caller does not wait for it (so the
  // answer does not show who has an account); tests do.
  done: Promise<void>
}

// Emails a code, unless the login asked for one a moment ago or too many times
// (then nothing is sent and nothing is said). The state is saved only when the
// email was really sent.
async function sendCode(ops: ResetOps, target: ResetTarget): Promise<void> {
  await ops.lock(target.identityId, async () => {
    const state = forReset(await ops.loadState(target.identityId))
    const now = ops.now()
    const code = (ops.newCode ?? generateCode)()
    const plan = planSend(state, target.entityId, now, ops.hash(target.identityId, target.entityId, code))
    if (!plan.ok) {
      return
    }
    await ops.sendEmail(target, code)
    await ops.saveState(target.identityId, plan.state)
  })
}

export async function requestReset(ops: ResetOps, emailInput: unknown): Promise<RequestOutcome> {
  const email = parseEmail(emailInput)
  if (!email) {
    return { outcome: "invalid_email", done: Promise.resolve() }
  }

  const target = await ops.find(emailCandidates(email))
  if (!target) {
    return { outcome: "accepted", done: Promise.resolve() }
  }

  const done = sendCode(ops, target).catch((err) => {
    ops.log(`Password reset code for identity ${target.identityId} was not sent: ${errorText(err)}`)
  })
  return { outcome: "accepted", done }
}

export type ConfirmOutcome =
  | { status: "weak_password"; message: string }
  // Same for an unknown email, no code, a wrong code, an expired code and too
  // many tries
  | { status: "invalid_code" }
  | { status: "failed" }
  | { status: "reset"; email: string }

export function weakPasswordMessage(reason: "not_text" | "too_short" | "too_long"): string {
  return reason === "too_long"
    ? `The password can have at most ${MAX_PASSWORD_LENGTH} characters.`
    : `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
}

export async function confirmReset(
  ops: ResetOps,
  input: { email?: unknown; code?: unknown; password?: unknown }
): Promise<ConfirmOutcome> {
  // The password is checked first and nothing is counted for a weak one
  const password = checkPassword(input.password)
  if (!password.ok) {
    return { status: "weak_password", message: weakPasswordMessage(password.reason) }
  }

  const email = parseEmail(input.email)
  if (!email) {
    return { status: "invalid_code" }
  }

  const target = await ops.find(emailCandidates(email))
  if (!target) {
    return { status: "invalid_code" }
  }

  return ops.lock(target.identityId, async (): Promise<ConfirmOutcome> => {
    const state = forReset(await ops.loadState(target.identityId))
    const now = ops.now()

    const plan = planResetConfirm(state, target.entityId, input.code, now, (code) =>
      ops.hash(target.identityId, target.entityId, code)
    )

    // A try that was counted, or a code that is used up, is saved before
    // anything else, so a code can only be used once
    if (plan.ok || (plan.reason !== "invalid_format" && plan.reason !== "no_code")) {
      await ops.saveState(target.identityId, plan.state)
    }

    if (!plan.ok) {
      return { status: "invalid_code" }
    }

    const result = await ops.setPassword(target.entityId, password.password)
    if (!result.success) {
      ops.log(
        `Password reset for identity ${target.identityId} failed: ${result.error ?? "unknown error"}`
      )
      return { status: "failed" }
    }

    if (ops.afterReset) {
      await ops.afterReset(target, now)
    }

    return { status: "reset", email: target.entityId }
  })
}
