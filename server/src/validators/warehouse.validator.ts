import { z } from 'zod'
import {
  idParamSchema,
  phoneSchema,
} from './common'

export { idParamSchema as warehouseIdParamSchema }

// trạng thái của kho
export const warehouseStatusSchema = z.enum([
  'active',
  'inactive',
])

// tạo kho mới
export const createWarehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50),

  name: z
    .string()
    .trim()
    .min(1)
    .max(150),

  province: z
    .string()
    .trim()
    .min(1)
    .max(100),

  district: z
    .union([
      z.string().trim().max(100),
      z.null(),
    ])
    .optional(),

  ward: z
    .union([
      z.string().trim().max(100),
      z.null(),
    ])
    .optional(),

  address_detail: z
    .string()
    .trim()
    .min(1)
    .max(255),

  phone: z
    .union([
      phoneSchema,
      z.null(),
    ])
    .optional(),

  status:
    warehouseStatusSchema.default('active'),

  is_default:
    z.boolean().default(false),
})

// cập nhật kho
export const updateWarehouseSchema =
  createWarehouseSchema
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có thông tin kho nào thay đổi',
    )
