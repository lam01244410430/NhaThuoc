import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createShopSchema,
  shopIdParamSchema as idParamSchema,
  updateShopApprovalSchema as updateApprovalSchema,
  updateShopSchema,
} from '../validators/shop.validator'
import { verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../types'

type UserRole = 'customer' | 'shop' | 'admin'
type ShopLevel = 'basic' | 'verified' | 'premium'
type ShopApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

type AppEnv = {
  Bindings: Bindings & { PRODUCT_MEDIA: R2Bucket }
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

interface ShopRecord {
  id: number
  owner_name: string
  owner_email: string
  avatar: string | null
  shop_name: string
  phone: string
  description: string | null
  rating: number
  rating_count: number
  followers: number
  total_products: number
  level: ShopLevel
  approval_status: ShopApprovalStatus
  approved_by: number | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

interface ShopOwnershipRecord {
  id: number
  approval_status: ShopApprovalStatus
}

interface UserRecord {
  id: number
  role: UserRole
  status: 'pending' | 'active' | 'blocked' | 'deleted'
}

interface CountRecord {
  total: number
}

interface ExistingIdRecord {
  id: number
}

const shops = new Hono<AppEnv>()

const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(30).default(7)
})

const optionalDashboardFirst = async <T>(
  label: string,
  request: Promise<T | null>,
  fallback: T
): Promise<T> => {
  try {
    return (await request) ?? fallback
  } catch (error: unknown) {
    console.warn(`Seller Center optional metric unavailable: ${label}`, error)
    return fallback
  }
}

const optionalDashboardAll = async <T>(
  label: string,
  request: Promise<D1Result<T>>
): Promise<T[]> => {
  try {
    return (await request).results ?? []
  } catch (error: unknown) {
    console.warn(`Seller Center optional list unavailable: ${label}`, error)
    return []
  }
}

const getJwtSecret = (env: Bindings): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET chưa được cấu hình')
  }

  return env.JWT_SECRET
}

const getBearerToken = (
  authorization?: string
): string | null => {
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

const authMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const token = getBearerToken(
      c.req.header('Authorization')
    )

    if (!token) {
      return c.json(
        {
          success: false,
          message: 'Vui lòng đăng nhập để thực hiện'
        },
        401
      )
    }

    try {
      const payload = await verify(
        token,
        getJwtSecret(c.env),
        'HS256'
      ) as unknown as JwtPayload

      const userId = Number(payload.sub)

      if (
        !Number.isInteger(userId) ||
        userId <= 0 ||
        !['customer', 'shop', 'admin'].includes(
          payload.role
        )
      ) {
        return c.json(
          {
            success: false,
            message: 'Token không hợp lệ'
          },
          401
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
            message: 'Tài khoản không còn hoạt động'
          },
          401
        )
      }

      if (user.role !== payload.role) {
        return c.json(
          {
            success: false,
            message: 'Quyền tài khoản đã thay đổi'
          },
          401
        )
      }

      c.set('jwtPayload', payload)
      await next()
    } catch {
      return c.json(
        {
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn'
        },
        401
      )
    }
  }
)

const requireAdmin = createMiddleware<AppEnv>(
  async (c, next) => {
    const payload = c.get('jwtPayload')

    if (payload.role !== 'admin') {
      return c.json(
        {
          success: false,
          message: 'Bạn không có quyền quản trị shop'
        },
        403
      )
    }

    await next()
  }
)

const getShopById = async (
  db: D1Database,
  shopId: number
): Promise<ShopRecord | null> => {
  return db
    .prepare(`
      SELECT
        sp.shop_id AS id,
        u.name AS owner_name,
        u.email AS owner_email,
        u.avatar,
        sp.shop_name,
        sp.phone,
        sp.description,
        sp.rating,
        sp.rating_count,
        sp.followers,
        (
          SELECT COUNT(*)
          FROM products AS p
          WHERE p.shop_id = sp.shop_id
            AND p.deleted_at IS NULL
        ) AS total_products,
        sp.level,
        sp.approval_status,
        sp.approved_by,
        sp.approved_at,
        sp.created_at,
        sp.updated_at
      FROM shop_profiles AS sp
      INNER JOIN users AS u
        ON u.user_id = sp.shop_id
      WHERE sp.shop_id = ?
        AND u.deleted_at IS NULL
      LIMIT 1
    `)
    .bind(shopId)
    .first<ShopRecord>()
}

const getShopOwnership = async (
  db: D1Database,
  shopId: number
): Promise<ShopOwnershipRecord | null> => {
  return db
    .prepare(`
      SELECT
        shop_id AS id,
        approval_status
      FROM shop_profiles
      WHERE shop_id = ?
      LIMIT 1
    `)
    .bind(shopId)
    .first<ShopOwnershipRecord>()
}

