import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

import type { AppEnv } from './auth'

type ErrorDetails = Record<string, unknown>

type AppErrorOptions = {
    details?: ErrorDetails
    headers?: Record<string, string>
}

export class AppError extends Error{
    readonly status: ContentfulStatusCode
    readonly code: string
    readonly details?: ErrorDetails
    readonly headers?: Record<string, string>

    constructor(
        status: ContentfulStatusCode,
        code: string,
        message: string,
        options: AppErrorOptions = {},
    ) {
        super(message)
        this.name = 'AppError'
        this.status = status
        this.code = code
        this.details = options.details
        this.headers = options.headers
    }
}

function buildErrorBody(
    message: string,
    code: string,
    requestId: string,
    details?: ErrorDetails
) {
    return {
        success: false as const,
        message,
        error: {
            code,
            requestId,
            ...(details ? { details } : {})
        }
    }
}

export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  const requestId = c.req.header('cf-ray') ?? crypto.randomUUID()

  if (error instanceof AppError) {
    return c.json(
      buildErrorBody(error.message, error.code, requestId, error.details),
      error.status,
      {
        ...error.headers,
        'x-request-id': requestId,
      },
    )
  }

  if (error instanceof ZodError) {
    return c.json(
      buildErrorBody('Dữ liệu không hợp lệ', 'VALIDATION_ERROR', requestId, {
        issues: error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          code: issue.code,
          message: issue.message,
        })),
      }),
      400,
      { 'x-request-id': requestId },
    )
  }

  if (error instanceof HTTPException) {
    const response = error.getResponse()

    return c.json(
      buildErrorBody(error.message || 'Yêu cầu không hợp lệ', 'HTTP_ERROR', requestId),
      error.status,
      {
        ...Object.fromEntries(response.headers),
        'x-request-id': requestId,
      },
    )
  }

  console.error({
    requestId,
    method: c.req.method,
    path: c.req.path,
    name: error.name,
    message: error.message,
    stack: error.stack,
  })

  return c.json(
    buildErrorBody('Đã xảy ra lỗi hệ thống', 'INTERNAL_SERVER_ERROR', requestId),
    500,
    { 'x-request-id': requestId },
  )
}