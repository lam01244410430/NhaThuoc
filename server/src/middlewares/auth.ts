import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { MiddlewareHandler } from 'hono'
import { verify } from 'hono/jwt'
import { z } from 'zod'

import { users } from '../db/schema'
import type { Bindings } from '../types'
import { AppError } from './error-handler'

export type UserRole = typeof users.$inferSelect.role

export type AuthUser = Pick<
  typeof users.$inferSelect,
  'userId' | 'username' | 'name' | 'email' | 'role' | 'status' | 'avatar'
>

export type AppEnv = {
  Bindings: Bindings
  Variables: {
    authUser: AuthUser
  }
}

const jwtPayloadSchema = z
  .object({
    sub: z.string().regex(/^[1-9]\d*$/),
    role: z.enum(['customer', 'shop', 'admin']),
  })
  .passthrough()

const unauthorizedHeaders = {
  'WWW-Authenticate': 'Bearer realm="NhaThuoc"',
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header('Authorization')
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)

  if (!match) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để thực hiện', {
      headers: unauthorizedHeaders,
    })
  }

  if (!c.env.JWT_SECRET) {
    throw new AppError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'Hệ thống xác thực chưa được cấu hình',
    )
  }

  let payload: z.infer<typeof jwtPayloadSchema>

  try {
    const verifiedPayload = await verify(match[1], c.env.JWT_SECRET, 'HS256')
    payload = jwtPayloadSchema.parse(verifiedPayload)
  } catch {
    throw new AppError(
      401,
      'INVALID_TOKEN',
      'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      { headers: unauthorizedHeaders },
    )
  }

  const userId = Number(payload.sub)
  const db = drizzle(c.env.DB)
  const [user] = await db
    .select({
      userId: users.userId,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      avatar: users.avatar,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1)

  if (!user || user.deletedAt !== null || user.status === 'deleted') {
    throw new AppError(401, 'ACCOUNT_NOT_FOUND', 'Tài khoản không còn tồn tại', {
      headers: unauthorizedHeaders,
    })
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Tài khoản hiện không hoạt động')
  }

  if (user.role !== payload.role) {
    throw new AppError(
      401,
      'SESSION_OUTDATED',
      'Quyền tài khoản đã thay đổi, vui lòng đăng nhập lại',
      { headers: unauthorizedHeaders },
    )
  }

  c.set('authUser', {
    userId: user.userId,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
  })

  await next()
}