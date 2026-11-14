// Reads the merchant's discounts (price lists). Kept out of the route files so a route
// file only exports HTTP methods.
import { discountDescription, readDiscountMetadata } from "./discount-rules"

const PAGE_SIZE = 200
const MAX_PAGES = 50

type PriceListRow = {
  id: string
  title?: string | null
  status?: string | null
  starts_at?: string | Date | null
  ends_at?: string | Date | null
  created_at?: string | Date | null
  metadata?: unknown
}

export function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

// The price lists that belong to this merchant (one per discount)
export async function listMerchantPriceLists(query: any, merchantId: string): Promise<PriceListRow[]> {
  const rows: PriceListRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await query.graph({
      entity: "price_list",
      fields: ["id", "title", "status", "starts_at", "ends_at", "created_at", "metadata"],
      filters: { description: discountDescription(merchantId) },
      pagination: { skip: page * PAGE_SIZE, take: PAGE_SIZE, order: { created_at: "DESC", id: "ASC" } },
    })
    rows.push(...(data as PriceListRow[]))
    if (data.length < PAGE_SIZE) break
  }
  return rows.filter((row) => readDiscountMetadata(row.metadata, merchantId))
}
