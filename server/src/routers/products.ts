import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'

type UserRole = 'customer' | 'shop' | 'admin'
type ProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock'

type Env = {
    Bindings: {
        DB: D1Database
        JWT_SECRET: string
    }
    Variables: {
        jwtPayload: JwtPayload
    }
}

interface JwtPayload {
    sub: number
    username: string
    email: string
    role: 'customer' | 'admin' | 'shop'
    iat?: number
    exp?: number
}

interface ProductRecord {
  id: number
  shop_id: number
  category_id: number
  name: string
  slug: string
  price: number
  sale_price: number | null
  description: string | null
  usage_guide: string | null
  stock_quantity: number
  status: ProductStatus
  thumbnail: string | null
  shop_name: string
  category_name: string
  created_at: string
  updated_at: string
}

interface ProductOwnershipRecord {
  id: number
  shop_id: number
  status: ProductStatus
}

interface CountRecord { total: number }
interface ExistingIdRecord { id: number }

const products = new Hono<Env>()
const productStatusSchema = z.enum(['draft', 'active', 'inactive', 'out_of_stock'])
const nullableStringSchema = z.union([z.string().trim(), z.null()]).optional()

const productBaseSchema = z.object({
  shop_id: z.number().int().positive().optional(),
  category_id: z.number().int().positive('Danh mục không hợp lệ'),
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(220)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug không hợp lệ'
    ),
  price: z.number().nonnegative(),
  sale_price: z
    .union([z.number().nonnegative(), z.null()])
    .optional(),
  description: z
    .union([z.string().trim(), z.null()])
    .optional(),
  usage_guide: z
    .union([z.string().trim(), z.null()])
    .optional(),
  stock_quantity: z.number().int().nonnegative(),
  status: z
    .enum(['draft', 'active', 'inactive', 'out_of_stock'])
    .default('draft'),
  thumbnail_url: z
    .union([z.string().trim().url(), z.null()])
    .optional()
})

const createProductSchema = productBaseSchema.superRefine(
  (data, ctx) => {
    if (
      data.sale_price != null &&
      data.sale_price > data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sale_price'],
        message:
          'Giá khuyến mãi không được lớn hơn giá gốc'
      })
    }
  }
)

const updateProductSchema = productBaseSchema
  .omit({ shop_id: true })
  .partial()
  .superRefine((data, ctx) => {
    if (
      data.price !== undefined &&
      data.sale_price != null &&
      data.sale_price > data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sale_price'],
        message:
          'Giá khuyến mãi không được lớn hơn giá gốc'
      })
    }
  })

const idParamSchema = z.object({ id: z.coerce.number().int().positive()})

const getJwtSecret = (env: Env['Bindings']) => {
    if (!env.JWT_SECRET) throw new Error('JWT_SECRET chưa được cấu hình')
    return env.JWT_SECRET
}

const getBearerToken = (authorization?: string) => {
    if (!authorization?.startsWith('Bearer ')) return null
    return authorization.slice(7).trim() || null
}

const authMiddleware = createMiddleware<Env>(async (c, next) => {
    const token = getBearerToken(c.req.header('Authorization'))
    if (!token) {
        return c.json(
            {
                success: false,
                message: 'Vui lòng đăng nhập để thực hiện'
            }
            ,401
        )
    }

    try {
        const payload = await verify(token, getJwtSecret(c.env), 'HS256') as unknown as JwtPayload
        const userId = Number(payload.sub)
        if (!Number.isInteger(userId) || userId <= 0 || !['customer', 'shop', 'admin'].includes(payload.role)) {
            return c.json(
                { 
                    success: false, 
                    message: 'Token không hợp lệ' 
                }
                , 401
            )
        }
        c.set('jwtPayload', payload)
        await next()
    } catch {
        return c.json(
            { 
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn' 
            }
            , 401
        )
    }
})

const requireProductManager = createMiddleware<Env>(async (c, next) => {
  const user = c.get('jwtPayload')
  if (user.role !== 'shop' && user.role !== 'admin') {
    return c.json(
        { 
            success: false, 
            message: 'Bạn không có quyền quản lý sản phẩm' 
        }
        , 403
    )
  }
  await next()
})