shops.get('/', async (c) => {
  try {
    const pageValue = Number(
      c.req.query('page') ?? '1'
    )
    const limitValue = Number(
      c.req.query('limit') ?? '12'
    )

    const page =
      Number.isInteger(pageValue) && pageValue > 0
        ? pageValue
        : 1

    const limit =
      Number.isInteger(limitValue) && limitValue > 0
        ? Math.min(limitValue, 100)
        : 12

    const offset = (page - 1) * limit
    const search =
      c.req.query('search')?.trim() ?? ''
    const level = c.req.query('level')

    const conditions: string[] = [
      "sp.approval_status = 'approved'",
      "u.status = 'active'",
      'u.deleted_at IS NULL'
    ]

    const params: Array<string | number> = []

    if (search) {
      conditions.push(
        '(sp.shop_name LIKE ? OR sp.description LIKE ?)'
      )
      params.push(`%${search}%`, `%${search}%`)
    }

    if (level !== undefined) {
      if (
        !['basic', 'verified', 'premium'].includes(
          level
        )
      ) {
        return c.json(
          {
            success: false,
            message: 'level không hợp lệ'
          },
          400
        )
      }

      conditions.push('sp.level = ?')
      params.push(level)
    }

    const whereClause = conditions.join(' AND ')

    const count = await c.env.DB
      .prepare(`
        SELECT COUNT(*) AS total
        FROM shop_profiles AS sp
        INNER JOIN users AS u
          ON u.user_id = sp.shop_id
        WHERE ${whereClause}
      `)
      .bind(...params)
      .first<CountRecord>()

    const total = Number(count?.total ?? 0)

    const result = await c.env.DB
      .prepare(`
        SELECT
          sp.shop_id AS id,
          u.name AS owner_name,
          u.email AS owner_email,
          u.avatar,
          sp.shop_name,
          sp.phone,
          sp.description,
          sp.rating,
          sp.rating_count,
          sp.followers,
          (
            SELECT COUNT(*)
            FROM products AS p
            WHERE p.shop_id = sp.shop_id
              AND p.deleted_at IS NULL
              AND p.status = 'active'
          ) AS total_products,
          sp.level,
          sp.approval_status,
          sp.approved_by,
          sp.approved_at,
          sp.created_at,
          sp.updated_at
        FROM shop_profiles AS sp
        INNER JOIN users AS u
          ON u.user_id = sp.shop_id
        WHERE ${whereClause}
        ORDER BY
          sp.rating DESC,
          sp.followers DESC,
          sp.shop_id DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all<ShopRecord>()

    return c.json({
      success: true,
      data: result.results ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages:
          total === 0
            ? 0
            : Math.ceil(total / limit)
      }
    })
  } catch (error: unknown) {
    console.error('Get shops error:', error)

    return c.json(
      {
        success: false,
        message: 'Không thể tải danh sách shop'
      },
      500
    )
  }
})

shops.get('/me', authMiddleware, async (c) => {
  try {
    const payload = c.get('jwtPayload')

    if (payload.role !== 'shop') {
      return c.json(
        {
          success: false,
          message: 'Tài khoản này không phải shop'
        },
        403
      )
    }

    const shop = await getShopById(
      c.env.DB,
      Number(payload.sub)
    )

    if (!shop) {
      return c.json(
        {
          success: false,
          message: 'Chưa có hồ sơ shop'
        },
        404
      )
    }

    return c.json({
      success: true,
      data: shop
    })
  } catch (error: unknown) {
    console.error('Get current shop error:', error)

    return c.json(
      {
        success: false,
        message: 'Không thể tải hồ sơ shop'
      },
      500
    )
  }
})

/* Seller Center: số liệu tổng hợp thật của cửa hàng. */
shops.get(
  '/me/dashboard',
  authMiddleware,
  zValidator('query', dashboardQuerySchema),
  async (c) => {
    try {
      const payload = c.get('jwtPayload')
      const shopId = Number(payload.sub)
      const { days } = c.req.valid('query')

      if (payload.role !== 'shop') {
        return c.json(
          { success: false, message: 'Tài khoản này không phải shop' },
          403
        )
      }

      const currentStart = `-${days - 1} days`
      const previousStart = `-${days * 2 - 1} days`
      const previousEnd = `-${days} days`

      const [
        salesSummary,
        dailyResult,
        taskSummary,
        operationSummary,
        returnSummary,
        pendingReviewSummary,
        reviewSummary,
        pendingOrders,
        lowStockProducts,
        recentReviews
      ] = await Promise.all([
        c.env.DB.prepare(`
          SELECT
            COUNT(DISTINCT CASE WHEN DATE(o.order_date) >= DATE('now', ?)
              THEN o.order_id END) AS current_orders,
            COUNT(DISTINCT CASE WHEN DATE(o.order_date)
              BETWEEN DATE('now', ?) AND DATE('now', ?)
              THEN o.order_id END) AS previous_orders,
            COALESCE(SUM(CASE
              WHEN DATE(o.order_date) >= DATE('now', ?)
                AND o.payment_status = 'paid'
                AND o.order_status IN ('delivered', 'completed')
              THEN oi.line_total ELSE 0 END), 0) AS current_revenue,
            COALESCE(SUM(CASE
              WHEN DATE(o.order_date) BETWEEN DATE('now', ?) AND DATE('now', ?)
                AND o.payment_status = 'paid'
                AND o.order_status IN ('delivered', 'completed')
              THEN oi.line_total ELSE 0 END), 0) AS previous_revenue
          FROM orders AS o
          INNER JOIN order_items AS oi ON oi.order_id = o.order_id
          WHERE oi.shop_id = ?
            AND DATE(o.order_date) >= DATE('now', ?)
        `).bind(
          currentStart,
          previousStart,
          previousEnd,
          currentStart,
          previousStart,
          previousEnd,
          shopId,
          previousStart
        ).first<Record<string, number>>(),

        c.env.DB.prepare(`
          SELECT
            DATE(o.order_date) AS day,
            COUNT(DISTINCT o.order_id) AS orders,
            COALESCE(SUM(CASE
              WHEN o.payment_status = 'paid'
                AND o.order_status IN ('delivered', 'completed')
              THEN oi.line_total ELSE 0 END), 0) AS revenue
          FROM orders AS o
          INNER JOIN order_items AS oi ON oi.order_id = o.order_id
          WHERE oi.shop_id = ?
            AND DATE(o.order_date) >= DATE('now', ?)
          GROUP BY DATE(o.order_date)
          ORDER BY DATE(o.order_date)
        `).bind(shopId, currentStart).all<Record<string, string | number>>(),

        c.env.DB.prepare(`
          SELECT
            (SELECT COUNT(DISTINCT o.order_id)
              FROM orders AS o INNER JOIN order_items AS oi ON oi.order_id = o.order_id
              WHERE oi.shop_id = ? AND o.order_status = 'pending') AS pending_orders,
            (SELECT COUNT(DISTINCT o.order_id)
              FROM orders AS o INNER JOIN order_items AS oi ON oi.order_id = o.order_id
              WHERE oi.shop_id = ?
                AND o.order_status IN ('confirmed', 'processing')) AS processing_orders,
            (SELECT COUNT(*) FROM products
              WHERE shop_id = ? AND deleted_at IS NULL AND status = 'draft') AS draft_products,
            (SELECT COUNT(*) FROM (
              SELECT p.product_id
              FROM products AS p
              LEFT JOIN warehouse_inventory AS wi
                ON wi.product_id = p.product_id
                AND wi.shop_id = p.shop_id
              WHERE p.shop_id = ? AND p.deleted_at IS NULL
              GROUP BY p.product_id
              HAVING COALESCE(SUM(wi.quantity - wi.reserved_quantity), 0) > 0
                AND COALESCE(SUM(wi.quantity - wi.reserved_quantity), 0) <= 10
            )) AS low_stock_products,
            (SELECT COUNT(*) FROM (
              SELECT p.product_id
              FROM products AS p
              LEFT JOIN warehouse_inventory AS wi
                ON wi.product_id = p.product_id
                AND wi.shop_id = p.shop_id
              WHERE p.shop_id = ? AND p.deleted_at IS NULL
              GROUP BY p.product_id
              HAVING COALESCE(SUM(wi.quantity - wi.reserved_quantity), 0) <= 0
            )) AS out_of_stock_products
        `).bind(shopId, shopId, shopId, shopId, shopId)
          .first<Record<string, number>>(),

        c.env.DB.prepare(`
          SELECT
            COUNT(DISTINCT o.order_id) AS total_orders,
            COUNT(DISTINCT CASE WHEN o.order_status = 'cancelled'
              THEN o.order_id END) AS cancelled_orders,
            COUNT(DISTINCT CASE WHEN o.order_status IN ('delivered', 'completed')
              THEN o.order_id END) AS completed_orders,
            COALESCE(SUM(CASE WHEN o.order_status IN ('delivered', 'completed')
              THEN oi.quantity ELSE 0 END), 0) AS sold_quantity
          FROM orders AS o
          INNER JOIN order_items AS oi ON oi.order_id = o.order_id
          WHERE oi.shop_id = ?
            AND DATE(o.order_date) >= DATE('now', '-27 days')
        `).bind(shopId).first<Record<string, number>>(),

        optionalDashboardFirst(
          'returns',
          c.env.DB.prepare(`
          SELECT COALESCE(SUM(r.quantity), 0) AS returned_quantity
          FROM returns AS r
          INNER JOIN order_items AS oi ON oi.order_item_id = r.order_item_id
          WHERE oi.shop_id = ?
            AND DATE(r.requested_at) >= DATE('now', '-27 days')
            AND r.status <> 'rejected'
          `).bind(shopId).first<{ returned_quantity: number }>(),
          { returned_quantity: 0 }
        ),

        optionalDashboardFirst(
          'pending reviews',
          c.env.DB.prepare(`
            SELECT COUNT(*) AS pending_reviews
            FROM reviews AS r
            INNER JOIN products AS p ON p.product_id = r.product_id
            WHERE p.shop_id = ? AND r.status = 'pending'
          `).bind(shopId).first<{ pending_reviews: number }>(),
          { pending_reviews: 0 }
        ),

        optionalDashboardFirst(
          'review summary',
          c.env.DB.prepare(`
          SELECT COALESCE(AVG(r.rating), 0) AS average_rating,
            COUNT(*) AS rating_count
          FROM reviews AS r
          INNER JOIN products AS p ON p.product_id = r.product_id
          WHERE p.shop_id = ? AND r.status = 'published'
          `).bind(shopId).first<Record<string, number>>(),
          { average_rating: 0, rating_count: 0 }
        ),

        c.env.DB.prepare(`
          SELECT DISTINCT o.order_id AS id, o.order_code, o.recipient_name,
            o.order_status, o.order_date AS created_at
          FROM orders AS o
          INNER JOIN order_items AS oi ON oi.order_id = o.order_id
          WHERE oi.shop_id = ?
            AND o.order_status IN ('pending', 'confirmed', 'processing')
          ORDER BY o.order_date DESC LIMIT 8
        `).bind(shopId).all<Record<string, string | number>>(),

        c.env.DB.prepare(`
          SELECT p.product_id AS id, p.name,
            COALESCE(SUM(wi.quantity - wi.reserved_quantity), 0) AS stock_quantity,
            COALESCE(MAX(wi.updated_at), p.updated_at) AS created_at
          FROM products AS p
          LEFT JOIN warehouse_inventory AS wi
            ON wi.product_id = p.product_id
            AND wi.shop_id = p.shop_id
          WHERE p.shop_id = ? AND p.deleted_at IS NULL
          GROUP BY p.product_id, p.name, p.updated_at
          HAVING COALESCE(SUM(wi.quantity - wi.reserved_quantity), 0) <= 10
          ORDER BY stock_quantity ASC, created_at DESC LIMIT 8
        `).bind(shopId).all<Record<string, string | number>>(),

        optionalDashboardAll(
          'recent reviews',
          c.env.DB.prepare(`
          SELECT r.review_id AS id, r.rating, r.title, r.comment,
            r.status, r.created_at, p.name AS product_name
          FROM reviews AS r
          INNER JOIN products AS p ON p.product_id = r.product_id
          WHERE p.shop_id = ?
          ORDER BY r.created_at DESC LIMIT 10
          `).bind(shopId).all<Record<string, string | number>>()
        )
      ])

      const dailyMap = new Map(
        (dailyResult.results ?? []).map((item) => [String(item.day), item])
      )
      const daily = Array.from({ length: days }, (_, index) => {
        const date = new Date()
        date.setUTCHours(0, 0, 0, 0)
        date.setUTCDate(date.getUTCDate() - (days - 1 - index))
        const day = date.toISOString().slice(0, 10)
        const item = dailyMap.get(day)
        return {
          day,
          revenue: Number(item?.revenue ?? 0),
          orders: Number(item?.orders ?? 0)
        }
      })

      const operations: Record<string, number> = operationSummary ?? {}
      const totalOrders = Number(operations.total_orders ?? 0)
      const soldQuantity = Number(operations.sold_quantity ?? 0)
      const returnedQuantity = Number(returnSummary?.returned_quantity ?? 0)
      const notifications = [
        ...(pendingOrders.results ?? []).map((item) => ({
          id: `order-${item.id}`,
          type: 'order',
          title: `Đơn hàng ${item.order_code}`,
          description: `${item.recipient_name} · Cần tiếp tục xử lý`,
          created_at: String(item.created_at),
          section: 'orders'
        })),
        ...(lowStockProducts.results ?? []).map((item) => ({
          id: `stock-${item.id}`,
          type: 'inventory',
          title: String(item.name),
          description: Number(item.stock_quantity) === 0
            ? 'Sản phẩm đã hết hàng'
            : `Chỉ còn ${item.stock_quantity} sản phẩm`,
          created_at: String(item.created_at),
          section: 'inventory'
        }))
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12)

      return c.json({
        success: true,
        data: {
          period_days: days,
          sales: {
            current_revenue: Number(salesSummary?.current_revenue ?? 0),
            previous_revenue: Number(salesSummary?.previous_revenue ?? 0),
            current_orders: Number(salesSummary?.current_orders ?? 0),
            previous_orders: Number(salesSummary?.previous_orders ?? 0),
            daily
          },
          tasks: {
            pending_orders: Number(taskSummary?.pending_orders ?? 0),
            processing_orders: Number(taskSummary?.processing_orders ?? 0),
            draft_products: Number(taskSummary?.draft_products ?? 0),
            low_stock_products: Number(taskSummary?.low_stock_products ?? 0),
            out_of_stock_products: Number(taskSummary?.out_of_stock_products ?? 0),
            pending_reviews: Number(pendingReviewSummary?.pending_reviews ?? 0)
          },
          operations: {
            cancellation_rate: totalOrders > 0
              ? Number(operations.cancelled_orders ?? 0) / totalOrders * 100 : 0,
            completion_rate: totalOrders > 0
              ? Number(operations.completed_orders ?? 0) / totalOrders * 100 : 0,
            return_rate: soldQuantity > 0
              ? returnedQuantity / soldQuantity * 100 : 0,
            average_rating: Number(reviewSummary?.average_rating ?? 0),
            rating_count: Number(reviewSummary?.rating_count ?? 0)
          },
          notifications,
          reviews: recentReviews
        }
      })
    } catch (error: unknown) {
      console.error('Get shop dashboard error:', error)
      return c.json(
        { success: false, message: 'Không thể tải số liệu Seller Center' },
        500
      )
    }
  }
)


/* Public storefront: chỉ sản phẩm active, xếp theo số lượng bán thực tế. */
shops.get('/:id/products', async (c) => {
  try {
    const shopId = Number(c.req.param('id'))
    const pageValue = Number(c.req.query('page') ?? '1')
    const limitValue = Number(c.req.query('limit') ?? '24')
    const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1
    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 24
    const offset = (page - 1) * limit

    if (!Number.isInteger(shopId) || shopId <= 0) {
      return c.json({ success: false, message: 'shop_id không hợp lệ' }, 400)
    }

    const approvedShop = await c.env.DB.prepare(`
      SELECT sp.shop_id AS id
      FROM shop_profiles AS sp
      INNER JOIN users AS u ON u.user_id = sp.shop_id
      WHERE sp.shop_id = ?
        AND sp.approval_status = 'approved'
        AND u.status = 'active'
        AND u.deleted_at IS NULL
      LIMIT 1
    `).bind(shopId).first<ExistingIdRecord>()

    if (!approvedShop) {
      return c.json({ success: false, message: 'Không tìm thấy shop' }, 404)
    }

    const count = await c.env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM products AS p
      INNER JOIN categories AS c ON c.category_id = p.category_id
      WHERE p.shop_id = ?
        AND p.deleted_at IS NULL
        AND p.status = 'active'
        AND c.status = 1
    `).bind(shopId).first<CountRecord>()

    const total = Number(count?.total ?? 0)
    const result = await c.env.DB.prepare(`
      SELECT
        p.product_id AS id,
        p.shop_id,
        p.category_id,
        p.name,
        p.slug,
        p.price,
        p.sale_price,
        p.description,
        p.usage_guide,
        COALESCE((
          SELECT SUM(wi.quantity)
          FROM warehouse_inventory AS wi
          WHERE wi.product_id = p.product_id
        ), 0) AS stock_quantity,
        p.status,
        sp.shop_name,
        c.category_name,
        COALESCE((
          SELECT SUM(oi.quantity)
          FROM order_items AS oi
          INNER JOIN orders AS o ON o.order_id = oi.order_id
          WHERE oi.product_id = p.product_id
            AND oi.shop_id = p.shop_id
            AND o.order_status IN ('delivered', 'completed')
        ), 0) AS sold_quantity,
        p.created_at,
        p.updated_at,
        (
          SELECT m.url
          FROM media AS m
          WHERE m.product_id = p.product_id
            AND m.type = 'image'
          ORDER BY m.is_thumbnail DESC, m.priority ASC, m.media_id ASC
          LIMIT 1
        ) AS thumbnail
      FROM products AS p
      INNER JOIN shop_profiles AS sp ON sp.shop_id = p.shop_id
      INNER JOIN categories AS c ON c.category_id = p.category_id
      WHERE p.shop_id = ?
        AND p.deleted_at IS NULL
        AND p.status = 'active'
        AND sp.approval_status = 'approved'
        AND c.status = 1
      ORDER BY sold_quantity DESC, p.product_id DESC
      LIMIT ? OFFSET ?
    `).bind(shopId, limit, offset).all<Record<string, unknown>>()

    return c.json({
      success: true,
      data: result.results ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    })
  } catch (error: unknown) {
    console.error('Get public shop products error:', error)
    return c.json({ success: false, message: 'Không thể tải sản phẩm của shop' }, 500)
  }
})

