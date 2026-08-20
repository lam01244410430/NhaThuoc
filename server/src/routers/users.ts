import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { zValidator } from '@hono/zod-validator';

import { authMiddleware, type AppEnv } from '../middlewares/auth';
import { requireRole } from '../middlewares/role';
import { issueOtp, OtpServiceError, verifyOtp } from '../services/otp.service';
import { getZodFieldErrors } from '../validators/common';
import {
  changeEmailSchema,
  changePasswordSchema,
  changePhoneSchema,
  requestOtpSchema,
  updateCustomerProfileSchema,
} from '../validators/user.validator';

interface UserSecurityRecord {
  user_id: number;
  email: string;
  password: string | null;
  status: 'pending' | 'active' | 'blocked' | 'deleted';
  deleted_at: string | null;
}


interface CustomerProfileRecord {
  id: number;
  username: string | null;
  name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  avatar: string | null;
  email_verified_at: string | null;
}

const customers = new Hono<AppEnv>();
const BCRYPT_ROUNDS = 12;

async function getActiveUser(
  db: D1Database,
  userId: number,
): Promise<UserSecurityRecord | null> {
  const user = await db
    .prepare(
      `
        SELECT user_id, email, password, status, deleted_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
    )
    .bind(userId)
    .first<UserSecurityRecord>();

  if (!user || user.status !== 'active' || user.deleted_at !== null) return null;
  return user;
}


async function getCustomerProfile(
  db: D1Database,
  userId: number,
): Promise<CustomerProfileRecord | null> {
  return db
    .prepare(
      `
        SELECT
          u.user_id AS id,
          u.username,
          u.name,
          u.email,
          cp.phone,
          cp.date_of_birth,
          u.avatar,
          u.email_verified_at
        FROM users AS u
        INNER JOIN customer_profiles AS cp
          ON cp.customer_id = u.user_id
        WHERE u.user_id = ?
          AND u.role = 'customer'
          AND u.status = 'active'
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
    )
    .bind(userId)
    .first<CustomerProfileRecord>();
}


customers.get(
  '/me/profile',
  authMiddleware,
  requireRole('customer'),
  async (c) => {
    try {
      const { userId } = c.get('authUser');
      const profile = await getCustomerProfile(c.env.DB, userId);

      if (!profile) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy hồ sơ khách hàng',
          },
          404,
        );
      }

      return c.json({
        success: true,
        message: 'Lấy hồ sơ thành công',
        data: profile,
      });
    } catch (error: unknown) {
      console.error('Get customer profile error:', error);

      return c.json(
        {
          success: false,
          message: 'Không thể tải hồ sơ',
        },
        500,
      );
    }
  },
);

customers.patch(
  '/me/profile',
  authMiddleware,
  requireRole('customer'),
  zValidator('json', updateCustomerProfileSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: 'Dữ liệu hồ sơ không hợp lệ',
          errors: getZodFieldErrors(result.error),
        },
        400,
      );
    }
  }),
  async (c) => {
    try {
      const { userId } = c.get('authUser');
      const {
        name,
        date_of_birth: dateOfBirth,
      } = c.req.valid('json');

      await c.env.DB.batch([
        c.env.DB
          .prepare(
            `
              UPDATE users
              SET
                name = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ?
                AND role = 'customer'
                AND status = 'active'
                AND deleted_at IS NULL
            `,
          )
          .bind(name, userId),

        c.env.DB
          .prepare(
            `
              UPDATE customer_profiles
              SET
                date_of_birth = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE customer_id = ?
            `,
          )
          .bind(dateOfBirth, userId),
      ]);

      const profile = await getCustomerProfile(c.env.DB, userId);

      if (!profile) {
        return c.json(
          {
            success: false,
            message: 'Không tìm thấy hồ sơ khách hàng',
          },
          404,
        );
      }

      return c.json({
        success: true,
        message: 'Cập nhật hồ sơ thành công',
        data: profile,
      });
    } catch (error: unknown) {
      console.error('Update customer profile error:', error);

      return c.json(
        {
          success: false,
          message: 'Không thể cập nhật hồ sơ',
        },
        500,
      );
    }
  },
);

