export type Bindings = {
  DB: D1Database
  JWT_SECRET: string

  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string

  FACEBOOK_APP_ID: string
  FACEBOOK_APP_SECRET: string
  FACEBOOK_GRAPH_VERSION?: string;

  API_BASE_URL: string
  FRONTEND_URL: string
}