shops.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const shop = await getShopById(
        c.env.DB,
        id
      )

      if (
        !shop ||
        shop.approval_status !== 'approved'
      ) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy shop'
          },
          404
        )
      }

      return c.json({
        success: true,
        data: shop
      })
    } catch (error: unknown) {
      console.error('Get shop detail error:', error)

      return c.json(
        {
          success: false,
          message: 'Không thể tải chi tiết shop'
        },
        500
      )
    }
  }
)

shops.post(
  '/register',
  authMiddleware,
  zValidator('json', createShopSchema),
  async (c) => {
    try {
      const payload = c.get('jwtPayload')
      const body = c.req.valid('json')
      const userId = Number(payload.sub)

      if (payload.role === 'admin') {
        return c.json(
          {
            success: false,
            message:
              'Tài khoản admin không thể đăng ký shop'
          },
          403
        )
      }

      const existingShop = await getShopOwnership(
        c.env.DB,
        userId
      )

      if (existingShop) {
        return c.json(
          {
            success: false,
            message: 'Tài khoản đã có hồ sơ shop'
          },
          409
        )
      }

      const duplicate = await c.env.DB
        .prepare(`
          SELECT shop_id AS id
          FROM shop_profiles
          WHERE shop_name = ?
             OR phone = ?
          LIMIT 1
        `)
        .bind(body.shop_name, body.phone)
        .first<ExistingIdRecord>()

      if (duplicate) {
        return c.json(
          {
            success: false,
            message:
              'Tên shop hoặc số điện thoại đã được sử dụng'
          },
          409
        )
      }

      const customerUsage = await c.env.DB
        .prepare(`
          SELECT
            EXISTS (
              SELECT 1
              FROM orders
              WHERE customer_id = ?
              LIMIT 1
            ) AS has_orders,

            EXISTS (
              SELECT 1
              FROM reviews
              WHERE customer_id = ?
              LIMIT 1
            ) AS has_reviews
        `)
        .bind(userId, userId)
        .first<{
          has_orders: number
          has_reviews: number
        }>()

      if (
        customerUsage?.has_orders === 1 ||
        customerUsage?.has_reviews === 1
      ) {
        return c.json(
          {
            success: false,
            message:
              'Tài khoản đã có dữ liệu mua hàng nên không thể chuyển trực tiếp thành shop. Vui lòng sử dụng tài khoản shop riêng.'
          },
          409
        )
      }

      await c.env.DB.batch([
        c.env.DB
          .prepare(`
            DELETE FROM customer_profiles
            WHERE customer_id = ?
          `)
          .bind(userId),
        c.env.DB
          .prepare(`
            UPDATE users
            SET
              role = 'shop',
              updated_at = DATETIME('now')
            WHERE user_id = ?
              AND role = 'customer'
              AND status = 'active'
              AND deleted_at IS NULL
          `)
          .bind(userId),
        c.env.DB
          .prepare(`
            INSERT INTO shop_profiles (
              shop_id,
              shop_name,
              phone,
              description,
              rating,
              rating_count,
              followers,
              total_products,
              level,
              approval_status,
              approved_by,
              approved_at,
              created_at,
              updated_at
            )
            VALUES (
              ?, ?, ?, ?,
              0,
              0,
              0,
              0,
              'basic',
              'pending',
              NULL,
              NULL,
              DATETIME('now'),
              DATETIME('now')
            )
          `)
          .bind(
            userId,
            body.shop_name,
            body.phone,
            body.description ?? null
          )
      ])

      const shop = await getShopById(
        c.env.DB,
        userId
      )

      return c.json(
        {
          success: true,
          message:
            'Đăng ký shop thành công, đang chờ quản trị viên phê duyệt',
          data: shop,
          requireRelogin: payload.role !== 'shop'
        },
        201
      )
    } catch (error: unknown) {
      console.error('Register shop error:', error)

      return c.json(
        {
          success: false,
          message: 'Không thể đăng ký shop'
        },
        500
      )
    }
  }
)


