import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, ne, sql} from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { z } from 'zod'

import { createDb } from '../db/client'
import { addresses, customerProfiles,} from '../db/schema'
import type { Bindings } from '../types'
import { addressIdParamSchema, createAddressSchema, updateAddressSchema,} from '../validators/address.validator'

type UserRole =
  | 'customer'
  | 'shop'
  | 'admin'

interface JwtPayload {
  sub: string
  role: UserRole
  email: string
  name: string
  iat?: number
  exp?: number
}

type AppEnv = {
  Bindings: Bindings
  Variables: {
    jwtPayload: JwtPayload
  }
}

type AddressRow =
  typeof addresses.$inferSelect

const addressesRouter = new Hono<AppEnv>()

function getJwtSecret(env: Bindings): string {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET chưa được cấu hình')
  }

  return env.JWT_SECRET
}

function getBearerToken(
  authorization?: string,
): string | null {
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

function toAddressDto(address: AddressRow) {
  return {
    address_id: address.addressId,
    customer_id: address.customerId,
    recipient_name: address.recipientName,
    phone: address.phone,
    province: address.province,
    district: address.district,
    ward: address.ward,
    address_detail: address.addressDetail,
    type: address.type,
    is_default: address.isDefault,
    created_at: address.createdAt,
    updated_at: address.updatedAt,
  }
}

const authMiddleware =
  createMiddleware<AppEnv>(
    async (c, next) => {
      const token = getBearerToken(
        c.req.header('Authorization'),
      )

      if (!token) {
        return c.json(
          {
            success: false,
            message: 'Vui lòng đăng nhập để thực hiện',
          },
          401,
        )
      }

      try {
        const payload = (
          await verify(
            token,
            getJwtSecret(c.env),
            'HS256',
          )
        ) as unknown as JwtPayload

        const userId = Number(payload.sub)

        if (
          !Number.isInteger(userId) ||
          userId <= 0
        ) {
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
              user_id,
              role,
              status,
              deleted_at
            FROM users
            WHERE user_id = ?
            LIMIT 1
          `)
          .bind(userId)
          .first<{
            user_id: number
            role: UserRole
            status:
              | 'pending'
              | 'active'
              | 'blocked'
              | 'deleted'
            deleted_at: string | null
          }>()

        if (
          !user ||
          user.status !== 'active' ||
          user.deleted_at !== null
        ) {
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

const requireCustomer =
  createMiddleware<AppEnv>(
    async (c, next) => {
      if (
        c.get('jwtPayload').role !== 'customer'
      ) {
        return c.json(
          {
            success: false,
            message:
              'Chức năng này chỉ dành cho khách hàng',
          },
          403,
        )
      }

      await next()
    },
  )

addressesRouter.use(
  '/me/*',
  authMiddleware,
  requireCustomer,
)

addressesRouter.use(
  '/me',
  authMiddleware,
  requireCustomer,
)

/**
 * GET /address/me
 */
addressesRouter.get(
  '/me',
  async (c) => {
    try {
      const customerId = Number(
        c.get('jwtPayload').sub,
      )

      const db = createDb(c.env.DB)

      const rows = await db
        .select()
        .from(addresses)
        .where(
          eq(
            addresses.customerId,
            customerId,
          ),
        )
        .orderBy(
          desc(addresses.isDefault),
          desc(addresses.updatedAt),
          desc(addresses.addressId),
        )

      return c.json({
        success: true,
        message: 'Lấy danh sách địa chỉ thành công',
        data: rows.map(toAddressDto),
      })
    } catch (error: unknown) {
      console.error(
        'Get customer addresses error:',
        error,
      )

      return c.json(
        {
          success: false,
          message: 'Không thể tải danh sách địa chỉ',
        },
        500,
      )
    }
  },
)

/**
 * POST /address/me
 */
addressesRouter.post(
  '/me',
  zValidator(
    'json',
    createAddressSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            message: 'Dữ liệu địa chỉ không hợp lệ',
            errors:
              z.flattenError(result.error)
                .fieldErrors,
          },
          400,
        )
      }
    },
  ),
  async (c) => {
    try {
      const customerId = Number(
        c.get('jwtPayload').sub,
      )

      const input = c.req.valid('json')
      const db = createDb(c.env.DB)

      const [profile] = await db
        .select({
          customerId:
            customerProfiles.customerId,
        })
        .from(customerProfiles)
        .where(
          eq(
            customerProfiles.customerId,
            customerId,
          ),
        )
        .limit(1)

      if (!profile) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy hồ sơ khách hàng',
          },
          404,
        )
      }

      const [existingAddress] = await db
        .select({
          addressId: addresses.addressId,
        })
        .from(addresses)
        .where(
          eq(
            addresses.customerId,
            customerId,
          ),
        )
        .limit(1)

      /*
       * Địa chỉ đầu tiên luôn là mặc định.
       */
      const shouldBeDefault =
        input.is_default ||
        !existingAddress

      const insertQuery = db
        .insert(addresses)
        .values({
          customerId,
          recipientName: input.recipient_name,
          phone: input.phone,
          province: input.province,
          district: input.district,
          ward: input.ward,
          addressDetail: input.address_detail,
          type: input.type,
          isDefault: shouldBeDefault,
        })
        .returning()

      let created: AddressRow | undefined

      if (shouldBeDefault) {
        const [, insertedRows] =
          await db.batch([
            db
              .update(addresses)
              .set({
                isDefault: false,
                updatedAt:
                  sql`CURRENT_TIMESTAMP`,
              })
              .where(
                eq(
                  addresses.customerId,
                  customerId,
                ),
              ),
            insertQuery,
          ])

        created = insertedRows[0]
      } else {
        const insertedRows =
          await insertQuery

        created = insertedRows[0]
      }

      if (!created) {
        throw new Error(
          'Không tạo được địa chỉ',
        )
      }

      return c.json(
        {
          success: true,
          message: 'Thêm địa chỉ thành công',
          data: toAddressDto(created),
        },
        201,
      )
    } catch (error: unknown) {
      console.error(
        'Create customer address error:',
        error,
      )

      return c.json(
        {
          success: false,
          message: 'Không thể thêm địa chỉ',
        },
        500,
      )
    }
  },
)

/**
 * PUT /address/me/:id
 */
addressesRouter.put(
  '/me/:id',
  zValidator(
    'param',
    addressIdParamSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            message: 'ID địa chỉ không hợp lệ',
            errors:
              z.flattenError(result.error)
                .fieldErrors,
          },
          400,
        )
      }
    },
  ),
  zValidator(
    'json',
    updateAddressSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            message: 'Dữ liệu địa chỉ không hợp lệ',
            errors:
              z.flattenError(result.error)
                .fieldErrors,
          },
          400,
        )
      }
    },
  ),
  async (c) => {
    try {
      const customerId = Number(
        c.get('jwtPayload').sub,
      )

      const { id: addressId } =
        c.req.valid('param')

      const input = c.req.valid('json')
      const db = createDb(c.env.DB)

      const [currentAddress] = await db
        .select()
        .from(addresses)
        .where(
          and(
            eq(
              addresses.addressId,
              addressId,
            ),
            eq(
              addresses.customerId,
              customerId,
            ),
          ),
        )
        .limit(1)

      if (!currentAddress) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy địa chỉ',
          },
          404,
        )
      }

      /*
       * Không cho bỏ mặc định trực tiếp.
       * Muốn đổi mặc định phải chọn địa chỉ khác.
       */
      if (
        currentAddress.isDefault &&
        input.is_default === false
      ) {
        return c.json(
          {
            success: false,
            message:
              'Hãy đặt một địa chỉ khác làm mặc định trước',
            errors: {
              is_default: [
                'Không thể bỏ địa chỉ mặc định trực tiếp',
              ],
            },
          },
          409,
        )
      }

      const changes = {
        ...(input.recipient_name !== undefined && {
          recipientName: input.recipient_name,
        }),

        ...(input.phone !== undefined && {
          phone: input.phone,
        }),

        ...(input.province !== undefined && {
          province: input.province,
        }),

        ...(input.district !== undefined && {
          district: input.district,
        }),

        ...(input.ward !== undefined && {
          ward: input.ward,
        }),

        ...(input.address_detail !== undefined && {
          addressDetail: input.address_detail,
        }),

        ...(input.type !== undefined && {
          type: input.type,
        }),

        ...(input.is_default !== undefined && {
          isDefault: input.is_default,
        }),

        updatedAt: sql`CURRENT_TIMESTAMP`,
      }

      const updateQuery = db
        .update(addresses)
        .set(changes)
        .where(
          and(
            eq(
              addresses.addressId,
              addressId,
            ),
            eq(
              addresses.customerId,
              customerId,
            ),
          ),
        )
        .returning()

      let updated: AddressRow | undefined

      if (input.is_default === true) {
        const [, updatedRows] =
          await db.batch([
            db
              .update(addresses)
              .set({
                isDefault: false,
                updatedAt:
                  sql`CURRENT_TIMESTAMP`,
              })
              .where(
                and(
                  eq(
                    addresses.customerId,
                    customerId,
                  ),
                  ne(
                    addresses.addressId,
                    addressId,
                  ),
                ),
              ),
            updateQuery,
          ])

        updated = updatedRows[0]
      } else {
        const updatedRows =
          await updateQuery

        updated = updatedRows[0]
      }

      if (!updated) {
        throw new Error(
          'Không cập nhật được địa chỉ',
        )
      }

      return c.json({
        success: true,
        message: 'Cập nhật địa chỉ thành công',
        data: toAddressDto(updated),
      })
    } catch (error: unknown) {
      console.error(
        'Update customer address error:',
        error,
      )

      return c.json(
        {
          success: false,
          message: 'Không thể cập nhật địa chỉ',
        },
        500,
      )
    }
  },
)

/**
 * PATCH /address/me/:id/default
 */
addressesRouter.patch(
  '/me/:id/default',
  zValidator(
    'param',
    addressIdParamSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            message: 'ID địa chỉ không hợp lệ',
            errors:
              z.flattenError(result.error)
                .fieldErrors,
          },
          400,
        )
      }
    },
  ),
  async (c) => {
    try {
      const customerId = Number(
        c.get('jwtPayload').sub,
      )

      const { id: addressId } =
        c.req.valid('param')

      const db = createDb(c.env.DB)

      const [ownedAddress] = await db
        .select({
          addressId: addresses.addressId,
          isDefault: addresses.isDefault,
        })
        .from(addresses)
        .where(
          and(
            eq(
              addresses.addressId,
              addressId,
            ),
            eq(
              addresses.customerId,
              customerId,
            ),
          ),
        )
        .limit(1)

      if (!ownedAddress) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy địa chỉ',
          },
          404,
        )
      }

      if (!ownedAddress.isDefault) {
        await db.batch([
          db
            .update(addresses)
            .set({
              isDefault: false,
              updatedAt:
                sql`CURRENT_TIMESTAMP`,
            })
            .where(
              eq(
                addresses.customerId,
                customerId,
              ),
            ),

          db
            .update(addresses)
            .set({
              isDefault: true,
              updatedAt:
                sql`CURRENT_TIMESTAMP`,
            })
            .where(
              and(
                eq(
                  addresses.addressId,
                  addressId,
                ),
                eq(
                  addresses.customerId,
                  customerId,
                ),
              ),
            ),
        ])
      }

      return c.json({
        success: true,
        message: 'Đặt địa chỉ mặc định thành công',
      })
    } catch (error: unknown) {
      console.error(
        'Set default address error:',
        error,
      )

      return c.json(
        {
          success: false,
          message:
            'Không thể đặt địa chỉ mặc định',
        },
        500,
      )
    }
  },
)

/**
 * DELETE /address/me/:id
 */
addressesRouter.delete(
  '/me/:id',
  zValidator(
    'param',
    addressIdParamSchema,
    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: false,
            message: 'ID địa chỉ không hợp lệ',
            errors:
              z.flattenError(result.error)
                .fieldErrors,
          },
          400,
        )
      }
    },
  ),
  async (c) => {
    try {
      const customerId = Number(
        c.get('jwtPayload').sub,
      )

      const { id: addressId } =
        c.req.valid('param')

      const db = createDb(c.env.DB)

      const [currentAddress] = await db
        .select()
        .from(addresses)
        .where(
          and(
            eq(
              addresses.addressId,
              addressId,
            ),
            eq(
              addresses.customerId,
              customerId,
            ),
          ),
        )
        .limit(1)

      if (!currentAddress) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy địa chỉ',
          },
          404,
        )
      }

      /*
       * Nếu xóa địa chỉ mặc định, chọn địa chỉ
       * cập nhật gần nhất làm mặc định mới.
       */
      if (currentAddress.isDefault) {
        const [replacement] = await db
          .select({
            addressId: addresses.addressId,
          })
          .from(addresses)
          .where(
            and(
              eq(
                addresses.customerId,
                customerId,
              ),
              ne(
                addresses.addressId,
                addressId,
              ),
            ),
          )
          .orderBy(
            desc(addresses.updatedAt),
            desc(addresses.addressId),
          )
          .limit(1)

        if (replacement) {
          await db.batch([
            db
              .delete(addresses)
              .where(
                and(
                  eq(
                    addresses.addressId,
                    addressId,
                  ),
                  eq(
                    addresses.customerId,
                    customerId,
                  ),
                ),
              ),

            db
              .update(addresses)
              .set({
                isDefault: true,
                updatedAt:
                  sql`CURRENT_TIMESTAMP`,
              })
              .where(
                and(
                  eq(
                    addresses.addressId,
                    replacement.addressId,
                  ),
                  eq(
                    addresses.customerId,
                    customerId,
                  ),
                ),
              ),
          ])
        } else {
          await db
            .delete(addresses)
            .where(
              and(
                eq(
                  addresses.addressId,
                  addressId,
                ),
                eq(
                  addresses.customerId,
                  customerId,
                ),
              ),
            )
        }
      } else {
        await db
          .delete(addresses)
          .where(
            and(
              eq(
                addresses.addressId,
                addressId,
              ),
              eq(
                addresses.customerId,
                customerId,
              ),
            ),
          )
      }

      return c.json({
        success: true,
        message: 'Xóa địa chỉ thành công',
      })
    } catch (error: unknown) {
      console.error(
        'Delete customer address error:',
        error,
      )

      return c.json(
        {
          success: false,
          message: 'Không thể xóa địa chỉ',
        },
        500,
      )
    }
  },
)

export default addressesRouter