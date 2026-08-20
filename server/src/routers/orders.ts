import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../types'
import {
  orderIdParamSchema,
  shopOrderListQuerySchema,
} from '../validators/order.validator'

type UserRole =
  | 'customer'
  | 'shop'
  | 'admin'

type AppEnv = {
  Bindings: Bindings
  Variables: {
    jwtPayload: JwtPayload
  }
}

interface JwtPayload {
  sub: string
  role: UserRole
  email: string
  name: string
  iat?: number
  exp?: number
}

interface UserRecord {
  id: number
  role: UserRole
  status:
    | 'pending'
    | 'active'
    | 'blocked'
    | 'deleted'
}

interface CountRecord {
  total: number
}

type ShopOrderSortField =
  | 'id'
  | 'order_code'
  | 'customer'
  | 'items'
  | 'shop_total'
  | 'payment_status'
  | 'order_status'
  | 'order_date'

const shopOrderSortColumns: Record<ShopOrderSortField, string> = {
  id: 'o.order_id',
  order_code: 'o.order_code COLLATE NOCASE',
  customer: 'o.recipient_name COLLATE NOCASE',
  items: 'item_count',
  shop_total: 'shop_total',
  payment_status: 'o.payment_status',
  order_status: 'o.order_status',
  order_date: 'o.order_date',
}

const orders = new Hono<AppEnv>()

const getJwtSecret = (
  env: Bindings,
): string => {
  if (!env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET chưa được cấu hình',
    )
  }

  return env.JWT_SECRET
}

const getBearerToken = (
  authorization?: string,
): string | null => {
  if (
    !authorization?.startsWith('Bearer ')
  ) {
    return null
  }

  return (
    authorization.slice(7).trim() ||
    null
  )
}

const authMiddleware =
  createMiddleware<AppEnv>(
    async (c, next) => {
      const token = getBearerToken(
        c.req.header('Authorization'),
      )

      if (!token) {return c.json(
        {
          success: false,
          message: 'Vui lòng đăng nhập để thực hiện',
        },
        401,
        )
      }

      try {
        const payload = (await verify(
          token,
          getJwtSecret(c.env),
          'HS256',
        )) as unknown as JwtPayload

        const userId = Number(payload.sub)

        if (!Number.isInteger(userId) || userId <= 0 || ![ 'customer', 'shop','admin',].includes(payload.role)) {
          return c.json(
            {
              success: false,
              message: 'Token không hợp lệ',
            },
            401,
          )
        }

        const user = await c.env.DB
          .prepare(`
            SELECT
              user_id AS id,
              role,
              status
            FROM users
            WHERE user_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `)
          .bind(userId)
          .first<UserRecord>()

        if (!user || user.status !== 'active') {
          return c.json(
            {
              success: false,
              message: 'Tài khoản không còn hoạt động',
            },
            401,
          )
        }

        if (user.role !== payload.role) {
          return c.json(
            {
              success: false,
              message: 'Quyền tài khoản đã thay đổi',
            },
            401,
          )
        }

        c.set('jwtPayload', payload)
        await next()
      } catch {
        return c.json(
          {
            success: false,
            message: 'Token không hợp lệ hoặc đã hết hạn',
          },
          401,
        )
      }
    },
  )

const requireShop =
  createMiddleware<AppEnv>(
    async (c, next) => {
      const payload =
        c.get('jwtPayload')

      if (payload.role !== 'shop') {
        return c.json(
          {
            success: false,
            message: 'Chức năng này chỉ dành cho shop',
          },
          403,
        )
      }

      await next()
    },
  )