customers.post(
  '/me/otp',
  authMiddleware,
  requireRole('customer'),
  zValidator('json', requestOtpSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: 'Yêu cầu gửi OTP không hợp lệ',
          errors: getZodFieldErrors(result.error),
        },
        400,
      );
    }
  }),
  async (c) => {
    try {
      const { userId } = c.get('authUser');
      const input = c.req.valid('json');
      const user = await getActiveUser(c.env.DB, userId);

      if (!user) {
        return c.json({ success: false, message: 'Tài khoản không còn hoạt động' }, 404);
      }

      let targetValue: string;
      let recipient: string;

      if (input.type === 'change_password') {
        targetValue = user.email;
        recipient = user.email;
      } else if (input.type === 'change_phone') {
        targetValue = input.target_value;
        recipient = user.email;

        const existingPhone = await c.env.DB.prepare(
          `
            SELECT customer_id
            FROM customer_profiles
            WHERE phone = ?
              AND customer_id <> ?
            LIMIT 1
          `,
        )
          .bind(targetValue, userId)
          .first<{ customer_id: number }>();

        if (existingPhone) {
          return c.json(
            {
              success: false,
              message: 'Số điện thoại đã được sử dụng',
              errors: { target_value: ['Số điện thoại đã được sử dụng'] },
            },
            409,
          );
        }
      } else {
        targetValue = input.target_value;
        recipient = input.target_value;

        if (targetValue === user.email) {
          return c.json(
            {
              success: false,
              message: 'Email mới phải khác email hiện tại',
              errors: { target_value: ['Email mới phải khác email hiện tại'] },
            },
            400,
          );
        }

        const existingEmail = await c.env.DB.prepare(
          `
            SELECT user_id
            FROM users
            WHERE lower(email) = ?
              AND user_id <> ?
            LIMIT 1
          `,
        )
          .bind(targetValue, userId)
          .first<{ user_id: number }>();

        if (existingEmail) {
          return c.json(
            {
              success: false,
              message: 'Email đã được sử dụng',
              errors: { target_value: ['Email đã được sử dụng'] },
            },
            409,
          );
        }
      }

      await issueOtp({
        env: c.env,
        userId,
        type: input.type,
        targetValue,
        recipient,
      });

      return c.json(
        {
          success: true,
          message: 'Mã OTP đã được gửi. Mã có hiệu lực trong 5 phút.',
        },
        202,
      );
    } catch (error: unknown) {
      if (error instanceof OtpServiceError) {
        return c.json({ success: false, message: error.message }, error.status);
      }
      console.error('Request customer OTP error:', error);
      return c.json({ success: false, message: 'Không thể gửi mã OTP' }, 500);
    }
  },
);

customers.put(
  '/me/password',
  authMiddleware,
  requireRole('customer'),
  zValidator('json', changePasswordSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: 'Dữ liệu đổi mật khẩu không hợp lệ',
          errors: getZodFieldErrors(result.error),
        },
        400,
      );
    }
  }),
  async (c) => {
    try {
      const { userId } = c.get('authUser');
      const {
        current_password: currentPassword,
        new_password: newPassword,
        otp,
      } = c.req.valid('json');
      const user = await getActiveUser(c.env.DB, userId);

      if (!user) {
        return c.json({ success: false, message: 'Tài khoản không còn hoạt động' }, 404);
      }

      if (user.password !== null) {
        if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
          return c.json(
            {
              success: false,
              message: 'Mật khẩu hiện tại không chính xác',
              errors: { current_password: ['Mật khẩu hiện tại không chính xác'] },
            },
            400,
          );
        }

        if (await bcrypt.compare(newPassword, user.password)) {
          return c.json(
            {
              success: false,
              message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
              errors: { new_password: ['Mật khẩu mới phải khác mật khẩu hiện tại'] },
            },
            400,
          );
        }
      }

      const verificationId = await verifyOtp({
        env: c.env,
        userId,
        type: 'change_password',
        targetValue: user.email,
        code: otp,
      });
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      const results = await c.env.DB.batch([
        c.env.DB.prepare(
          `
            UPDATE users
            SET password = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND status = 'active'
              AND deleted_at IS NULL
              AND EXISTS (
                SELECT 1 FROM account_verifications
                WHERE verification_id = ? AND used_at IS NULL
              )
          `,
        ).bind(hashedPassword, userId, verificationId),
        c.env.DB.prepare(
          `
            UPDATE account_verifications
            SET used_at = CURRENT_TIMESTAMP
            WHERE verification_id = ? AND used_at IS NULL
          `,
        ).bind(verificationId),
      ]);

      if (Number(results[0].meta.changes ?? 0) !== 1) {
        throw new OtpServiceError('Mã OTP đã được sử dụng', 400);
      }

      return c.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error: unknown) {
      if (error instanceof OtpServiceError) {
        return c.json({ success: false, message: error.message }, error.status);
      }
      console.error('Change customer password error:', error);
      return c.json({ success: false, message: 'Không thể đổi mật khẩu' }, 500);
    }
  },
);

