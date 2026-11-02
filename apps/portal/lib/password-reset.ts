// Small rules for the password reset screens. No imports, so they can be tested
// on their own.

export const CODE_LENGTH = 6
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

// The code as typed or pasted: digits only, at most 6. Spaces and dashes in a
// pasted "123 456" are dropped.
export function cleanCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, CODE_LENGTH)
}

export function isCompleteCode(input: string): boolean {
  return cleanCode(input).length === CODE_LENGTH
}

// Returns a message for the merchant, or null when the new password is fine.
// The password is not trimmed: spaces are part of it.
export function checkNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `The password can have at most ${MAX_PASSWORD_LENGTH} characters.`
  }
  if (password !== confirm) {
    return "The two passwords do not match."
  }
  return null
}

// A browser that cannot reach the server throws a TypeError with a message that
// means nothing to a merchant.
export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) {
    return "Could not reach the server. Check your connection and try again."
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}
