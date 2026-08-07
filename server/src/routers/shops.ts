import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'
import type { Bindings } from '../types'

type UserRole = 'customer' | 'shop' | 'admin'
type ShopLevel = 'basic' | 'verified' | 'premium'
type ShopApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

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

const createShopSchema = z.object({
  shop_name: z
    .string()
    .trim()
    .min(3, 'Tên shop phải có ít nhất 3 ký tự')
    .max(150, 'Tên shop tối đa 150 ký tự'),

  phone: z
    .string()
    .trim()
    .min(8, 'Số điện thoại không hợp lệ')
    .max(20, 'Số điện thoại không hợp lệ'),

  description: z
    .union([z.string().trim().max(2000), z.null()])
    .optional()
})

const updateShopSchema = createShopSchema.partial()

const updateApprovalSchema = z.object({
  approval_status: z.enum([
    'approved',
    'rejected',
    'suspended'
  ]),

  level: z
    .enum(['basic', 'verified', 'premium'])
    .optional()
})

const idParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive('ID shop không hợp lệ')
})

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

/* =========================================================
   GET /api/shops
   Danh sách shop đã được duyệt.
========================================================= */

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

/* =========================================================
   GET /api/shops/me
   Hồ sơ shop của tài khoản đang đăng nhập.
========================================================= */

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

/* =========================================================
   GET /api/shops/:id
   Chi tiết shop công khai.
========================================================= */

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

/* =========================================================
   POST /api/shops/register
   Customer đăng ký trở thành shop.
========================================================= */

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