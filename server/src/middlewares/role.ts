import type { MiddlewareHandler } from 'hono'
import type { AppEnv, UserRole } from './auth'
import { AppError } from './error-handler'

export function requireRole(...allowedRoles: UserRole[]): MiddlewareHandler<AppEnv> {
  if (allowedRoles.length === 0) {
    throw new Error('requireRole cần ít nhất một role')
  }

  return async (c, next) => {
    const authUser = c.get('authUser')
    if (!authUser) {
      throw new AppError(
        500,
        'AUTH_MIDDLEWARE_REQUIRED',
        'Route chưa được cấu hình middleware xác thực',
      )
    }

    if (!allowedRoles.includes(authUser.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện chức năng này')
    }

    await next()
  }
}