import { z } from 'zod'
import {
  idParamSchema,
  paginationQuerySchema,
  phoneSchema,
} from './common'

export {
  idParamSchema as shopIdParamSchema,
}

export const shopLevelSchema = z.enum([
  'basic',
  'verified',
  'premium',
])

export const shopApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'suspended',
])

export const createShopSchema = z.object({
  shop_name: z
    .string()
    .trim()
    .min(3, 'Tên shop phải có ít nhất 3 ký tự')
    .max(150, 'Tên shop tối đa 150 ký tự'),

  phone: phoneSchema,

  description: z
    .union([
      z.string().trim().max(2000),
      z.null(),
    ])
    .optional(),
})

export const updateShopSchema = createShopSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    'Không có thông tin nào thay đổi',
  )

export const updateShopApprovalSchema = z.object({
  approval_status: z.enum([
    'approved',
    'rejected',
    'suspended',
  ]),

  level: shopLevelSchema.optional(),
})

export const shopListQuerySchema =
  paginationQuerySchema.extend({
    level: shopLevelSchema.optional(),
  })
