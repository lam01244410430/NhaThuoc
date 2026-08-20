import { z } from 'zod'
import {
  idParamSchema,
  positiveIdSchema,
} from './common'

export {
  idParamSchema as optionIdParamSchema,
}

export const createOptionGroupSchema = z.object({
  group_name: z
    .string()
    .trim()
    .min(1)
    .max(100),
})

export const updateOptionGroupSchema =
  createOptionGroupSchema
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có thông tin nhóm tùy chọn nào thay đổi',
    )

export const createOptionValueSchema = z.object({
  group_id:
    positiveIdSchema,

  value_name: z
    .string()
    .trim()
    .min(1)
    .max(100),
})

export const updateOptionValueSchema =
  createOptionValueSchema
    .omit({
      group_id: true,
    })
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có thông tin giá trị tùy chọn nào thay đổi',
    )

export const productOptionSchema = z.object({
  group_id:
    positiveIdSchema,
})

export const variantValueSchema = z.object({
  value_id:
    positiveIdSchema,
})
