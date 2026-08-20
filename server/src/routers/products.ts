import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createProductSchema,
  productMediaDeleteQuerySchema,
  productMediaUploadMetadataSchema,
  productIdParamSchema as idParamSchema,
  updateProductSchema,
} from '../validators/product.validator'
import { verify } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'

type UserRole = 'customer' | 'shop' | 'admin'
type ProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock'
type ProductSortField =
  | 'id'
  | 'name'
  | 'category'
  | 'price'
  | 'stock'
  | 'status'
  | 'updated_at'

type Env = {
  Bindings: {
    DB: D1Database
    JWT_SECRET: string
    PRODUCT_MEDIA: R2Bucket
  }
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
interface ExistingSkuRecord { sku: string }
interface ManagedVariantRecord {
  id: number
  sku: string
  price: number
  sale_price: number | null
  status: ProductStatus
  stock_quantity: number
}

const products = new Hono<Env>()

const productSortColumns: Record<ProductSortField, string> = {
  id: 'p.product_id',
  name: 'p.name COLLATE NOCASE',
  category: 'c.category_name COLLATE NOCASE',
  price: 'COALESCE(p.sale_price, p.price)',
  stock: 'stock_quantity',
  status: 'p.status',
  updated_at: 'p.updated_at',
}

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
  if (!token) return c.json({ success: false, message: 'Vui lòng đăng nhập để thực hiện' }, 401)

  try {
    const payload = await verify(token, getJwtSecret(c.env), 'HS256') as unknown as JwtPayload
    const userId = Number(payload.sub)
    if (!Number.isInteger(userId) || userId <= 0 || !['customer', 'shop', 'admin'].includes(payload.role)) {
      return c.json({ success: false, message: 'Token không hợp lệ' }, 401)
    }
    c.set('jwtPayload', payload)
    await next()
  } catch {
    return c.json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' }, 401)
  }
})

