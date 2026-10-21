import { defineLink } from "@medusajs/framework/utils"
import SalesChannelModule from "@medusajs/medusa/sales-channel"
import ProductModule from "@medusajs/medusa/product"

// One sales channel (one merchant) owns many product categories, and each
// category belongs to exactly one sales channel. Merchant routes list, check
// and assign categories through this link instead of reading metadata.
export default defineLink(SalesChannelModule.linkable.salesChannel, {
  linkable: ProductModule.linkable.productCategory,
  isList: true,
})