shops.post(
  '/me/avatar',
  authMiddleware,
  async (c) => {
    try {
      const payload = c.get('jwtPayload')
      const shopId = Number(payload.sub)

      if (payload.role !== 'shop') {
        return c.json({ success: false, message: 'Tài khoản này không phải shop' }, 403)
      }

      const existing = await getShopOwnership(c.env.DB, shopId)
      if (!existing) {
        return c.json({ success: false, message: 'Không tìm thấy hồ sơ shop' }, 404)
      }

      const formData = await c.req.raw.formData()
      const uploadedFile = formData.get('file')

      if (
        !uploadedFile ||
        typeof uploadedFile === 'string' ||
        typeof uploadedFile.stream !== 'function'
      ) {
        return c.json({ success: false, message: 'Vui lòng chọn ảnh đại diện hợp lệ' }, 400)
      }

      const file = uploadedFile

      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
      if (!allowedTypes.has(file.type)) {
        return c.json({ success: false, message: 'Avatar chỉ hỗ trợ JPG, PNG hoặc WebP' }, 400)
      }
      if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
        return c.json({ success: false, message: 'Avatar phải có dung lượng tối đa 5MB' }, 400)
      }

      const extensionByType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      }
      const filename = `${crypto.randomUUID()}.${extensionByType[file.type]}`
      const key = `shop/avatar/${shopId}/${filename}`
      const avatar = `/shop/avatar/${shopId}/${filename}`

      const currentUser = await c.env.DB.prepare(`
        SELECT avatar FROM users WHERE user_id = ? LIMIT 1
      `).bind(shopId).first<{ avatar: string | null }>()

      const originalName =
        typeof file.name === 'string' && file.name.trim()
          ? file.name.trim().slice(0, 180)
          : `shop-avatar.${extensionByType[file.type]}`

      const fileBuffer = await file.arrayBuffer()

      await c.env.PRODUCT_MEDIA.put(key, fileBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          shopId: String(shopId),
          purpose: 'shop-avatar',
          originalName,
        },
      })

      await c.env.DB.prepare(`
        UPDATE users
        SET avatar = ?, updated_at = DATETIME('now')
        WHERE user_id = ?
      `).bind(avatar, shopId).run()

      const oldAvatar = currentUser?.avatar
      let oldKey: string | null = null

      if (oldAvatar?.startsWith('/shop/avatar/')) {
        const oldPath = oldAvatar.slice('/shop/avatar/'.length)
        const [oldShopId, oldFilename] = oldPath.split('/')
        if (oldShopId && oldFilename) {
          oldKey = `shop/avatar/${oldShopId}/${oldFilename}`
        }
      } else if (oldAvatar?.startsWith(`shop/avatar/${shopId}/`)) {
        oldKey = oldAvatar
      } else if (oldAvatar?.startsWith(`shops/avatars/${shopId}/`)) {
        oldKey = oldAvatar
      }

      if (oldKey && oldKey !== key) {
        await c.env.PRODUCT_MEDIA.delete(oldKey)
      }

      return c.json({ success: true, data: { key, url: avatar, avatar } }, 201)
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('Upload shop avatar error:', error)
      return c.json(
        {
          success: false,
          message: 'Không thể cập nhật ảnh đại diện cửa hàng',
          detail,
        },
        500,
      )
    }
  },
)

