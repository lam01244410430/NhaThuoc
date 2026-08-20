import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './src/types'
import type { AppEnv } from './src/middlewares/auth'
import { errorHandler } from './src/middlewares/error-handler'

import auth from './src/routers/auth'
import shops from './src/routers/shops'
import products from './src/routers/products'
import orders from './src/routers/orders'
import admin from './src/routers/admin'
import cart from './src/routers/cart'
import categories from './src/routers/categories'
import addresses from './src/routers/addresses'
import reviews from './src/routers/reviews'
import users from './src/routers/users'

type Env = AppEnv & {
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

app.onError(errorHandler)

app.get('/', (c) => c.json({ success: true, message: 'NhaThuoc API' }))
app.route('/auth', auth)
app.route('/shop', shops)
app.route('/product', products)
app.route('/orders', orders)
app.route('/admin', admin)
app.route('/cart', cart)
app.route('/category', categories)
app.route('/address', addresses)
app.route('/review', reviews)
app.route('/user', users)

export default app