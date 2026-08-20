import { z } from 'zod'
import {
  idParamSchema,
  moneySchema,
  nullableMoneySchema,
  nullableTextSchema,
  paginationQuerySchema,
  positiveIdSchema,
  slugSchema,
} from './common'

export {
  idParamSchema as productIdParamSchema,
}

export const productStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'out_of_stock',
])

export const variantStatusSchema = z.enum([
  'active',
  'inactive',
  'out_of_stock',
])

export const productMediaUploadMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    type: z.enum([
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
    ]),
    size: z.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    const maxSize = data.type.startsWith('image/')
      ? 8 * 1024 * 1024
      : 30 * 1024 * 1024
    if (data.size > maxSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['size'],
        message: data.type.startsWith('image/') ? 'Ảnh tối đa 8MB' : 'Video tối đa 30MB',
      })
    }
  })

export const productMediaDeleteQuerySchema = z.object({
  key: z.string().trim().min(1).max(300),
})

const productBaseObject = z.object({
  shop_id: positiveIdSchema.optional(),
  category_id: positiveIdSchema,
  name: z
    .string()
    .trim()
    .min(2, 'Tên sản phẩm phải có ít nhất 2 ký tự')
    .max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  slug: slugSchema,
  price: moneySchema,
  sale_price: nullableMoneySchema.optional(),
  description: nullableTextSchema(5000).optional(),
  usage_guide: nullableTextSchema(5000).optional(),
  status: productStatusSchema.default('draft'),
  thumbnail_url: z
    .union([
      z.string().trim().url('URL ảnh không hợp lệ'),
      z.null(),
    ])
    .optional(),
})

const validateSalePrice = (
  data: {
    price?: number
    sale_price?: number | null
  },
  ctx: z.RefinementCtx,
) => {
  if (
    data.price !== undefined &&
    data.sale_price !== undefined &&
    data.sale_price !== null &&
    data.sale_price > data.price
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sale_price'],
      message:
        'Giá khuyến mãi không được lớn hơn giá gốc',
    })
  }
}

const createProductVariantInputSchema = z
  .object({
    id: positiveIdSchema.optional(),
    sku: z
      .string()
      .trim()
      .min(1, 'SKU variant không được để trống')
      .max(120, 'SKU variant tối đa 120 ký tự'),
    price: moneySchema,
    sale_price: nullableMoneySchema.optional(),
    status: variantStatusSchema.default('active'),
    options: z
      .array(z.object({
        group_name: z
          .string()
          .trim()
          .min(1, 'Tên danh mục variant không được để trống')
          .max(80, 'Tên danh mục variant tối đa 80 ký tự'),
        value_name: z
          .string()
          .trim()
          .min(1, 'Giá trị phân loại không được để trống')
          .max(120, 'Giá trị phân loại tối đa 120 ký tự'),
      }))
      .min(1, 'Variant phải có ít nhất một danh mục phân loại')
      .max(2, 'Mỗi sản phẩm có tối đa 2 nhóm phân loại')
      .refine(
        (options) => {
          const groupNames = options.map(
            (option) => option.group_name.trim().toLowerCase(),
          )
          return new Set(groupNames).size === groupNames.length
        },
        'Không được nhập trùng danh mục trong cùng variant',
      ),
  })
  .superRefine(validateSalePrice)

const createProductMediaInputSchema = z.object({
  url: z.string().trim().url('URL ảnh hoặc video không hợp lệ'),
  type: z.enum(['image', 'video']),
  purpose: z.enum(['gallery', 'description']),
})