shops.get('/avatar/:shopId/:filename', async (c) => {
  try {
    const shopId = c.req.param('shopId')
    const filename = c.req.param('filename')

    if (!/^\d+$/.test(shopId) || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return c.json({ success: false, message: 'Đường dẫn avatar không hợp lệ' }, 400)
    }

    const key = `shop/avatar/${shopId}/${filename}`
    let object = await c.env.PRODUCT_MEDIA.get(key)

    if (!object) {
      const legacyKey = `shops/avatars/${shopId}/${filename}`
      object = await c.env.PRODUCT_MEDIA.get(legacyKey)
    }

    if (!object) {
      return c.json({ success: false, message: 'Không tìm thấy avatar' }, 404)
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('cache-control', 'public, max-age=31536000, immutable')

    return new Response(object.body, { headers })
  } catch (error) {
    console.error('Get shop avatar error:', error)
    return c.json({ success: false, message: 'Không thể tải avatar' }, 500)
  }
})

shops.put(
  '/me',
  authMiddleware,
  zValidator('json', updateShopSchema),
  async (c) => {
    try {
      const payload = c.get('jwtPayload')
      const body = c.req.valid('json')
      const shopId = Number(payload.sub)

      if (payload.role !== 'shop') {
        return c.json(
          {
            success: false,
            message: 'Tài khoản này không phải shop'
          },
          403
        )
      }

      const existing = await getShopOwnership(
        c.env.DB,
        shopId
      )

      if (!existing) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy hồ sơ shop'
          },
          404
        )
      }

      if (
        body.shop_name !== undefined ||
        body.phone !== undefined
      ) {
        const duplicate = await c.env.DB
          .prepare(`
            SELECT shop_id AS id
            FROM shop_profiles
            WHERE (
              shop_name = ?
              OR phone = ?
            )
              AND shop_id <> ?
            LIMIT 1
          `)
          .bind(
            body.shop_name ?? '',
            body.phone ?? '',
            shopId
          )
          .first<ExistingIdRecord>()

        if (duplicate) {
          return c.json(
            {
              success: false,
              message:
                'Tên shop hoặc số điện thoại đã được sử dụng'
            },
            409
          )
        }
      }

      const fields: string[] = []
      const values: Array<string | number | null> = []

      if (body.shop_name !== undefined) {
        fields.push('shop_name = ?')
        values.push(body.shop_name)
      }

      if (body.phone !== undefined) {
        fields.push('phone = ?')
        values.push(body.phone)
      }

      if (body.description !== undefined) {
        fields.push('description = ?')
        values.push(body.description)
      }

      if (fields.length === 0) {
        return c.json(
          {
            success: false,
            message: 'Không có thông tin nào thay đổi'
          },
          400
        )
      }

      fields.push("updated_at = DATETIME('now')")
      values.push(shopId)

      await c.env.DB
        .prepare(`
          UPDATE shop_profiles
          SET ${fields.join(', ')}
          WHERE shop_id = ?
        `)
        .bind(...values)
        .run()

      const shop = await getShopById(
        c.env.DB,
        shopId
      )

      return c.json({
        success: true,
        message: 'Cập nhật hồ sơ shop thành công',
        data: shop
      })
    } catch (error: unknown) {
      console.error('Update shop error:', error)

      return c.json(
        {
          success: false,
          message: 'Không thể cập nhật hồ sơ shop'
        },
        500
      )
    }
  }
)

