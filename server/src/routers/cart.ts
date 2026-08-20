import { and, desc, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'

import { cartItems, media, products, productVariants } from '../db/schema'
import { authMiddleware, type AppEnv } from '../middlewares/auth'

const cartRouter = new Hono<AppEnv>()


cartRouter.post('/', authMiddleware, async (c) => {
  const user = c.get('authUser')

  if (user.role !== 'customer') {
    return c.json({ success: false, message: 'Chỉ tài khoản khách hàng mới có thể thêm vào giỏ hàng' }, 403)
  }

  const body = await c.req.json<{ product_id?: unknown; quantity?: unknown }>().catch(() => null)
  const productId = Number(body?.product_id)
  const quantity = Number(body?.quantity ?? 1)

  if (!Number.isInteger(productId) || productId <= 0) {
    return c.json({ success: false, message: 'Sản phẩm không hợp lệ' }, 400)
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return c.json({ success: false, message: 'Số lượng phải lớn hơn 0' }, 400)
  }

  const product = await c.env.DB.prepare(`
    SELECT
      p.product_id AS id,
      COALESCE((
        SELECT SUM(wi.quantity)
        FROM warehouse_inventory AS wi
        WHERE wi.product_id = p.product_id
      ), 0) AS stock_quantity
    FROM products AS p
    INNER JOIN shop_profiles AS sp ON sp.shop_id = p.shop_id
    INNER JOIN categories AS c ON c.category_id = p.category_id
    WHERE p.product_id = ?
      AND p.deleted_at IS NULL
      AND p.status = 'active'
      AND sp.approval_status = 'approved'
      AND c.status = 1
    LIMIT 1
  `).bind(productId).first<{ id: number; stock_quantity: number }>()

  if (!product) {
    return c.json({ success: false, message: 'Sản phẩm không còn khả dụng' }, 404)
  }

  const existing = await c.env.DB.prepare(`
    SELECT cart_item_id AS id, quantity
    FROM cart_items
    WHERE customer_id = ? AND product_id = ? AND variant_id IS NULL
    LIMIT 1
  `).bind(user.userId, productId).first<{ id: number; quantity: number }>()

  const nextQuantity = Number(existing?.quantity || 0) + quantity
  if (nextQuantity > Number(product.stock_quantity || 0)) {
    return c.json({ success: false, message: 'Số lượng trong giỏ vượt quá tồn kho hiện có' }, 409)
  }

  if (existing) {
    await c.env.DB.prepare(`
      UPDATE cart_items
      SET quantity = ?, updated_at = DATETIME('now')
      WHERE cart_item_id = ?
    `).bind(nextQuantity, existing.id).run()
  } else {
    await c.env.DB.prepare(`
      INSERT INTO cart_items (customer_id, product_id, variant_id, quantity)
      VALUES (?, ?, NULL, ?)
    `).bind(user.userId, productId, quantity).run()
  }

  return c.json({
    success: true,
    data: {
      product_id: productId,
      quantity: nextQuantity,
    },
  }, existing ? 200 : 201)
})

cartRouter.get('/', authMiddleware, async (c) => {
  const user = c.get('authUser')

  if (user.role !== 'customer') {
    return c.json({
      success: true,
      data: {
        items: [],
        total_items: 0,
        total_lines: 0,
      },
    })
  }

  const db = drizzle(c.env.DB)
  const rows = await db
    .select({
      id: cartItems.cartItemId,
      productId: cartItems.productId,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      updatedAt: cartItems.updatedAt,
      name: products.name,
      productPrice: products.price,
      productSalePrice: products.salePrice,
      variantPrice: productVariants.price,
      variantSalePrice: productVariants.salePrice,
      thumbnail: media.url,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.productId, cartItems.productId))
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, cartItems.productId),
        eq(productVariants.variantId, cartItems.variantId),
      ),
    )
    .leftJoin(
      media,
      and(eq(media.productId, products.productId), eq(media.isThumbnail, true)),
    )
    .where(
      and(
        eq(cartItems.customerId, user.userId),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(desc(cartItems.updatedAt), desc(cartItems.cartItemId))

  const items = rows.map((row) => {
    const basePrice = row.variantId !== null
      ? (row.variantPrice ?? row.productPrice)
      : row.productPrice
    const salePrice = row.variantId !== null
      ? row.variantSalePrice
      : row.productSalePrice
    const price = salePrice !== null && salePrice < basePrice ? salePrice : basePrice

    return {
      id: row.id,
      product_id: row.productId,
      variant_id: row.variantId,
      quantity: row.quantity,
      name: row.name,
      price,
      thumbnail: row.thumbnail,
    }
  })

  return c.json({
    success: true,
    data: {
      items,
      total_items: items.reduce((total, item) => total + item.quantity, 0),
      total_lines: items.length,
    },
  })
})

export default cartRouter