const requireProductManager = createMiddleware<Env>(async (c, next) => {
  const user = c.get('jwtPayload')
  if (user.role !== 'shop' && user.role !== 'admin') {
    return c.json({ success: false, message: 'Bạn không có quyền quản lý sản phẩm' }, 403)
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
    COALESCE((
      SELECT SUM(wi.quantity)
      FROM warehouse_inventory AS wi
      WHERE wi.product_id = p.product_id
    ), 0) AS stock_quantity,
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
    const random = c.req.query('random') === '1'

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

    if (random) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM warehouse_inventory AS wi
        WHERE wi.product_id = p.product_id
          AND wi.quantity > 0
      )`)
    }

    const whereClause = conditions.join(' AND ')
    const orderByClause = random ? 'RANDOM()' : 'p.product_id DESC'
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
        COALESCE((
          SELECT SUM(wi.quantity)
          FROM warehouse_inventory AS wi
          WHERE wi.product_id = p.product_id
        ), 0) AS stock_quantity,
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
      ORDER BY ${orderByClause}
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



products.get(
  '/shop/:id/categories',
  zValidator('param', idParamSchema),
  async (c) => {
    try {
      const { id: shopId } = c.req.valid('param')

      const shop = await c.env.DB.prepare(`
        SELECT sp.shop_id AS id
        FROM shop_profiles AS sp
        INNER JOIN users AS u ON u.user_id = sp.shop_id
        WHERE sp.shop_id = ?
          AND sp.approval_status = 'approved'
          AND u.status = 'active'
          AND u.deleted_at IS NULL
        LIMIT 1
      `).bind(shopId).first<ExistingIdRecord>()

      if (!shop) {
        return c.json({ success: false, message: 'Không tìm thấy shop' }, 404)
      }

      const result = await c.env.DB.prepare(`
        SELECT
          c.category_id AS id,
          c.category_name AS name,
          c.slug,
          COUNT(p.product_id) AS product_count
        FROM products AS p
        INNER JOIN categories AS c ON c.category_id = p.category_id
        WHERE p.shop_id = ?
          AND p.deleted_at IS NULL
          AND p.status = 'active'
          AND c.status = 1
        GROUP BY c.category_id, c.category_name, c.slug
        ORDER BY c.category_name COLLATE NOCASE ASC
      `).bind(shopId).all<{
        id: number
        name: string
        slug: string
        product_count: number
      }>()

      return c.json({
        success: true,
        data: result.results ?? [],
      })
    } catch (error) {
      console.error('Get shop categories error:', error)
      return c.json({ success: false, message: 'Không thể tải danh mục gian hàng' }, 500)
    }
  },
)

products.get(
  '/manage/me',
  authMiddleware,
  requireProductManager,
  async (c) => {
    try {
      const payload = c.get('jwtPayload')

      if (payload.role !== 'shop') {
        return c.json(
          {
            success: false,
            message: 'Route này chỉ dành cho tài khoản shop',
          },
          403,
        )
      }

      const shopId = Number(payload.sub)

      if (
        !Number.isInteger(shopId) ||
        shopId <= 0
      ) {
        return c.json(
          {
            success: false,
            message: 'Shop không hợp lệ',
          },
          400,
        )
      }

      const pageValue = Number(
        c.req.query('page') ?? '1',
      )
      const limitValue = Number(
        c.req.query('limit') ?? '10',
      )

      const page =
        Number.isInteger(pageValue) &&
        pageValue > 0
          ? pageValue
          : 1

      const limit =
        Number.isInteger(limitValue) &&
        limitValue > 0
          ? Math.min(limitValue, 100)
          : 10

      const offset = (page - 1) * limit
      const search =
        c.req.query('search')?.trim() ?? ''
      const status = c.req.query('status')
      const sortByValue =
        c.req.query('sort_by') ?? 'id'
      const sortOrderValue =
        c.req.query('sort_order') ?? 'desc'

      if (!(sortByValue in productSortColumns)) {
        return c.json(
          {
            success: false,
            message: 'Cột sắp xếp sản phẩm không hợp lệ',
          },
          400,
        )
      }

      if (!['asc', 'desc'].includes(sortOrderValue)) {
        return c.json(
          {
            success: false,
            message: 'Chiều sắp xếp sản phẩm không hợp lệ',
          },
          400,
        )
      }

      const sortBy = sortByValue as ProductSortField
      const orderBy = productSortColumns[sortBy]
      const sortDirection = sortOrderValue.toUpperCase()

      const conditions = [
        'p.shop_id = ?',
        'p.deleted_at IS NULL',
      ]

      const params: Array<string | number> = [
        shopId,
      ]

      if (search) {
        conditions.push(
          '(p.name LIKE ? OR p.slug LIKE ?)',
        )

        params.push(
          `%${search}%`,
          `%${search}%`,
        )
      }

      if (status) {
        if (
          ![
            'draft',
            'active',
            'inactive',
            'out_of_stock',
          ].includes(status)
        ) {
          return c.json(
            {
              success: false,
              message: 'Trạng thái sản phẩm không hợp lệ',
            },
            400,
          )
        }

        conditions.push('p.status = ?')
        params.push(status)
      }

      const whereClause =
        conditions.join(' AND ')

      const count = await c.env.DB
        .prepare(`
          SELECT COUNT(*) AS total
          FROM products AS p
          WHERE ${whereClause}
        `)
        .bind(...params)
        .first<CountRecord>()

      const total = Number(
        count?.total ?? 0,
      )

      const result = await c.env.DB
        .prepare(`
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
            p.created_at,
            p.updated_at,
            (
              SELECT m.url
              FROM media AS m
              WHERE m.product_id = p.product_id
                AND m.type = 'image'
              ORDER BY
                m.is_thumbnail DESC,
                m.priority ASC,
                m.media_id ASC
              LIMIT 1
            ) AS thumbnail
          FROM products AS p
          INNER JOIN shop_profiles AS sp
            ON sp.shop_id = p.shop_id
          INNER JOIN categories AS c
            ON c.category_id = p.category_id
          WHERE ${whereClause}
          ORDER BY
            ${orderBy} ${sortDirection},
            p.product_id DESC
          LIMIT ? OFFSET ?
        `)
        .bind(
          ...params,
          limit,
          offset,
        )
        .all<ProductRecord>()

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
              : Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error(
        'Get shop products error:',
        error,
      )

      return c.json(
        {
          success: false,
          message:
            'Không thể tải sản phẩm của cửa hàng',
        },
        500,
      )
    }
  },
)

products.get(
  '/manage/:id',
  authMiddleware,
  requireProductManager,
  zValidator('param', idParamSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const payload = c.get('jwtPayload')
      const ownership = await getProductOwnership(c.env.DB, id)

      if (!ownership) {
        return c.json({ success: false, message: 'Không tìm thấy sản phẩm' }, 404)
      }
      if (!canManageProduct(payload, ownership.shop_id)) {
        return c.json({ success: false, message: 'Bạn không có quyền chỉnh sửa sản phẩm này' }, 403)
      }

      const [product, mediaResult, variantResult] = await Promise.all([
        getProductById(c.env.DB, id),
        c.env.DB.prepare(`
          SELECT
            media_id AS id,
            url,
            type,
            is_thumbnail,
            priority,
            CASE WHEN priority >= 100 THEN 'description' ELSE 'gallery' END AS purpose
          FROM media
          WHERE product_id = ?
          ORDER BY priority ASC, media_id ASC
        `).bind(id).all(),
        c.env.DB.prepare(`
          SELECT
            pv.variant_id AS id,
            pv.sku,
            pv.price,
            pv.sale_price,
            pv.status,
            COALESCE((
              SELECT SUM(wi.quantity)
              FROM warehouse_inventory AS wi
              WHERE wi.product_id = pv.product_id
                AND wi.variant_id = pv.variant_id
            ), 0) AS stock_quantity
          FROM product_variants AS pv
          WHERE pv.product_id = ?
          ORDER BY pv.variant_id ASC
        `).bind(id).all<ManagedVariantRecord>(),
      ])

      if (!product) {
        return c.json({ success: false, message: 'Không tìm thấy sản phẩm' }, 404)
      }

      const variants = await Promise.all((variantResult.results ?? []).map(async (variant) => {
        const options = await c.env.DB.prepare(`
          SELECT og.group_name, ov.value_name
          FROM variant_values AS vv
          INNER JOIN option_values AS ov ON ov.value_id = vv.value_id
          INNER JOIN option_groups AS og ON og.group_id = ov.group_id
          WHERE vv.variant_id = ?
          ORDER BY og.group_id ASC, ov.value_id ASC
        `).bind(variant.id).all<{ group_name: string; value_name: string }>()

        return { ...variant, options: options.results ?? [] }
      }))

      return c.json({
        success: true,
        data: {
          ...product,
          stock_quantity: Number(product.stock_quantity ?? 0),
          media: (mediaResult.results ?? []).map((item: any) => ({
            ...item,
            is_thumbnail: Boolean(item.is_thumbnail),
          })),
          variants,
        },
      })
    } catch (error) {
      console.error('Get managed product detail error:', error)
      return c.json({ success: false, message: 'Không thể tải dữ liệu chỉnh sửa sản phẩm' }, 500)
    }
  },
)

products.post(
  '/manage/media',
  authMiddleware,
  requireProductManager,
  async (c) => {
    try {
      const payload = c.get('jwtPayload')
      if (payload.role !== 'shop') {
        return c.json({ success: false, message: 'Chỉ shop mới được tải media sản phẩm' }, 403)
      }

      const body = await c.req.parseBody()
      const file = body.file

      if (!(file instanceof File)) {
        return c.json({ success: false, message: 'Vui lòng chọn một file hợp lệ' }, 400)
      }

      const metadata = productMediaUploadMetadataSchema.safeParse({
        name: file.name,
        type: file.type,
        size: file.size,
      })
      if (!metadata.success) {
        return c.json({
          success: false,
          message: metadata.error.issues[0]?.message ?? 'Media không hợp lệ',
        }, 400)
      }
      const isImage = metadata.data.type.startsWith('image/')

      const extensionByType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
      }
      const shopId = Number(payload.sub)
      const key = `product/${shopId}/${crypto.randomUUID()}.${extensionByType[file.type]}`

      await c.env.PRODUCT_MEDIA.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          shopId: String(shopId),
          originalName: file.name.slice(0, 180),
        },
      })

      const origin = new URL(c.req.url).origin
      return c.json({
        success: true,
        data: {
          key,
          url: `${origin}/product/media/${key.split('/').map(encodeURIComponent).join('/')}`,
          type: isImage ? 'image' : 'video',
          size: file.size,
        },
      }, 201)
    } catch (error) {
      console.error('Upload product media error:', error)
      return c.json({ success: false, message: 'Không thể tải media sản phẩm' }, 500)
    }
  },
)

products.delete(
  '/manage/media',
  authMiddleware,
  requireProductManager,
  zValidator('query', productMediaDeleteQuerySchema),
  async (c) => {
    try {
      const payload = c.get('jwtPayload')
      if (payload.role !== 'shop') {
        return c.json({ success: false, message: 'Chỉ shop mới được xóa media tải lên' }, 403)
      }

      const { key } = c.req.valid('query')
      const expectedPrefix = `product/${Number(payload.sub)}/`
      if (!key.startsWith(expectedPrefix)) {
        return c.json({ success: false, message: 'Bạn không có quyền xóa media này' }, 403)
      }

      await c.env.PRODUCT_MEDIA.delete(key)
      return c.json({ success: true })
    } catch (error) {
      console.error('Delete product media error:', error)
      return c.json({ success: false, message: 'Không thể xóa media' }, 500)
    }
  },
)

products.get('/media/*', async (c) => {
  try {
    const prefix = '/product/media/'
    const pathname = new URL(c.req.url).pathname
    const encodedKey = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
    const key = encodedKey
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/')

    if (!key.startsWith('product/')) {
      return c.json({ success: false, message: 'Đường dẫn media không hợp lệ' }, 400)
    }

    const object = await c.env.PRODUCT_MEDIA.get(key)
    if (!object) return c.json({ success: false, message: 'Không tìm thấy media' }, 404)

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('cache-control', 'public, max-age=31536000, immutable')
    return new Response(object.body, { headers })
  } catch (error) {
    console.error('Get product media error:', error)
    return c.json({ success: false, message: 'Không thể tải media' }, 500)
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
        pv.sku,
        pv.status,
        COALESCE((
          SELECT SUM(wi.quantity)
          FROM warehouse_inventory AS wi
          WHERE wi.product_id = pv.product_id
            AND wi.variant_id = pv.variant_id
        ), 0) AS stock_quantity,
        GROUP_CONCAT(og.group_name || ': ' || ov.value_name, ', ') AS variant_name
      FROM product_variants AS pv
      LEFT JOIN variant_values AS vv ON vv.variant_id = pv.variant_id
      LEFT JOIN option_values AS ov ON ov.value_id = vv.value_id
      LEFT JOIN option_groups AS og ON og.group_id = ov.group_id
      WHERE pv.product_id = ?
      GROUP BY pv.variant_id, pv.price, pv.sale_price, pv.sku, pv.status
      ORDER BY pv.variant_id ASC
    `).bind(id).all()

    return c.json({ success: true, data: { ...product, media: media.results || [], variants: variants.results || [] } })
  } catch (error) {
    console.error('Get product detail error:', error)
    return c.json({ success: false, message: 'Không thể tải chi tiết sản phẩm' }, 500)
  }
})

