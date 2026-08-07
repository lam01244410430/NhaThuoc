import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './src/routers/auth'
import shops from './src/routers/shops'
import products from './src/routers/products'
import type { Bindings } from './src/types'

type Env = {
  Bindings: Bindings
}

const app = new Hono<Env>()

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const configuredOrigin = c.env.FRONTEND_URL?.replace(/\/+$/, '')
      const allowedOrigins = new Set([
        configuredOrigin,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ])

      return allowedOrigins.has(origin) ? origin : configuredOrigin || ''
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
)

app.get('/', (c) => c.json({ success: true, message: 'NhaThuoc API' }))
app.route('/auth', auth)
app.route('/shop', shops)
app.route('/product', products)

export default app