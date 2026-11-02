// The readable text of whatever was thrown. Medusa workflows can throw a plain
// object that has a `message` instead of an Error, and String() of that gives
// "[object Object]", which hides the real reason in logs and in answers.
// No framework imports, so it can be unit tested on its own.

export function errorText(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === "string") {
    return err
  }
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string" && message !== "") {
      return message
    }
    try {
      const json = JSON.stringify(err)
      if (json && json !== "{}") {
        return json
      }
    } catch {
      // not serializable, fall through
    }
    return "unknown error"
  }
  return String(err)
}
