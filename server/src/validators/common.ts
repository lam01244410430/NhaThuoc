import { z } from 'zod'
import type { $ZodError } from 'zod/v4/core'
export const positiveIdSchema = z.coerce.number().int().positive('ID không hợp lệ')

export const idParamSchema = z.object({
  id: positiveIdSchema,
})

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional(),
})

export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^0\d{9}$/,
    'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0',
  )

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Định dạng email không hợp lệ')

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Slug không được để trống')
  .max(220, 'Slug quá dài')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug chỉ gồm chữ thường, số và dấu gạch ngang',
  )

export const moneySchema = z
  .number()
  .int()
  .nonnegative('Giá trị tiền không được âm')

export const nullableMoneySchema = z.union([
  moneySchema,
  z.null(),
])

export const dateOnlySchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Ngày phải có định dạng YYYY-MM-DD',
  )
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`)
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      )
    },
    'Ngày không hợp lệ',
  )

export const nullableTextSchema = (
  maxLength: number,
) => z.union([
  z.string().trim().max(maxLength),
  z.null(),
])

export const getZodFieldErrors = (error: $ZodError) => {
  return z.flattenError(error,).fieldErrors
}