orders.get(
  '/shop/me',
  authMiddleware,
  requireShop,
  zValidator(
    'query',
    shopOrderListQuerySchema,
  ),
  async (c) => {
    try {
      const payload =
        c.get('jwtPayload')
      const shopId =
        Number(payload.sub)

      const {
        page,
        limit,
        search = '',
        order_status: orderStatus,
        payment_status: paymentStatus,
        sort_by: sortBy,
        sort_order: sortOrder,
      } = c.req.valid('query')

      const orderBy = shopOrderSortColumns[sortBy]
      const sortDirection = sortOrder.toUpperCase()

      const offset =
        (page - 1) * limit

      const conditions = [
        'oi.shop_id = ?',
      ]

      const params:
        Array<string | number> = [
          shopId,
        ]

      if (search) {
        conditions.push(`
          (
            o.order_code LIKE ?
            OR o.recipient_name LIKE ?
            OR o.recipient_phone LIKE ?
          )
        `)

        params.push(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
        )
      }

      if (orderStatus) {
        conditions.push(
          'o.order_status = ?',
        )
        params.push(orderStatus)
      }

      if (paymentStatus) {
        conditions.push(
          'o.payment_status = ?',
        )
        params.push(paymentStatus)
      }

      const whereClause =
        conditions.join(' AND ')

      const count =
        await c.env.DB
          .prepare(`
            SELECT
              COUNT(
                DISTINCT o.order_id
              ) AS total
            FROM orders AS o
            INNER JOIN order_items AS oi
              ON oi.order_id = o.order_id
            WHERE ${whereClause}
          `)
          .bind(...params)
          .first<CountRecord>()

      const total =
        Number(count?.total ?? 0)

      const result =
        await c.env.DB
          .prepare(`
            SELECT
              o.order_id AS id,
              o.order_code,
              o.customer_id,
              o.order_date,
              o.recipient_name,
              o.recipient_phone,
              o.shipping_address,
              o.note,
              o.payment_method,
              o.payment_status,
              o.order_status,
              o.created_at,
              o.updated_at,
              COUNT(
                oi.order_item_id
              ) AS item_count,
              SUM(
                oi.quantity
              ) AS total_quantity,
              SUM(
                oi.line_total
              ) AS shop_total,
              (
                SELECT first_item.product_name
                FROM order_items AS first_item
                WHERE first_item.order_id = o.order_id
                  AND first_item.shop_id = oi.shop_id
                ORDER BY first_item.order_item_id ASC
                LIMIT 1
              ) AS first_product_name
            FROM orders AS o
            INNER JOIN order_items AS oi
              ON oi.order_id = o.order_id
            WHERE ${whereClause}
            GROUP BY
              o.order_id,
              o.order_code,
              o.customer_id,
              o.order_date,
              o.recipient_name,
              o.recipient_phone,
              o.shipping_address,
              o.note,
              o.payment_method,
              o.payment_status,
              o.order_status,
              o.created_at,
              o.updated_at,
              oi.shop_id
            ORDER BY
              ${orderBy} ${sortDirection},
              o.order_id DESC
            LIMIT ? OFFSET ?
          `)
          .bind(
            ...params,
            limit,
            offset,
          )
          .all()

      return c.json({
        success: true,
        data:
          result.results ?? [],
        pagination: {
          page,
          limit,
          total,
          totalPages:
            total === 0
              ? 0
              : Math.ceil(
                  total / limit,
                ),
        },
      })
    } catch (error) {
      console.error(
        'Get shop orders error:',
        error,
      )

      return c.json(
        {
          success: false,
          message:
            'Không thể tải đơn hàng của shop',
        },
        500,
      )
    }
  },
)

orders.get(
  '/shop/me/:id',
  authMiddleware,
  requireShop,
  zValidator(
    'param',
    orderIdParamSchema,
  ),
  async (c) => {
    try {
      const shopId = Number(
        c.get('jwtPayload').sub,
      )
      const { id: orderId } =
        c.req.valid('param')

      const order =
        await c.env.DB
          .prepare(`
            SELECT
              o.order_id AS id,
              o.order_code,
              o.order_date,
              o.recipient_name,
              o.recipient_phone,
              o.shipping_address,
              o.note,
              o.payment_method,
              o.payment_status,
              o.order_status,
              SUM(
                oi.line_total
              ) AS shop_total
            FROM orders AS o
            INNER JOIN order_items AS oi
              ON oi.order_id = o.order_id
            WHERE o.order_id = ?
              AND oi.shop_id = ?
            GROUP BY o.order_id
            LIMIT 1
          `)
          .bind(
            orderId,
            shopId,
          )
          .first()

      if (!order) {
        return c.json(
          {
            success: false,
            message:
              'Không tìm thấy đơn hàng của shop',
          },
          404,
        )
      }

      const items =
        await c.env.DB
          .prepare(`
            SELECT
              oi.order_item_id AS id,
              oi.product_id,
              oi.variant_id,
              oi.product_name,
              oi.variant_name,
              oi.quantity,
              oi.unit_price,
              oi.line_total,
              (
                SELECT m.url
                FROM media AS m
                WHERE m.product_id =
                  oi.product_id
                  AND m.type = 'image'
                ORDER BY
                  m.is_thumbnail DESC,
                  m.priority ASC,
                  m.media_id ASC
                LIMIT 1
              ) AS thumbnail
            FROM order_items AS oi
            WHERE oi.order_id = ?
              AND oi.shop_id = ?
            ORDER BY
              oi.order_item_id ASC
          `)
          .bind(
            orderId,
            shopId,
          )
          .all()

      return c.json({
        success: true,
        data: {
          ...order,
          items:
            items.results ?? [],
        },
      })
    } catch (error) {
      console.error(
        'Get shop order detail error:',
        error,
      )

      return c.json(
        {
          success: false,
          message: 'Không thể tải chi tiết đơn hàng',
        },
        500,
      )
    }
  },
)

export default orders
