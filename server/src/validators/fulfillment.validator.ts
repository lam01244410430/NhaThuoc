import { z } from 'zod'
import { idParamSchema, positiveIdSchema } from './common'

export { idParamSchema as fulfillmentIdParamSchema }
export const fulfillmentStatusSchema = z.enum([
  'allocated',
  'picking',
  'packed',
  'shipped',
  'cancelled',
  'returned',
])

export const createFulfillmentSchema = z.object({
  order_item_id: positiveIdSchema,
  warehouse_id: positiveIdSchema,
  quantity: z
    .number()
    .int()
    .positive(),
  status: fulfillmentStatusSchema.default('allocated'),
  tracking_code: z
    .union([
      z.string().trim().min(1).max(120),
      z.null(),
    ])
    .optional(),
})

export const updateFulfillmentSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .positive()
      .optional(),
    status: fulfillmentStatusSchema.optional(),
    tracking_code: z
      .union([
        z.string().trim().min(1).max(120),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'Không có thông tin fulfillment nào thay đổi',
  )