const validateCategory = async (db: D1Database, categoryId: number) => Boolean(await db.prepare(`
  SELECT category_id AS id FROM categories WHERE category_id = ? AND status = 1 LIMIT 1
`).bind(categoryId).first<ExistingIdRecord>())

const validateApprovedShop = async (db: D1Database, shopId: number) => Boolean(await db.prepare(`
  SELECT shop_id AS id FROM shop_profiles WHERE shop_id = ? AND approval_status = 'approved' LIMIT 1
`).bind(shopId).first<ExistingIdRecord>())

const getProductOwnership = async (db: D1Database, productId: number) => db.prepare(`
  SELECT product_id AS id, shop_id, status
  FROM products
  WHERE product_id = ? AND deleted_at IS NULL
  LIMIT 1
`).bind(productId).first<ProductOwnershipRecord>()

const canManageProduct = (payload: JwtPayload, shopId: number) =>
  payload.role === 'admin' || (payload.role === 'shop' && Number(payload.sub) === shopId)

const getProductById = async (db: D1Database, productId: number) => db.prepare(`
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
    p.stock_quantity,
    p.status,
    sp.shop_name,
    c.category_name,
    p.created_at,
    p.updated_at,
    (
      SELECT m.url
      FROM media AS m
      WHERE m.product_id = p.product_id AND m.type = 'image'
      ORDER BY m.is_thumbnail DESC, m.priority ASC, m.media_id ASC
      LIMIT 1
    ) AS thumbnail
  FROM products AS p
  INNER JOIN shop_profiles AS sp ON sp.shop_id = p.shop_id
  INNER JOIN categories AS c ON c.category_id = p.category_id
  WHERE p.product_id = ? AND p.deleted_at IS NULL
  LIMIT 1
`).bind(productId).first<ProductRecord>()

