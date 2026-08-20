import { z } from 'zod'
import {
  idParamSchema,
  paginationQuerySchema,
  positiveIdSchema,
} from './common'

export {
  idParamSchema as reviewIdParamSchema,
}

export const reviewStatusSchema = z.enum([
  'pending',
  'published',
  'hidden',
])

export const createReviewSchema = z.object({
  product_id:
    positiveIdSchema,

  order_item_id:
    positiveIdSchema,

  title: z
    .string()
    .trim()
    .min(1)
    .max(150),

  comment: z
    .string()
    .trim()
    .min(1)
    .max(3000),

  rating: z
    .number()
    .int()
    .min(1)
    .max(5),
})

export const updateReviewSchema =
  createReviewSchema
    .omit({
      product_id: true,
      order_item_id: true,
    })
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có nội dung đánh giá nào thay đổi',
    )

export const updateReviewStatusSchema = z.object({
  status:
    reviewStatusSchema,
})

export const reviewListQuerySchema =
  paginationQuerySchema.extend({
    product_id:
      positiveIdSchema.optional(),

    status:
      reviewStatusSchema.optional(),
  })
