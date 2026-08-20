import { z } from 'zod'
import {
  idParamSchema,
  positiveIdSchema,
  slugSchema,
} from './common'

export {
  idParamSchema as categoryIdParamSchema,
}

export const createCategorySchema = z.object({
  category_name: z
    .string()
    .trim()
    .min(1)
    .max(150),

  slug: slugSchema,

  parent_category_id: z
    .union([
      positiveIdSchema,
      z.null(),
    ])
    .optional(),

  status: z.boolean().default(true),

  sort_order: z
    .number()
    .int()
    .nonnegative()
    .default(100),
})

export const updateCategorySchema =
  createCategorySchema
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có thông tin danh mục nào thay đổi',
    )
