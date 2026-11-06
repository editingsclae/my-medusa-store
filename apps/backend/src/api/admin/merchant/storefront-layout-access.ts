import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  hasLayoutKey,
  readStoredLayout,
  withLayout,
  withLayoutKeyHash,
  type StorefrontLayout,
} from "../../storefront-layout"

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

// The layout of one sales channel, and whether a layout key was created for it
export async function loadLayout(
  scope: MedusaContainer,
  salesChannelId: string
): Promise<{ layout: StorefrontLayout; keySet: boolean; metadata: unknown }> {
  const channel = await readChannel(scope, salesChannelId)
  return { layout: readStoredLayout(channel.metadata), keySet: hasLayoutKey(channel.metadata), metadata: channel.metadata }
}

export async function saveLayout(scope: MedusaContainer, salesChannelId: string, layout: StorefrontLayout): Promise<void> {
  const channel = await readChannel(scope, salesChannelId)
  const salesChannels = scope.resolve(Modules.SALES_CHANNEL)
  await salesChannels.updateSalesChannels(salesChannelId, { metadata: withLayout(channel.metadata, layout) as any })
}

export async function saveLayoutKeyHash(scope: MedusaContainer, salesChannelId: string, hash: string): Promise<void> {
  const channel = await readChannel(scope, salesChannelId)
  const salesChannels = scope.resolve(Modules.SALES_CHANNEL)
  await salesChannels.updateSalesChannels(salesChannelId, { metadata: withLayoutKeyHash(channel.metadata, hash) as any })
}
