import { z } from 'zod'

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, 'Username phải có ít nhất 4 ký tự')
    .max(50, 'Username tối đa 50 ký tự')
    .regex(/^[a-z0-9_]+$/, 'Username chỉ gồm chữ thường, số và dấu gạch dưới'),
  name: z
    .string()
    .trim()
    .min(3, 'Tên phải có ít nhất 3 ký tự')
    .max(100, 'Tên tối đa 100 ký tự'),
  email: z.string().trim().toLowerCase().email('Định dạng email không hợp lệ'),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Số điện thoại phải gồm đúng 10 chữ số')
    .optional(),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_+\-=[\]\\\/ ]).+$/,
      'Mật khẩu phải có chữ hoa, số và ký tự đặc biệt'
    )
})

export const loginSchema = z.object({
  identity: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Vui lòng nhập email hoặc username'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu')
})

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Thiếu mã OAuth'),
  state: z.string().min(1, 'Thiếu OAuth state')
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>