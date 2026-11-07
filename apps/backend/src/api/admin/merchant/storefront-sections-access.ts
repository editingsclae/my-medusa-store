import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  readStoredSettings,
  withSettings,
  type SalesLine,
  type SectionSettings,
} from "../../storefront-sections"

async function readChannel(scope: MedusaContainer, salesChannelId: string): Promise<any> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "metadata"],
    filters: { id: salesChannelId },
  })
  const channel: any = data?.[0]
  if (!channel) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Sales channel ${salesChannelId} was not found`)
  }
  return channel
}

// What the merchant chose for the product sections of the home page
export async function loadSectionSettings(scope: MedusaContainer, salesChannelId: string): Promise<SectionSettings> {
  const channel = await readChannel(scope, salesChannelId)
  return readStoredSettings(channel.metadata)
}

export async function saveSectionSettings(
  scope: MedusaContainer,
  salesChannelId: string,
  settings: SectionSettings
): Promise<void> {
  const channel = await readChannel(scope, salesChannelId)
  const salesChannels = scope.resolve(Modules.SALES_CHANNEL)
  await salesChannels.updateSalesChannels(salesChannelId, {
    metadata: withSettings(channel.metadata, settings) as any,
  })
}

// The ids among `ids` that are products of this sales channel (any status): the
// merchant can only feature its own products
export async function ownedProductIds(
  scope: MedusaContainer,
  salesChannelId: string,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  // Typed loosely like the other merchant routes: the link filter is not in the generated types
  const filters: Record<string, any> = { id: ids, sales_channels: { id: salesChannelId } }
  const { data } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters,
  })
  return new Set((data as any[]).map((product) => product.id as string))
}

// The published products of the sales channels, newest first
export async function publishedProductIds(scope: MedusaContainer, salesChannelIds: string[]): Promise<string[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters: Record<string, any> = { status: "published", sales_channels: { id: salesChannelIds } }
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "created_at"],
    filters,
    pagination: { take: 1000, order: { created_at: "DESC" } },
  })
  return (data as any[]).map((product) => product.id as string)
}

// How many of the latest orders are looked at; more than this is not needed to
// tell what sells
const MAX_ORDERS = 2000
const SALES_CACHE_MS = 5 * 60 * 1000
const salesCache = new Map<string, { at: number; lines: SalesLine[] }>()

// What the store sold: one line per product in each order that was not a draft
// or canceled. Kept for a few minutes, because Best Sellers and Trending do not
// need to be live to the second.
export async function loadSalesLines(
  scope: MedusaContainer,
  salesChannelId: string,
  now: number = Date.now()
): Promise<SalesLine[]> {
  const cached = salesCache.get(salesChannelId)
  if (cached && now - cached.at < SALES_CACHE_MS) return cached.lines

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters: Record<string, any> = { sales_channel_id: salesChannelId, status: { $nin: ["draft", "canceled"] } }
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "created_at", "items.product_id", "items.quantity"],
    filters,
    pagination: { take: MAX_ORDERS, order: { created_at: "DESC" } },
  })

  const lines: SalesLine[] = []
  for (const order of data as any[]) {
    for (const item of order.items ?? []) {
      if (item?.product_id) {
        lines.push({ product_id: item.product_id, quantity: Number(item.quantity) || 0, created_at: order.created_at })
      }
    }
  }

  if (salesCache.size > 200) salesCache.clear()
  salesCache.set(salesChannelId, { at: now, lines })
  return lines
}
