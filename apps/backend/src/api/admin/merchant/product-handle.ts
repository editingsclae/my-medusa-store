// The product handle is the product's address in the shop (/p/<handle>). Medusa
// keeps handles unique across ALL merchants, so two merchants that sell a product
// with the same name would collide. These helpers pick a free handle without
// ever showing the merchant an error. No framework imports, so they can be unit
// tested on their own.

const MAX_HANDLE_LENGTH = 80

// "Nova Air Pro!" -> "nova-air-pro". Letters and digits of any language are kept.
export function slugifyHandle(text: unknown): string {
  const slug = String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_HANDLE_LENGTH)
    .replace(/-+$/g, "")
  return slug
}

// The handle the merchant asked for, or one made from the title. Never empty.
export function baseHandle(requested: unknown, title: unknown): string {
  return slugifyHandle(requested) || slugifyHandle(title) || "product"
}

// A short stable tag for a merchant (the end of the sales channel id), used when
// another merchant already has the plain handle.
export function merchantTag(salesChannelId: string | undefined): string {
  const tag = String(salesChannelId ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(-5)
  return tag || "shop"
}

function randomTag(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, "0")
}

// Tries the plain handle first, then "<handle>-<merchant tag>", then numbered
// versions of that, and finally a random tag. `isTaken` says whether a handle is
// already used by any product.
export async function pickAvailableHandle(
  base: string,
  salesChannelId: string | undefined,
  isTaken: (handle: string) => Promise<boolean>
): Promise<string> {
  const tag = merchantTag(salesChannelId)
  const candidates = [base, `${base}-${tag}`]
  for (let n = 2; n <= 20; n++) {
    candidates.push(`${base}-${tag}-${n}`)
  }
  for (const candidate of candidates) {
    if (!(await isTaken(candidate))) {
      return candidate
    }
  }
  return `${base}-${randomTag()}`
}

// Medusa refuses a second product with the same handle with this kind of message.
// It can still happen when two products are created at the very same moment.
export function isHandleTakenError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? "").toLowerCase()
  return message.includes("handle") && message.includes("already exist")
}

export function withRandomTag(handle: string): string {
  return `${handle}-${randomTag()}`
}