export const createProductSchema =
  productBaseObject
    .extend({
      variants: z
        .array(createProductVariantInputSchema)
        .max(100, 'Mỗi sản phẩm có tối đa 100 variant')
        .default([]),
      media: z
        .array(createProductMediaInputSchema)
        .max(22, 'Sản phẩm có quá nhiều ảnh hoặc video')
        .default([]),
    })
    .superRefine((data, ctx) => {
      validateSalePrice(data, ctx)

      const galleryImages = data.media.filter(
        (item) => item.type === 'image' && item.purpose === 'gallery',
      )
      const descriptionImages = data.media.filter(
        (item) => item.type === 'image' && item.purpose === 'description',
      )
      const videos = data.media.filter((item) => item.type === 'video')

      if (galleryImages.length > 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media'],
          message: 'Chỉ được thêm tối đa 9 ảnh sản phẩm',
        })
      }
      if (descriptionImages.length > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media'],
          message: 'Chỉ được thêm tối đa 12 ảnh trong mô tả',
        })
      }
      if (videos.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media'],
          message: 'Chỉ được thêm tối đa 1 video sản phẩm',
        })
      }
      if (videos.some((item) => item.purpose !== 'gallery')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['media'],
          message: 'Video chỉ được sử dụng trong thư viện sản phẩm',
        })
      }

      const normalizedSkus = data.variants.map(
        (variant) => variant.sku.trim().toLowerCase(),
      )

      if (new Set(normalizedSkus).size !== normalizedSkus.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants'],
          message: 'SKU của các variant không được trùng nhau',
        })
      }

      const normalizedCombinations = data.variants.map((variant) =>
        variant.options
          .map((option) =>
            `${option.group_name.trim().toLowerCase()}=${option.value_name.trim().toLowerCase()}`,
          )
          .sort()
          .join('|'),
      )

      if (new Set(normalizedCombinations).size !== normalizedCombinations.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants'],
          message: 'Tổ hợp giá trị phân loại của các variant không được trùng nhau',
        })
      }

      const expectedGroupNames = data.variants[0]?.options
        .map((option) => option.group_name.trim().toLowerCase())
        .sort()

      if (expectedGroupNames) {
        data.variants.forEach((variant, index) => {
          const groupNames = variant.options
            .map((option) => option.group_name.trim().toLowerCase())
            .sort()

          if (groupNames.join('|') !== expectedGroupNames.join('|')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['variants', index, 'options'],
              message: 'Mọi variant phải sử dụng cùng các nhóm phân loại',
            })
          }
        })
      }
    })

// Trang thêm và chỉnh sửa dùng chung một biểu mẫu. Tồn kho được quản lý
// độc lập qua quy trình nhập kho của sàn, không chỉnh trực tiếp từ sản phẩm.
export const updateProductSchema = createProductSchema

export const productListQuerySchema =
  paginationQuerySchema.extend({
    category_id: positiveIdSchema.optional(),
    shop_id: positiveIdSchema.optional(),
    status: productStatusSchema.optional(),
  })

const variantBaseObject = z.object({
  product_id: positiveIdSchema.optional(),
  price: moneySchema,
  sale_price: nullableMoneySchema.optional(),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU không được để trống')
    .max(120, 'SKU tối đa 120 ký tự'),
  status: variantStatusSchema.default('active'),
  value_ids: z
    .array(positiveIdSchema)
    .min( 1, 'Biến thể phải có ít nhất một giá trị tùy chọn'),
})

const validateVariant = (
  data: {
    price?: number
    sale_price?: number | null
    value_ids?: number[]
  },
  ctx: z.RefinementCtx,
) => {
  if (
    data.price !== undefined &&
    data.sale_price !== undefined &&
    data.sale_price !== null &&
    data.sale_price > data.price
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sale_price'],
      message:
        'Giá khuyến mãi không được lớn hơn giá gốc',
    })
  }

  if (
    data.value_ids !== undefined &&
    new Set(data.value_ids).size !==
      data.value_ids.length
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value_ids'],
      message:
        'Không được chọn trùng giá trị tùy chọn',
    })
  }
}

export const createVariantSchema = variantBaseObject.superRefine(validateVariant)

export const updateVariantSchema =
  variantBaseObject
    .omit({ product_id: true })
    .partial()
    .superRefine(validateVariant)
    .refine(
      (data) => Object.keys(data).length > 0,
      'Không có thông tin biến thể nào thay đổi',
    )
