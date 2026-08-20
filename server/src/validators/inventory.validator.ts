import { z } from 'zod'
import { paginationQuerySchema, positiveIdSchema } from './common'

export const movementTypeSchema = z.enum([
  'import',
  'sale',
  'return',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'reserve',
  'release',
])

export const inventoryIdentitySchema = z.object({
  warehouse_id: positiveIdSchema,
  product_id: positiveIdSchema,
  variant_id: z
    .union([
      positiveIdSchema,
      z.null(),
    ])
    .optional(),
})

export const setInventorySchema =
  inventoryIdentitySchema
    .extend({
      quantity: z
        .number()
        .int()
        .nonnegative(),

      reserved_quantity: z
        .number()
        .int()
        .nonnegative()
        .default(0),

      reorder_point: z
        .number()
        .int()
        .nonnegative()
        .default(0),
    })
    .superRefine((data, ctx) => {
      if ( data.reserved_quantity > data.quantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reserved_quantity'],
          message: 'Số lượng giữ chỗ không được lớn hơn tồn kho',
        })
      }
    })

export const inventoryAdjustmentSchema =
  inventoryIdentitySchema
    .extend({
      quantity_delta: z.number().int(),
      reserved_delta: z.number().int().default(0),
      movement_type: movementTypeSchema,
      reference_type: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional(),
      reference_id: positiveIdSchema.optional(),
      note: z
        .string()
        .trim()
        .max(1000)
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.quantity_delta === 0 && data.reserved_delta === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Biến động tồn kho không được đồng thời bằng 0',
        })
      }

      const hasType = data.reference_type !== undefined
      const hasId = data.reference_id !== undefined
      if (hasType !== hasId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'reference_type và reference_id phải đi cùng nhau',
        })
      }
    })

export const transferInventorySchema = z
  .object({
    source_warehouse_id: positiveIdSchema,
    target_warehouse_id: positiveIdSchema,
    product_id: positiveIdSchema,
    variant_id: z
      .union([positiveIdSchema, z.null()])
      .optional(),
    quantity: z
      .number()
      .int()
      .positive(),
    note: z
      .string()
      .trim()
      .max(1000)
      .optional(),
  })
  .refine(
    (data) =>
      data.source_warehouse_id !== data.target_warehouse_id, {
      path: ['target_warehouse_id'],
      message: 'Kho nhận phải khác kho xuất'
    },
  )

export const inventoryListQuerySchema =
  paginationQuerySchema.extend({
    warehouse_id: positiveIdSchema.optional(),
    product_id: positiveIdSchema.optional(),
    variant_id: positiveIdSchema.optional(),
    movement_type: movementTypeSchema.optional(),
  })