/* =========================================================
   GET /api/shops/admin/pending
   Danh sách shop chờ duyệt.
========================================================= */

shops.get(
  '/admin/pending',
  authMiddleware,
  requireAdmin,
  async (c) => {
    try {
      const result = await c.env.DB
        .prepare(`
          SELECT
            sp.shop_id AS id,
            u.name AS owner_name,
            u.email AS owner_email,
            u.avatar,
            sp.shop_name,
            sp.phone,
            sp.description,
            sp.rating,
            sp.rating_count,
            sp.followers,
            sp.total_products,
            sp.level,
            sp.approval_status,
            sp.approved_by,
            sp.approved_at,
            sp.created_at,
            sp.updated_at
          FROM shop_profiles AS sp
          INNER JOIN users AS u
            ON u.user_id = sp.shop_id
          WHERE sp.approval_status = 'pending'
            AND u.deleted_at IS NULL
          ORDER BY sp.created_at ASC
        `)
        .all<ShopRecord>()

      return c.json({
        success: true,
        data: result.results ?? []
      })
    } catch (error: unknown) {
      console.error('Get pending shops error:', error)

      return c.json(
        {
          success: false,
          message: 'Không thể tải danh sách shop chờ duyệt'
        },
        500
      )
    }
  }
)

/* =========================================================
   PATCH /api/shops/:id/approval
   Admin duyệt, từ chối hoặc đình chỉ shop.
========================================================= */

