import { z } from 'zod'
import { idParamSchema, phoneSchema, nullableTextSchema} from './common'

export { idParamSchema as addressIdParamSchema }
export const addressTypeSchema = z.enum([
  'home',
  'work',
  'school',
  'other',
])

const locationSchema = z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() ==='') return null
    return value
  },
  nullableTextSchema(100).optional()
)

const addressFieldsSchema = z.object({
  recipient_name: z
    .string()
    .trim()
    .min(2, 'Tên người nhận phải có ít nhất 2 ký tự')
    .max(50, 'Tên người nhận không được vượt quá 50 ký tự'),
  phone: phoneSchema,
  province: locationSchema,
  district: locationSchema,
  ward: locationSchema,
  address_detail: z
    .string()
    .trim()
    .min(5, 'Địa chỉ chi tiết phải có ít nhất 5 ký tự')
    .max(255, 'Địa chỉ chi tiết không được vượt quá 255 ký tự'),
  type: addressTypeSchema,
  is_default: z.boolean({
    error: 'Trạng thái mặc định phải là boolean'
  }).default(false)
})

export const createAddressSchema = 
  addressFieldsSchema.extend({
    type: addressTypeSchema.default('home'),
    is_default: z.boolean({
      error: 'Trạng thái mặc định phải là boolean'
    }).default(false)
  })

export const updateAddressSchema =
  addressFieldsSchema
    .partial()
    .superRefine((data, ctx) => {
      if(Object.keys(data).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Không có thông tin địa chỉ nào thay đổi'
        })
      } 
    })

export type AddressType = z.infer<typeof addressTypeSchema>
export type CreateAddressInput = z.infer<typeof createAddressSchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>