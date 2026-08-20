import type { Bindings } from '../types';
import { sendOtpMail, type OtpPurpose } from './email.service';

export type OtpType = OtpPurpose;

interface IssueOtpInput {
  env: Bindings;
  userId: number;
  type: OtpType;
  targetValue: string;
  recipient: string;
}

interface VerifyOtpInput {
  env: Bindings;
  userId: number;
  type: OtpType;
  targetValue: string;
  code: string;
}

interface VerificationRecord {
  verification_id: number;
  code_hash: string;
  attempts: number;
}

export class OtpServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 429 | 500,
  ) {
    super(message);
    this.name = 'OtpServiceError';
  }
}

const OTP_EXPIRES_IN_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(): string {
  const range = 1_000_000;
  const max = Math.floor(0x1_0000_0000 / range) * range;
  const values = new Uint32Array(1);

  do {
    crypto.getRandomValues(values);
  } while (values[0] >= max);

  return String(values[0] % range).padStart(6, '0');
}

async function hashOtp(
  secret: string,
  userId: number,
  type: OtpType,
  targetValue: string,
  code: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${userId}:${type}:${targetValue}:${code}`),
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function hashesEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function issueOtp(input: IssueOtpInput): Promise<void> {
  const recent = await input.env.DB.prepare(
    `
      SELECT verification_id
      FROM account_verifications
      WHERE user_id = ?
        AND type = ?
        AND created_at > datetime('now', ?)
      ORDER BY verification_id DESC
      LIMIT 1
    `,
  )
    .bind(input.userId, input.type, `-${OTP_RESEND_SECONDS} seconds`)
    .first<{ verification_id: number }>();

  if (recent) {
    throw new OtpServiceError(
      `Vui lòng chờ ${OTP_RESEND_SECONDS} giây trước khi yêu cầu mã mới`,
      429,
    );
  }

  const code = generateOtp();
  const codeHash = await hashOtp(
    input.env.JWT_SECRET,
    input.userId,
    input.type,
    input.targetValue,
    code,
  );

  await input.env.DB.batch([
    input.env.DB.prepare(
      `
        UPDATE account_verifications
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND type = ?
          AND used_at IS NULL
      `,
    ).bind(input.userId, input.type),
    input.env.DB.prepare(
      `
        INSERT INTO account_verifications (
          user_id,
          type,
          target_value,
          code_hash,
          expires_at,
          attempts
        )
        VALUES (?, ?, ?, ?, datetime('now', ?), 0)
      `,
    ).bind(
      input.userId,
      input.type,
      input.targetValue,
      codeHash,
      `+${OTP_EXPIRES_IN_MINUTES} minutes`,
    ),
  ]);

  try {
    if(input.env.OTP_DEV_MODE === 'true'){
      console.log(`[DEV OTP] user=${input.userId} type=${input.type}, target=${input.targetValue} code=${code}`)
      return
    }
    await sendOtpMail(input.env, {
      to: input.recipient,
      code,
      purpose: input.type,
      expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
    });
  } catch (error) {
    await input.env.DB.prepare(
      `
        UPDATE account_verifications
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND type = ?
          AND code_hash = ?
          AND used_at IS NULL
      `,
    )
      .bind(input.userId, input.type, codeHash)
      .run();
    throw error;
  }
}

export async function verifyOtp(input: VerifyOtpInput): Promise<number> {
  const verification = await input.env.DB.prepare(
    `
      SELECT verification_id, code_hash, attempts
      FROM account_verifications
      WHERE user_id = ?
        AND type = ?
        AND target_value = ?
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY verification_id DESC
      LIMIT 1
    `,
  )
    .bind(input.userId, input.type, input.targetValue)
    .first<VerificationRecord>();

  if (!verification || verification.attempts >= OTP_MAX_ATTEMPTS) {
    throw new OtpServiceError('Mã OTP không hợp lệ hoặc đã hết hạn', 400);
  }

  const submittedHash = await hashOtp(
    input.env.JWT_SECRET,
    input.userId,
    input.type,
    input.targetValue,
    input.code,
  );

  if (!hashesEqual(submittedHash, verification.code_hash)) {
    const nextAttempts = verification.attempts + 1;
    await input.env.DB.prepare(
      `
        UPDATE account_verifications
        SET attempts = ?,
            used_at = CASE WHEN ? >= ? THEN CURRENT_TIMESTAMP ELSE used_at END
        WHERE verification_id = ?
          AND used_at IS NULL
      `,
    )
      .bind(
        nextAttempts,
        nextAttempts,
        OTP_MAX_ATTEMPTS,
        verification.verification_id,
      )
      .run();

    throw new OtpServiceError('Mã OTP không chính xác', 400);
  }

  return verification.verification_id;
}
