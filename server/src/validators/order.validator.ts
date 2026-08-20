import { z } from 'zod'
import {
  idParamSchema,
  moneySchema,
  paginationQuerySchema,
  phoneSchema,
  positiveIdSchema,
} from './common'

export {
  idParamSchema as orderIdParamSchema,
}

export const paymentMethodSchema = z.enum([
  'COD',
  'VNPay',
  'Momo',
  'BankTransfer',
])

export const paymentStatusSchema = z.enum([
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
])

export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'delivering',
  'delivered',
  'cancelled',
  'completed',
])

export const createOrderItemSchema = z.object({
  product_id:
    positiveIdSchema,

  variant_id: z
    .union([
      positiveIdSchema,
      z.null(),
    ])
    .optional(),

  quantity: z
    .number()
    .int()
    .positive('Số lượng phải lớn hơn 0')
    .max(999, 'Số lượng quá lớn'),
})

export const createOrderSchema = z.object({
  recipient_name: z
    .string()
    .trim()
    .min(1)
    .max(100),

  recipient_phone:
    phoneSchema,

  shipping_address: z
    .string()
    .trim()
    .min(1)
    .max(500),

  note: z
    .union([
      z.string().trim().max(1000),
      z.null(),
    ])
    .optional(),

  payment_method:
    paymentMethodSchema,

  shipping_fee:
    moneySchema.default(0),

  discount_amount:
    moneySchema.default(0),

  items: z
    .array(createOrderItemSchema)
    .min(
      1,
      'Đơn hàng phải có ít nhất một sản phẩm',
    ),
})

export const updateOrderStatusSchema = z.object({
  order_status:
    orderStatusSchema,
})

export const updatePaymentStatusSchema = z.object({
  payment_status:
    paymentStatusSchema,
})

export const shopOrderListQuerySchema =
  paginationQuerySchema.extend({
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(10),

    order_status:
      orderStatusSchema.optional(),

    payment_status:
      paymentStatusSchema.optional(),

    sort_by: z.enum([
      'id',
      'order_code',
      'customer',
      'items',
      'shop_total',
      'payment_status',
      'order_status',
      'order_date',
    ]).default('id'),

    sort_order: z.enum([
      'asc',
      'desc',
    ]).default('desc'),
  })
