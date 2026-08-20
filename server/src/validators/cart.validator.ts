import { z } from 'zod'
import { idParamSchema, positiveIdSchema } from './common'
export { idParamSchema as cartItemIdParamSchema }

export const addCartItemSchema = z.object({
  product_id: positiveIdSchema,
  variant_id: z
    .union([
      positiveIdSchema,
      z.null(),
    ]).optional(),

  quantity: z
    .number()
    .int()
    .positive('Số lượng phải lớn hơn 0')
    .max(999, 'Số lượng quá lớn'),
})

export const updateCartItemSchema = z.object({
  quantity: z
    .number()
    .int()
    .positive('Số lượng phải lớn hơn 0')
    .max(999, 'Số lượng quá lớn'),
})