customers.put(
  '/me/phone',
  authMiddleware,
  requireRole('customer'),
  zValidator('json', changePhoneSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: 'Dữ liệu đổi số điện thoại không hợp lệ',
          errors: getZodFieldErrors(result.error),
        },
        400,
      );
    }
  }),
  async (c) => {
    try {
      const { userId } = c.get('authUser');
      const { new_phone: newPhone, otp } = c.req.valid('json');
      const user = await getActiveUser(c.env.DB, userId);

      if (!user) {
        return c.json({ success: false, message: 'Tài khoản không còn hoạt động' }, 404);
      }

      const existingPhone = await c.env.DB.prepare(
        `
          SELECT customer_id
          FROM customer_profiles
          WHERE phone = ? AND customer_id <> ?
          LIMIT 1
        `,
      )
        .bind(newPhone, userId)
        .first<{ customer_id: number }>();

      if (existingPhone) {
        return c.json({ success: false, message: 'Số điện thoại đã được sử dụng' }, 409);
      }

      const verificationId = await verifyOtp({
        env: c.env,
        userId,
        type: 'change_phone',
        targetValue: newPhone,
        code: otp,
      });

      const results = await c.env.DB.batch([
        c.env.DB.prepare(
          `
            UPDATE customer_profiles
            SET phone = ?, updated_at = CURRENT_TIMESTAMP
            WHERE customer_id = ?
              AND EXISTS (
                SELECT 1 FROM account_verifications
                WHERE verification_id = ? AND used_at IS NULL
              )
          `,
        ).bind(newPhone, userId, verificationId),
        c.env.DB.prepare(
          `
            UPDATE account_verifications
            SET used_at = CURRENT_TIMESTAMP
            WHERE verification_id = ? AND used_at IS NULL
          `,
        ).bind(verificationId),
      ]);

      if (Number(results[0].meta.changes ?? 0) !== 1) {
        throw new OtpServiceError('Không thể cập nhật số điện thoại hoặc OTP đã được sử dụng', 400);
      }

      return c.json({ success: true, message: 'Đổi số điện thoại thành công' });
    } catch (error: unknown) {
      if (error instanceof OtpServiceError) {
        return c.json({ success: false, message: error.message }, error.status);
      }
      console.error('Change customer phone error:', error);
      return c.json({ success: false, message: 'Không thể đổi số điện thoại' }, 500);
    }
  },
);

customers.put(
  '/me/email',
  authMiddleware,
  requireRole('customer'),
  zValidator('json', changeEmailSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          message: 'Dữ liệu đổi email không hợp lệ',
          errors: getZodFieldErrors(result.error),
        },
        400,
      );
    }
  }),
  async (c) => {
    try {
      const { userId } = c.get('authUser');
      const {
        new_email: newEmail,
        current_password: currentPassword,
        otp,
      } = c.req.valid('json');
      const user = await getActiveUser(c.env.DB, userId);

      if (!user) {
        return c.json({ success: false, message: 'Tài khoản không còn hoạt động' }, 404);
      }

      if (newEmail === user.email) {
        return c.json({ success: false, message: 'Email mới phải khác email hiện tại' }, 400);
      }

      if (
        user.password !== null &&
        (!currentPassword || !(await bcrypt.compare(currentPassword, user.password)))
      ) {
        return c.json(
          {
            success: false,
            message: 'Mật khẩu hiện tại không chính xác',
            errors: { current_password: ['Mật khẩu hiện tại không chính xác'] },
          },
          400,
        );
      }

      const existingEmail = await c.env.DB.prepare(
        `
          SELECT user_id
          FROM users
          WHERE lower(email) = ? AND user_id <> ?
          LIMIT 1
        `,
      )
        .bind(newEmail, userId)
        .first<{ user_id: number }>();

      if (existingEmail) {
        return c.json({ success: false, message: 'Email đã được sử dụng' }, 409);
      }

      const verificationId = await verifyOtp({
        env: c.env,
        userId,
        type: 'change_email',
        targetValue: newEmail,
        code: otp,
      });

      const results = await c.env.DB.batch([
        c.env.DB.prepare(
          `
            UPDATE users
            SET email = ?,
                email_verified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND status = 'active'
              AND deleted_at IS NULL
              AND EXISTS (
                SELECT 1 FROM account_verifications
                WHERE verification_id = ? AND used_at IS NULL
              )
          `,
        ).bind(newEmail, userId, verificationId),
        c.env.DB.prepare(
          `
            UPDATE account_verifications
            SET used_at = CURRENT_TIMESTAMP
            WHERE verification_id = ? AND used_at IS NULL
          `,
        ).bind(verificationId),
      ]);

      if (Number(results[0].meta.changes ?? 0) !== 1) {
        throw new OtpServiceError('Mã OTP đã được sử dụng', 400);
      }

      return c.json({ success: true, message: 'Đổi email thành công' });
    } catch (error: unknown) {
      if (error instanceof OtpServiceError) {
        return c.json({ success: false, message: error.message }, error.status);
      }
      console.error('Change customer email error:', error);
      return c.json({ success: false, message: 'Không thể đổi email' }, 500);
    }
  },
);

export default customers;

