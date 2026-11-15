import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
  ApplicationMethodType,
  CampaignBudgetType,
  ContainerRegistrationKeys,
  MedusaError,
  PromotionRuleOperator,
  PromotionStatus,
  PromotionType,
} from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"
import { requireSalesChannelId } from "../category-access"
import { listMerchantCoupons } from "../coupon-access"
import { couponCampaignDescription, couponStatus, parseCouponInput, toCouponMetadata } from "../coupon-rules"

// GET /admin/merchant/coupons: the merchant's coupons, newest first
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const coupons = await listMerchantCoupons(query, merchantId, new Date())
  res.json({ coupons, count: coupons.length })
}

// POST /admin/merchant/coupons
// { code, kind: "percent" | "fixed", value, starts_at?, ends_at?, max_uses?, per_customer?, min_order? }
// The coupon takes the given percentage, or the given amount, off the whole order. It works
// only in this merchant's own sales channel, whatever the code.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await getMerchantContext(req)
  const merchantId = requireSalesChannelId(context)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()

  const parsed = parseCouponInput(req.body, now)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }
  const input = parsed.value
  const currency = context.currencyCode.toLowerCase()

  // A code is one word for the whole platform, so a taken one has to be refused
  const { data: taken } = await query.graph({
    entity: "promotion",
    fields: ["id"],
    filters: { code: input.code },
  })
  if ((taken as any[]).length > 0) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `The code ${input.code} is already taken. Choose another one.`
    )
  }

  try {
    const { result } = await createPromotionsWorkflow(req.scope).run({
      input: {
        promotionsData: [
          {
            code: input.code,
            type: PromotionType.STANDARD,
            is_automatic: false,
            status: PromotionStatus.ACTIVE,
            limit: input.maxUses,
            application_method: {
              type: input.kind === "percent" ? ApplicationMethodType.PERCENTAGE : ApplicationMethodType.FIXED,
              target_type: ApplicationMethodTargetType.ORDER,
              allocation: ApplicationMethodAllocation.ACROSS,
              value: input.value,
              currency_code: currency,
            },
            // Only carts of this merchant's own store can use it
            rules: [
              {
                attribute: "sales_channel_id",
                operator: PromotionRuleOperator.EQ,
                values: [merchantId],
              },
            ],
            campaign: {
              name: input.code,
              description: couponCampaignDescription(merchantId),
              campaign_identifier: `${merchantId}:${input.code}:${Date.now().toString(36)}`,
              starts_at: input.startsAt,
              ends_at: input.endsAt,
              budget: input.perCustomer
                ? { type: CampaignBudgetType.USE_BY_ATTRIBUTE, attribute: "customer_id", limit: 1 }
                : null,
            },
            metadata: toCouponMetadata(merchantId, input),
          },
        ],
      },
    })

    const created = (result as any[])?.[0]
    res.status(201).json({
      coupon: {
        id: created?.id,
        code: input.code,
        kind: input.kind,
        value: input.value,
        currency_code: currency,
        starts_at: input.startsAt ? input.startsAt.toISOString() : null,
        ends_at: input.endsAt ? input.endsAt.toISOString() : null,
        max_uses: input.maxUses,
        used: 0,
        per_customer: input.perCustomer,
        min_order: input.minOrder,
        status: couponStatus(now, input.startsAt, input.endsAt, 0, input.maxUses),
      },
    })
  } catch (err) {
    console.error("Failed to create the coupon:", err)
    const message = err instanceof Error ? err.message : ""
    if (/already exists|unique|duplicate/i.test(message)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `The code ${input.code} is already taken. Choose another one.`
      )
    }
    throw err
  }
}
