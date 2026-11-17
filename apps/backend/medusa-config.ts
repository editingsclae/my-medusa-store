import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // With REDIS_URL, admin/store sessions live in Redis and survive restarts
    // and deploys. Without it Medusa keeps them in memory (fine for local dev).
    redisUrl: process.env.REDIS_URL,
    databaseDriverOptions: process.env.DATABASE_DRIVER_OPTIONS
      ? JSON.parse(process.env.DATABASE_DRIVER_OPTIONS)
      : {
          connection: {
            ssl: false,
          },
        },
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  plugins: [
    {
      resolve: '@agilo/medusa-analytics-plugin',
      options: {},
    },
  ],
  modules: [
    // Redis-backed event bus, cache, workflow engine and locking. They are only
    // registered when REDIS_URL is set, so local development runs without Redis.
    ...(process.env.REDIS_URL
      ? [
          {
            resolve: '@medusajs/medusa/event-bus-redis',
            options: { redisUrl: process.env.REDIS_URL },
          },
          {
            resolve: '@medusajs/medusa/cache-redis',
            options: { redisUrl: process.env.REDIS_URL },
          },
          {
            resolve: '@medusajs/medusa/workflow-engine-redis',
            options: { redis: { url: process.env.REDIS_URL } },
          },
          {
            resolve: '@medusajs/medusa/locking',
            options: {
              providers: [
                {
                  resolve: '@medusajs/medusa/locking-redis',
                  id: 'locking-redis',
                  is_default: true,
                  options: { redisUrl: process.env.REDIS_URL },
                },
              ],
            },
          },
        ]
      : []),
    ...(process.env.S3_BUCKET
      ? [
          {
            resolve: '@medusajs/medusa/file',
            options: {
              providers: [
                {
                  resolve: '@medusajs/medusa/file-s3',
                  id: 's3',
                  options: {
                    file_url: process.env.S3_FILE_URL,
                    access_key_id: process.env.S3_ACCESS_KEY_ID,
                    secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                    region: process.env.S3_REGION || 'auto',
                    bucket: process.env.S3_BUCKET,
                    endpoint: process.env.S3_ENDPOINT,
                    acl: false,
                    additional_client_config: {
                      forcePathStyle: true,
                    },
                  },
                },
              ],
            },
          },
        ]
      : []),
    // Emails through Resend. Without RESEND_API_KEY nothing is registered and no
    // emails are sent, so a local or test setup runs without an account.
    ...(process.env.RESEND_API_KEY
      ? [
          {
            resolve: '@medusajs/medusa/notification',
            options: {
              providers: [
                {
                  resolve: './src/modules/resend',
                  id: 'resend',
                  options: {
                    channels: ['email'],
                    api_key: process.env.RESEND_API_KEY,
                    from: process.env.RESEND_FROM_EMAIL,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
})
