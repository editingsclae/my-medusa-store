import { couponCampaignDescription, couponStatus, readCouponMetadata, type CouponStatus } from "./coupon-rules"

export type CouponView = {
  id: string
  code: string
  kind: "percent" | "fixed"
  value: number
  currency_code: string | null
  starts_at: string | null
  ends_at: string | null
  max_uses: number | null
  used: number
  per_customer: boolean
  min_order: number | null
  status: CouponStatus
}

const PAGE_SIZE = 100
const MAX_PAGES = 50

function toIso(value: unknown): string | null {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// The merchant's coupons: the campaigns that carry their description, with the promotion
// of each. Another merchant's coupon never comes back.
export async function listMerchantCoupons(query: any, merchantId: string, now: Date): Promise<CouponView[]> {
  const rows: any[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await query.graph({
      entity: "campaign",
      fields: [
        "id",
        "starts_at",
        "ends_at",
        "created_at",
        "promotions.id",
        "promotions.code",
        "promotions.limit",
        "promotions.used",
        "promotions.metadata",
        "promotions.application_method.type",
        "promotions.application_method.value",
        "promotions.application_method.currency_code",
      ],
      filters: { description: couponCampaignDescription(merchantId) },
      pagination: { take: PAGE_SIZE, skip: page * PAGE_SIZE, order: { created_at: "DESC" } },
    })
    rows.push(...(data as any[]))
    if ((data as any[]).length < PAGE_SIZE) break
  }

  const coupons: CouponView[] = []
  for (const campaign of rows) {
    for (const promotion of campaign.promotions || []) {
      const meta = readCouponMetadata(promotion.metadata, merchantId)
      if (!meta) continue
      const method = promotion.application_method || {}
      const startsAt = campaign.starts_at ? new Date(campaign.starts_at) : null
      const endsAt = campaign.ends_at ? new Date(campaign.ends_at) : null
      const maxUses = typeof promotion.limit === "number" ? promotion.limit : null
      const used = Number(promotion.used) || 0
      coupons.push({
        id: promotion.id,
        code: promotion.code,
        kind: method.type === "percentage" ? "percent" : "fixed",
        value: Number(method.value),
        currency_code: method.currency_code ?? null,
        starts_at: toIso(campaign.starts_at),
        ends_at: toIso(campaign.ends_at),
        max_uses: maxUses,
        used,
        per_customer: meta.perCustomer,
        min_order: meta.minOrder,
        status: couponStatus(now, startsAt, endsAt, used, maxUses),
      })
    }
  }
  return coupons
}