shops.patch(
  '/:id/approval',
  authMiddleware,
  requireAdmin,
  zValidator('param', idParamSchema),
  zValidator('json', updateApprovalSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const payload = c.get('jwtPayload')

      const existing = await getShopOwnership(
        c.env.DB,
        id
      )

      if (!existing) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy shop'
          },
          404
        )
      }

      const fields = [
        'approval_status = ?',
        'approved_by = ?',
        "updated_at = DATETIME('now')"
      ]

      const values: Array<string | number | null> = [
        body.approval_status,
        Number(payload.sub)
      ]

      if (body.approval_status === 'approved') {
        fields.push("approved_at = DATETIME('now')")
      } else {
        fields.push('approved_at = NULL')
      }

      if (body.level !== undefined) {
        fields.push('level = ?')
        values.push(body.level)
      }

      values.push(id)

      await c.env.DB
        .prepare(`
          UPDATE shop_profiles
          SET ${fields.join(', ')}
          WHERE shop_id = ?
        `)
        .bind(...values)
        .run()

      const shop = await getShopById(
        c.env.DB,
        id
      )

      return c.json({
        success: true,
        message:
          body.approval_status === 'approved'
            ? 'Đã phê duyệt shop'
            : body.approval_status === 'rejected'
              ? 'Đã từ chối shop'
              : 'Đã đình chỉ shop',
        data: shop
      })
    } catch (error: unknown) {
      console.error('Update shop approval error:', error)

      return c.json(
        {
          success: false,
          message: 'Không thể cập nhật trạng thái shop'
        },
        500
      )
    }
  }
)

export default shops
