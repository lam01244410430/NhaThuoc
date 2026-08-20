import { z } from 'zod'
import {
  idParamSchema,
  positiveIdSchema,
} from './common'

export {
  idParamSchema as mediaIdParamSchema,
}

export const mediaTypeSchema = z.enum([
  'image',
  'video',
])

const mediaBaseObject = z.object({
  product_id:
    positiveIdSchema.optional(),

  url: z
    .string()
    .trim()
    .url('URL media không hợp lệ'),

  type:
    mediaTypeSchema.default('image'),

  is_thumbnail:
    z.boolean().default(false),

  priority: z
    .number()
    .int()
    .nonnegative()
    .default(0),
})

const validateThumbnail = (
  data: {
    type?: z.infer<typeof mediaTypeSchema>
    is_thumbnail?: boolean
  },
  ctx: z.RefinementCtx,
) => {
  if (
    data.is_thumbnail &&
    data.type !== 'image'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['is_thumbnail'],
      message:
        'Chỉ ảnh mới có thể làm thumbnail',
    })
  }
}

export const createMediaSchema =
  mediaBaseObject.superRefine(
    validateThumbnail,
  )

export const updateMediaSchema =
  mediaBaseObject
    .omit({
      product_id: true,
    })
    .partial()
    .superRefine(
      validateThumbnail,
    )
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có thông tin media nào thay đổi',
    )
