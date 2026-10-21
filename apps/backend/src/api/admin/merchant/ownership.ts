// Pure helpers used by the merchant routes to check that IDs sent in a request
// body belong to the resource the merchant already proved ownership of. They
// have no framework imports so they can be unit tested on their own.

export type AddressLike = Record<string, any>

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
  "phone",
] as const

// Returns every requested value that is not in the allowed set. A value that
// is not a string is always reported, so a malformed body can never pass.
export function findForeignIds(
  requested: unknown[],
  allowed: Iterable<string>
): unknown[] {
  const allowedSet = new Set(allowed)

  return requested.filter(
    (id) => typeof id !== "string" || !allowedSet.has(id)
  )
}

// Customers are global in Medusa, so customer.addresses can hold addresses
// saved while buying from another merchant. A merchant only gets the addresses
// that appear on orders in its own sales channel, de-duplicated.
export function uniqueAddresses(
  addresses: (AddressLike | null | undefined)[]
): AddressLike[] {
  const seen = new Set<string>()
  const result: AddressLike[] = []

  for (const address of addresses) {
    if (!address) {
      continue
    }

    const key = ADDRESS_FIELDS.map((field) =>
      String(address[field] ?? "").trim().toLowerCase()
    ).join("|")

    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    const picked: AddressLike = { id: address.id }
    for (const field of ADDRESS_FIELDS) {
      picked[field] = address[field] ?? null
    }
    result.push(picked)
  }

  return result
}
