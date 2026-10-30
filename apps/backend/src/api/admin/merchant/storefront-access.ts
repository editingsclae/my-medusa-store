import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  readStoredContent,
  withStorefrontContent,
  type StorefrontContent,
} from "../../storefront-content"

// The stored banners of one sales channel
export async function loadStorefrontContent(
  scope: MedusaContainer,
  salesChannelId: string
): Promise<StorefrontContent> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "metadata"],
    filters: { id: salesChannelId },
  })

  const channel: any = data?.[0]
  if (!channel) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Sales channel ${salesChannelId} was not found`
    )
  }
  return readStoredContent(channel.metadata)
}

// Saves the banners. The rest of the channel's metadata is sent back unchanged,
// so the result is the same whether Medusa merges metadata or replaces it.
export async function saveStorefrontContent(
  scope: MedusaContainer,
  salesChannelId: string,
  content: StorefrontContent
): Promise<void> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "metadata"],
    filters: { id: salesChannelId },
  })

  const channel: any = data?.[0]
  if (!channel) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Sales channel ${salesChannelId} was not found`
    )
  }

  const salesChannels = scope.resolve(Modules.SALES_CHANNEL)
  await salesChannels.updateSalesChannels(salesChannelId, {
    metadata: withStorefrontContent(channel.metadata, content) as any,
  })
}