products.get('/', async (c) => {
  try {
    const page = Math.max(1, Number(c.req.query('page') || 1))
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 12)))
    const offset = (page - 1) * limit
    const search = c.req.query('search')?.trim() || ''
    const categoryId = c.req.query('category_id')
    const shopId = c.req.query('shop_id')

    const conditions = [
      'p.deleted_at IS NULL',
      "p.status = 'active'",
      "sp.approval_status = 'approved'",
      'c.status = 1'
    ]
    const params: Array<string | number> = []

    if (search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (categoryId) {
      const value = Number(categoryId)
      if (!Number.isInteger(value) || value <= 0) return c.json({ success: false, message: 'category_id không hợp lệ' }, 400)
      conditions.push('p.category_id = ?')
      params.push(value)
    }
    if (shopId) {
      const value = Number(shopId)
      if (!Number.isInteger(value) || value <= 0) return c.json({ success: false, message: 'shop_id không hợp lệ' }, 400)
      conditions.push('p.shop_id = ?')
      params.push(value)
    }

    const whereClause = conditions.join(' AND ')
    const count = await c.env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM products AS p
      INNER JOIN shop_profiles AS sp ON sp.shop_id = p.shop_id
      INNER JOIN categories AS c ON c.category_id = p.category_id
      WHERE ${whereClause}
    `).bind(...params).first<CountRecord>()

    const total = Number(count?.total || 0)
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
        p.stock_quantity,
        p.status,
        sp.shop_name,
        c.category_name,
        p.created_at,
        p.updated_at,
        (
          SELECT m.url
          FROM media AS m
          WHERE m.product_id = p.product_id AND m.type = 'image'
          ORDER BY m.is_thumbnail DESC, m.priority ASC, m.media_id ASC
          LIMIT 1
        ) AS thumbnail
      FROM products AS p
      INNER JOIN shop_profiles AS sp ON sp.shop_id = p.shop_id
      INNER JOIN categories AS c ON c.category_id = p.category_id
      WHERE ${whereClause}
      ORDER BY p.product_id DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<ProductRecord>()

    return c.json({
      success: true,
      data: result.results || [],
      pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Get products error:', error)
    return c.json({ success: false, message: 'Không thể tải danh sách sản phẩm' }, 500)
  }
})

products.get('/:id', zValidator('param', idParamSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const product = await getProductById(c.env.DB, id)
    if (!product || product.status !== 'active') {
      return c.json({ success: false, message: 'Không tìm thấy sản phẩm' }, 404)
    }

    const media = await c.env.DB.prepare(`
      SELECT media_id AS id, url, type, is_thumbnail, priority
      FROM media
      WHERE product_id = ?
      ORDER BY is_thumbnail DESC, priority ASC, media_id ASC
    `).bind(id).all()

    const variants = await c.env.DB.prepare(`
      SELECT
        pv.variant_id AS id,
        pv.price,
        pv.sale_price,
        pv.stock_quantity,
        pv.sku,
        pv.status,
        GROUP_CONCAT(og.group_name || ': ' || ov.value_name, ', ') AS variant_name
      FROM product_variants AS pv
      LEFT JOIN variant_values AS vv ON vv.variant_id = pv.variant_id
      LEFT JOIN option_values AS ov ON ov.value_id = vv.value_id
      LEFT JOIN option_groups AS og ON og.group_id = ov.group_id
      WHERE pv.product_id = ?
      GROUP BY pv.variant_id, pv.price, pv.sale_price, pv.stock_quantity, pv.sku, pv.status
      ORDER BY pv.variant_id ASC
    `).bind(id).all()

    return c.json({ success: true, data: { ...product, media: media.results || [], variants: variants.results || [] } })
  } catch (error) {
    console.error('Get product detail error:', error)
    return c.json({ success: false, message: 'Không thể tải chi tiết sản phẩm' }, 500)
  }
})

products.post('/', authMiddleware, requireProductManager, zValidator('json', createProductSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const body = c.req.valid('json')
    const shopId = payload.role === 'shop' ? Number(payload.sub) : body.shop_id

    if (!shopId) return c.json({ success: false, message: 'Admin phải cung cấp shop_id' }, 400)
    if (!await validateApprovedShop(c.env.DB, shopId)) {
      return c.json({ success: false, message: 'Shop không tồn tại hoặc chưa được phê duyệt' }, 400)
    }
    if (!await validateCategory(c.env.DB, body.category_id)) {
      return c.json({ success: false, message: 'Danh mục không tồn tại hoặc đã bị vô hiệu hóa' }, 400)
    }

    const slugExists = await c.env.DB.prepare(`
      SELECT product_id AS id FROM products WHERE slug = ? LIMIT 1
    `).bind(body.slug).first<ExistingIdRecord>()
    if (slugExists) return c.json({ success: false, message: 'Slug sản phẩm đã tồn tại' }, 409)

    const result = await c.env.DB.prepare(`
      INSERT INTO products (
        shop_id, category_id, name, slug, price, sale_price,
        description, usage_guide, stock_quantity, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))
    `).bind(
      shopId,
      body.category_id,
      body.name,
      body.slug,
      body.price,
      body.sale_price ?? null,
      body.description ?? null,
      body.usage_guide ?? null,
      body.stock_quantity,
      body.status
    ).run()

    const productId = Number(result.meta.last_row_id)
    if (body.thumbnail_url) {
      await c.env.DB.prepare(`
        INSERT INTO media (product_id, url, type, is_thumbnail, priority, created_at)
        VALUES (?, ?, 'image', 1, 0, DATETIME('now'))
      `).bind(productId, body.thumbnail_url).run()
    }

    return c.json({ success: true, message: 'Thêm sản phẩm thành công', data: await getProductById(c.env.DB, productId) }, 201)
  } catch (error) {
    console.error('Create product error:', error)
    return c.json({ success: false, message: 'Không thể thêm sản phẩm' }, 500)
  }
})

products.put('/:id', authMiddleware, requireProductManager, zValidator('param', idParamSchema), zValidator('json', updateProductSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const payload = c.get('jwtPayload')
    const body = c.req.valid('json')
    const existing = await getProductOwnership(c.env.DB, id)

    if (!existing) return c.json({ success: false, message: 'Không tìm thấy sản phẩm' }, 404)
    if (!canManageProduct(payload, existing.shop_id)) {
      return c.json({ success: false, message: 'Bạn không có quyền chỉnh sửa sản phẩm này' }, 403)
    }

    if (body.category_id !== undefined && !await validateCategory(c.env.DB, body.category_id)) {
      return c.json({ success: false, message: 'Danh mục không tồn tại hoặc đã bị vô hiệu hóa' }, 400)
    }

    if (body.slug !== undefined) {
      const slugExists = await c.env.DB.prepare(`
        SELECT product_id AS id FROM products WHERE slug = ? AND product_id <> ? LIMIT 1
      `).bind(body.slug, id).first<ExistingIdRecord>()
      if (slugExists) return c.json({ success: false, message: 'Slug sản phẩm đã tồn tại' }, 409)
    }

    const fields: string[] = []
    const values: Array<string | number | null> = []
    const mappings: Array<[keyof typeof body, string]> = [
      ['category_id', 'category_id'], ['name', 'name'], ['slug', 'slug'], ['price', 'price'],
      ['sale_price', 'sale_price'], ['description', 'description'], ['usage_guide', 'usage_guide'],
      ['stock_quantity', 'stock_quantity'], ['status', 'status']
    ]

    for (const [key, column] of mappings) {
      const value = body[key]
      if (value !== undefined) {
        fields.push(`${column} = ?`)
        values.push(value as string | number | null)
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = DATETIME('now')")
      values.push(id)
      await c.env.DB.prepare(`
        UPDATE products SET ${fields.join(', ')} WHERE product_id = ? AND deleted_at IS NULL
      `).bind(...values).run()
    }

    if (body.thumbnail_url !== undefined) {
      await c.env.DB.prepare('UPDATE media SET is_thumbnail = 0 WHERE product_id = ?').bind(id).run()
      if (body.thumbnail_url !== null) {
        const mediaExists = await c.env.DB.prepare(`
          SELECT media_id AS id FROM media WHERE product_id = ? AND url = ? AND type = 'image' LIMIT 1
        `).bind(id, body.thumbnail_url).first<ExistingIdRecord>()

        if (mediaExists) {
          await c.env.DB.prepare('UPDATE media SET is_thumbnail = 1, priority = 0 WHERE media_id = ?').bind(mediaExists.id).run()
        } else {
          await c.env.DB.prepare(`
            INSERT INTO media (product_id, url, type, is_thumbnail, priority, created_at)
            VALUES (?, ?, 'image', 1, 0, DATETIME('now'))
          `).bind(id, body.thumbnail_url).run()
        }
      }
    }

    if (fields.length === 0 && body.thumbnail_url === undefined) {
      return c.json({ success: false, message: 'Không có thông tin nào thay đổi' }, 400)
    }

    return c.json({ success: true, message: 'Cập nhật sản phẩm thành công', data: await getProductById(c.env.DB, id) })
  } catch (error) {
    console.error('Update product error:', error)
    return c.json({ success: false, message: 'Không thể cập nhật sản phẩm' }, 500)
  }
})

products.delete('/:id', authMiddleware, requireProductManager, zValidator('param', idParamSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const payload = c.get('jwtPayload')
    const existing = await getProductOwnership(c.env.DB, id)

    if (!existing) return c.json({ success: false, message: 'Sản phẩm không tồn tại' }, 404)
    if (!canManageProduct(payload, existing.shop_id)) {
      return c.json({ success: false, message: 'Bạn không có quyền xóa sản phẩm này' }, 403)
    }

    await c.env.DB.prepare(`
      UPDATE products
      SET status = 'inactive', deleted_at = DATETIME('now'), updated_at = DATETIME('now')
      WHERE product_id = ? AND deleted_at IS NULL
    `).bind(id).run()

    await c.env.DB.prepare('DELETE FROM cart_items WHERE product_id = ?').bind(id).run()

    return c.json({ success: true, message: 'Đã xóa sản phẩm thành công' })
  } catch (error) {
    console.error('Delete product error:', error)
    return c.json({ success: false, message: 'Không thể xóa sản phẩm' }, 500)
  }
})

export default products