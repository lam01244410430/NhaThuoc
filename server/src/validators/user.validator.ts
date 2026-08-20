import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(72, 'Mật khẩu quá dài')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/\d/, 'Mật khẩu phải có ít nhất 1 chữ số')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt');

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Mã OTP phải gồm đúng 6 chữ số');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^0\d{9}$/, 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Định dạng email không hợp lệ');

export const requestOtpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('change_password') }),
  z.object({
    type: z.literal('change_phone'),
    target_value: phoneSchema,
  }),
  z.object({
    type: z.literal('change_email'),
    target_value: emailSchema,
  }),
]);

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').optional(),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
    otp: otpCodeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.new_password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm_password'],
        message: 'Mật khẩu xác nhận không khớp',
      });
    }

    if (data.current_password && data.new_password === data.current_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['new_password'],
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
      });
    }

    if (new TextEncoder().encode(data.new_password).byteLength > 72) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['new_password'],
        message: 'Mật khẩu mới vượt quá giới hạn 72 byte',
      });
    }
  });

export const changePhoneSchema = z.object({
  new_phone: phoneSchema,
  otp: otpCodeSchema,
});

export const changeEmailSchema = z.object({
  new_email: emailSchema,
  current_password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').optional(),
  otp: otpCodeSchema,
});


export const updateCustomerProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Họ tên phải có ít nhất 3 ký tự')
    .max(100, 'Họ tên tối đa 100 ký tự'),

  date_of_birth: z
    .union([
      z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
          'Ngày sinh phải có định dạng YYYY-MM-DD',
        ),
      z.null(),
    ])
    .refine(
      (value) => {
        if (value === null) return true;

        const date = new Date(`${value}T00:00:00Z`);

        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value <= new Date().toISOString().slice(0, 10)
        );
      },
      'Ngày sinh không hợp lệ hoặc lớn hơn ngày hiện tại',
    ),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePhoneInput = z.infer<typeof changePhoneSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;

