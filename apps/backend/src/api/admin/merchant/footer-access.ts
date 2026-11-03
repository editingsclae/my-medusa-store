import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { readStoredFooter, withFooter, type FooterContent } from "../../footer-content"

async function loadChannel(scope: MedusaContainer, salesChannelId: string) {
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
  return channel
}

// The stored footer of one sales channel
export async function loadFooter(
  scope: MedusaContainer,
  salesChannelId: string
): Promise<FooterContent> {
  const channel = await loadChannel(scope, salesChannelId)
  return readStoredFooter(channel.metadata)
}

// Saves the footer. The rest of the channel's metadata (the banners, for one) is
// sent back unchanged, so the result is the same whether Medusa merges metadata
// or replaces it.
export async function saveFooter(
  scope: MedusaContainer,
  salesChannelId: string,
  content: FooterContent
): Promise<void> {
  const channel = await loadChannel(scope, salesChannelId)
  const salesChannels = scope.resolve(Modules.SALES_CHANNEL)
  await salesChannels.updateSalesChannels(salesChannelId, {
    metadata: withFooter(channel.metadata, content) as any,
  })
}