products.post('/', authMiddleware, requireProductManager, zValidator('json', createProductSchema), async (c) => {
  let productId: number | null = null

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

    const variants = body.variants ?? []

    if (variants.length > 0) {
      const skuPlaceholders = variants.map(() => '?').join(', ')
      const existingSku = await c.env.DB.prepare(`
        SELECT sku
        FROM product_variants
        WHERE lower(sku) IN (${skuPlaceholders})
        LIMIT 1
      `)
        .bind(...variants.map((variant) => variant.sku.toLowerCase()))
        .first<ExistingSkuRecord>()

      if (existingSku) {
        return c.json(
          { success: false, message: `SKU variant đã tồn tại: ${existingSku.sku}` },
          409,
        )
      }
    }

    const slugExists = await c.env.DB.prepare(`
      SELECT product_id AS id FROM products WHERE slug = ? LIMIT 1
    `).bind(body.slug).first<ExistingIdRecord>()
    if (slugExists) return c.json({ success: false, message: 'Slug sản phẩm đã tồn tại' }, 409)

    const result = await c.env.DB.prepare(`
      INSERT INTO products (
        shop_id, category_id, name, slug, price, sale_price,
        description, usage_guide, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))
    `).bind(
      shopId,
      body.category_id,
      body.name,
      body.slug,
      body.price,
      body.sale_price ?? null,
      body.description ?? null,
      body.usage_guide ?? null,
      body.status
    ).run()

    productId = Number(result.meta.last_row_id)

    if (variants.length > 0) {
      const optionGroupsByName = new Map<
        string,
        { groupName: string; values: Map<string, string> }
      >()

      for (const variant of variants) {
        for (const option of variant.options) {
          const groupKey = option.group_name.trim().toLowerCase()
          const valueKey = option.value_name.trim().toLowerCase()
          const group = optionGroupsByName.get(groupKey) ?? {
            groupName: option.group_name,
            values: new Map<string, string>(),
          }

          group.values.set(valueKey, option.value_name)
          optionGroupsByName.set(groupKey, group)
        }
      }

      const groupIdByName = new Map<string, number>()
      const valueIdByOption = new Map<string, number>()

      for (const [groupKey, optionGroup] of optionGroupsByName) {
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO option_groups (group_name, created_at)
          VALUES (?, DATETIME('now'))
        `).bind(optionGroup.groupName).run()

        const group = await c.env.DB.prepare(`
          SELECT group_id AS id
          FROM option_groups
          WHERE lower(trim(group_name)) = lower(trim(?))
          LIMIT 1
        `).bind(optionGroup.groupName).first<ExistingIdRecord>()

        if (!group) throw new Error('Không thể tạo nhóm phân loại')
        groupIdByName.set(groupKey, group.id)

        for (const [valueKey, valueName] of optionGroup.values) {
          await c.env.DB.prepare(`
            INSERT OR IGNORE INTO option_values (group_id, value_name)
            VALUES (?, ?)
          `).bind(group.id, valueName).run()

          const value = await c.env.DB.prepare(`
            SELECT value_id AS id
            FROM option_values
            WHERE group_id = ?
              AND lower(trim(value_name)) = lower(trim(?))
            LIMIT 1
          `).bind(group.id, valueName).first<ExistingIdRecord>()

          if (!value) throw new Error('Không thể tạo giá trị phân loại')
          valueIdByOption.set(`${groupKey}\u0000${valueKey}`, value.id)
        }
      }

      const resolvedVariants = variants.map((variant) => ({
        variant,
        groupIds: variant.options.map((option) =>
          groupIdByName.get(option.group_name.trim().toLowerCase())!,
        ),
        valueIds: variant.options.map((option) =>
          valueIdByOption.get(
            `${option.group_name.trim().toLowerCase()}\u0000${option.value_name.trim().toLowerCase()}`,
          )!,
        ),
      }))

      const productGroupIds = [
        ...new Set(resolvedVariants.flatMap((item) => item.groupIds)),
      ]

      await c.env.DB.batch(
        productGroupIds.map((groupId) =>
          c.env.DB.prepare(`
            INSERT INTO product_options (product_id, group_id)
            VALUES (?, ?)
          `).bind(productId, groupId),
        ),
      )

      for (const { variant, valueIds } of resolvedVariants) {
        const variantResult = await c.env.DB.prepare(`
          INSERT INTO product_variants (
            product_id, price, sale_price, sku, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))
        `).bind(
          productId,
          variant.price,
          variant.sale_price ?? null,
          variant.sku,
          variant.status,
        ).run()

        const variantId = Number(variantResult.meta.last_row_id)

        await c.env.DB.batch(
          valueIds.map((valueId) =>
            c.env.DB.prepare(`
              INSERT INTO variant_values (variant_id, value_id)
              VALUES (?, ?)
            `).bind(variantId, valueId),
          ),
        )
      }
    }

    const submittedMedia = body.media.length
      ? body.media
      : body.thumbnail_url
        ? [{
            url: body.thumbnail_url,
            type: 'image' as const,
            purpose: 'gallery' as const,
          }]
        : []

    if (submittedMedia.length) {
      let galleryImageIndex = 0
      let descriptionImageIndex = 0
      let videoIndex = 0

      const mediaStatements = submittedMedia.map((item) => {
        const isThumbnail =
          item.type === 'image' &&
          item.purpose === 'gallery' &&
          galleryImageIndex === 0
        const priority = item.purpose === 'description'
          ? 100 + descriptionImageIndex++
          : item.type === 'video'
            ? 50 + videoIndex++
            : galleryImageIndex++

        return c.env.DB.prepare(`
          INSERT INTO media (
            product_id, url, type, is_thumbnail, priority, created_at
          ) VALUES (?, ?, ?, ?, ?, DATETIME('now'))
        `).bind(
          productId,
          item.url,
          item.type,
          isThumbnail ? 1 : 0,
          priority,
        )
      })

      await c.env.DB.batch(mediaStatements)
    }

    return c.json({ success: true, message: 'Thêm sản phẩm thành công', data: await getProductById(c.env.DB, productId) }, 201)
  } catch (error) {
    console.error('Create product error:', error)

    if (productId !== null) {
      try {
        await c.env.DB.batch([
          c.env.DB.prepare('DELETE FROM media WHERE product_id = ?').bind(productId),
          c.env.DB.prepare('DELETE FROM products WHERE product_id = ?').bind(productId),
        ])
      } catch (rollbackError) {
        console.error('Rollback product error:', rollbackError)
      }
    }

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

    if (body.variants.length) {
      const placeholders = body.variants.map(() => '?').join(', ')
      const duplicateSku = await c.env.DB.prepare(`
        SELECT pv.sku
        FROM product_variants AS pv
        WHERE lower(pv.sku) IN (${placeholders}) AND pv.product_id <> ?
        LIMIT 1
      `).bind(
        ...body.variants.map((variant) => variant.sku.toLowerCase()),
        id,
      ).first<ExistingSkuRecord>()

      if (duplicateSku) {
        return c.json({ success: false, message: `SKU variant đã tồn tại: ${duplicateSku.sku}` }, 409)
      }
    }

    await c.env.DB.prepare(`
      UPDATE products
      SET category_id = ?, name = ?, slug = ?, price = ?, sale_price = ?,
          description = ?, usage_guide = ?, status = ?, updated_at = DATETIME('now')
      WHERE product_id = ? AND deleted_at IS NULL
    `).bind(
      body.category_id,
      body.name,
      body.slug,
      body.price,
      body.sale_price ?? null,
      body.description ?? null,
      body.usage_guide ?? null,
      body.status,
      id,
    ).run()

    const currentVariants = await c.env.DB.prepare(`
      SELECT variant_id AS id
      FROM product_variants
      WHERE product_id = ?
    `).bind(id).all<ExistingIdRecord>()
    const currentVariantIds = new Set((currentVariants.results ?? []).map((item) => item.id))
    const submittedVariantIds = body.variants
      .map((variant) => variant.id)
      .filter((variantId): variantId is number => variantId !== undefined)

    if (submittedVariantIds.some((variantId) => !currentVariantIds.has(variantId))) {
      return c.json({ success: false, message: 'Variant không thuộc sản phẩm này' }, 400)
    }

    const removedVariantIds = [...currentVariantIds]
      .filter((variantId) => !submittedVariantIds.includes(variantId))

    if (removedVariantIds.length > 0) {
      const placeholders = removedVariantIds.map(() => '?').join(', ')
      const inventory = await c.env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM warehouse_inventory
        WHERE product_id = ?
          AND variant_id IN (${placeholders})
          AND (quantity > 0 OR reserved_quantity > 0)
      `).bind(id, ...removedVariantIds).first<CountRecord>()

      if (Number(inventory?.total ?? 0) > 0) {
        return c.json({
          success: false,
          message: 'Không thể xóa phân loại đang có tồn kho. Hãy xử lý tồn kho qua quy trình kho trước.',
        }, 409)
      }
    }

    if (body.variants.length > 0) {
      const simpleInventory = await c.env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM warehouse_inventory
        WHERE product_id = ?
          AND variant_id IS NULL
          AND (quantity > 0 OR reserved_quantity > 0)
      `).bind(id).first<CountRecord>()

      if (Number(simpleInventory?.total ?? 0) > 0) {
        return c.json({
          success: false,
          message: 'Không thể thêm phân loại khi sản phẩm thường đang có tồn kho. Hãy xử lý tồn kho qua quy trình kho trước.',
        }, 409)
      }
    }

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM product_options WHERE product_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM media WHERE product_id = ?').bind(id),
    ])

    if (!body.variants.length) {
      await c.env.DB.prepare(`
        UPDATE product_variants
        SET status = 'inactive', updated_at = DATETIME('now')
        WHERE product_id = ?
      `).bind(id).run()
    } else {
      const groupIds = new Map<string, number>()
      const valueIds = new Map<string, number>()

      for (const variant of body.variants) {
        for (const option of variant.options) {
          const groupKey = option.group_name.trim().toLowerCase()
          const valueKey = `${groupKey}\u0000${option.value_name.trim().toLowerCase()}`

          if (!groupIds.has(groupKey)) {
            await c.env.DB.prepare(`
              INSERT OR IGNORE INTO option_groups (group_name, created_at)
              VALUES (?, DATETIME('now'))
            `).bind(option.group_name).run()
            const group = await c.env.DB.prepare(`
              SELECT group_id AS id FROM option_groups
              WHERE lower(trim(group_name)) = lower(trim(?)) LIMIT 1
            `).bind(option.group_name).first<ExistingIdRecord>()
            if (!group) throw new Error('Không thể tạo nhóm phân loại')
            groupIds.set(groupKey, group.id)
          }

          if (!valueIds.has(valueKey)) {
            const groupId = groupIds.get(groupKey)!
            await c.env.DB.prepare(`
              INSERT OR IGNORE INTO option_values (group_id, value_name)
              VALUES (?, ?)
            `).bind(groupId, option.value_name).run()
            const value = await c.env.DB.prepare(`
              SELECT value_id AS id FROM option_values
              WHERE group_id = ? AND lower(trim(value_name)) = lower(trim(?)) LIMIT 1
            `).bind(groupId, option.value_name).first<ExistingIdRecord>()
            if (!value) throw new Error('Không thể tạo giá trị phân loại')
            valueIds.set(valueKey, value.id)
          }
        }
      }

      await c.env.DB.batch(
        [...new Set(groupIds.values())].map((groupId) =>
          c.env.DB.prepare('INSERT INTO product_options (product_id, group_id) VALUES (?, ?)')
            .bind(id, groupId),
        ),
      )

      for (const variant of body.variants) {
        let variantId = variant.id

        if (variantId) {
          await c.env.DB.batch([
            c.env.DB.prepare(`
              UPDATE product_variants
              SET price = ?, sale_price = ?, sku = ?, status = ?, updated_at = DATETIME('now')
              WHERE variant_id = ? AND product_id = ?
            `).bind(
              variant.price,
              variant.sale_price ?? null,
              variant.sku,
              variant.status,
              variantId,
              id,
            ),
            c.env.DB.prepare('DELETE FROM variant_values WHERE variant_id = ?').bind(variantId),
          ])
        } else {
          const result = await c.env.DB.prepare(`
            INSERT INTO product_variants (
              product_id, price, sale_price, sku, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))
          `).bind(
            id,
            variant.price,
            variant.sale_price ?? null,
            variant.sku,
            variant.status,
          ).run()
          variantId = Number(result.meta.last_row_id)
        }

        const variantValueIds = variant.options.map((option) =>
          valueIds.get(`${option.group_name.trim().toLowerCase()}\u0000${option.value_name.trim().toLowerCase()}`)!,
        )

        await c.env.DB.batch(
          variantValueIds.map((valueId) =>
            c.env.DB.prepare('INSERT INTO variant_values (variant_id, value_id) VALUES (?, ?)')
              .bind(variantId, valueId),
          ),
        )
      }

      if (removedVariantIds.length) {
        await c.env.DB.batch(removedVariantIds.map((variantId) =>
          c.env.DB.prepare(`
            UPDATE product_variants
            SET status = 'inactive', updated_at = DATETIME('now')
            WHERE variant_id = ? AND product_id = ?
          `).bind(variantId, id),
        ))
      }
    }

    let galleryIndex = 0
    let descriptionIndex = 0
    let videoIndex = 0
    if (body.media.length) {
      await c.env.DB.batch(body.media.map((item) => {
        const isThumbnail = item.type === 'image' && item.purpose === 'gallery' && galleryIndex === 0
        const priority = item.purpose === 'description'
          ? 100 + descriptionIndex++
          : item.type === 'video'
            ? 50 + videoIndex++
            : galleryIndex++

        return c.env.DB.prepare(`
          INSERT INTO media (product_id, url, type, is_thumbnail, priority, created_at)
          VALUES (?, ?, ?, ?, ?, DATETIME('now'))
        `).bind(id, item.url, item.type, isThumbnail ? 1 : 0, priority)
      }))
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
