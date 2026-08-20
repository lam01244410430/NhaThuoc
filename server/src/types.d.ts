export type Bindings = {
  DB: D1Database
  PRODUCT_MEDIA: R2Bucket
  JWT_SECRET: string

  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string

  FACEBOOK_APP_ID: string
  FACEBOOK_APP_SECRET: string
  FACEBOOK_GRAPH_VERSION?: string

  API_BASE_URL: string
  FRONTEND_URL: string

  RESEND_API_KEY: string
  RESEND_FROM_EMAIL: string

  OTP_DEV_MODE?: string
}
