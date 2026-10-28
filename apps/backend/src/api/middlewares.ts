import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import multer from 'multer'
import { blockMerchantsFromCoreAdmin } from './merchant-guard'
import { restrictStoreOrderToKey, scopeStoreOrdersToKey } from './store-order-scope'

const upload = multer({ storage: multer.memoryStorage() })

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      // Merchants log in as admin users; keep them off every core /admin route
      // except /admin/merchant/*. authenticate() is repeated here with
      // allowUnauthenticated so auth_context is populated before the guard runs
      // without changing which routes are public (core still enforces auth).
      matcher: '/admin/*',
      middlewares: [
        authenticate('user', ['session', 'bearer', 'api-key'], {
          allowUnauthenticated: true,
        }),
        blockMerchantsFromCoreAdmin,
      ],
    },
    {
      // Customers are shared by every merchant, but a storefront may only see
      // the orders of the merchant its publishable key belongs to
      method: ['GET'],
      matcher: '/store/orders',
      middlewares: [scopeStoreOrdersToKey],
    },
    {
      method: ['GET'],
      matcher: '/store/orders/:id',
      middlewares: [restrictStoreOrderToKey],
    },
    {
      // Moving a guest's earlier orders to the logged-in account
      method: ['POST'],
      matcher: '/store/merchant/claim-orders',
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    {
      method: ['POST'],
      matcher: '/admin/merchant/upload',
      middlewares: [
        upload.any(),
      ],
    },
  ],
})
