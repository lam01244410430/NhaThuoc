import { z } from 'zod'
import {
  idParamSchema,
  moneySchema,
  paginationQuerySchema,
  positiveIdSchema,
} from './common'

export {
  idParamSchema as returnIdParamSchema,
}

export const returnStatusSchema = z.enum([
  'pending',
  'seller_approved',
  'platform_approved',
  'rejected',
  'refunding',
  'refunded',
])

export const createReturnSchema = z.object({
  order_item_id:
    positiveIdSchema,

  quantity: z
    .number()
    .int()
    .positive(
      'Số lượng trả phải lớn hơn 0',
    ),

  reason: z
    .string()
    .trim()
    .min(1)
    .max(2000),
})

export const updateReturnApprovalSchema = z
  .object({
    seller_approved:
      z.boolean().optional(),

    platform_approved:
      z.boolean().optional(),

    status:
      returnStatusSchema.optional(),

    refund_amount:
      moneySchema.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'Không có thông tin trả hàng nào thay đổi',
  )
  .superRefine((data, ctx) => {
    if (
      data.platform_approved === true &&
      data.seller_approved === false
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['platform_approved'],
        message:
          'Nền tảng chỉ có thể duyệt sau khi người bán đã duyệt',
      })
    }
  })

export const returnListQuerySchema =
  paginationQuerySchema.extend({
    status:
      returnStatusSchema.optional(),
  })
