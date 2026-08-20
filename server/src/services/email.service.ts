import type { Bindings } from '../types';

export type OtpPurpose = 'change_password' | 'change_phone' | 'change_email';

interface SendOtpMailInput {
  to: string;
  code: string;
  purpose: OtpPurpose;
  expiresInMinutes: number;
}

const purposeLabels: Record<OtpPurpose, string> = {
  change_password: 'đổi mật khẩu',
  change_phone: 'đổi số điện thoại',
  change_email: 'đổi email',
};

export async function sendOtpMail(
  env: Bindings,
  input: SendOtpMailInput,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error('Thiếu cấu hình gửi email Resend');
  }

  const action = purposeLabels[input.purpose];
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [input.to],
      subject: `Mã xác minh ${action} - Nhà Thuốc của Lâm`,
      text: `Mã xác minh của bạn là ${input.code}. Mã có hiệu lực trong ${input.expiresInMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
          <h2 style="color:#39b54a">Nhà Thuốc của Lâm</h2>
          <p>Bạn đang yêu cầu <strong>${action}</strong>.</p>
          <p>Mã xác minh của bạn:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0d5c31">${input.code}</p>
          <p>Mã có hiệu lực trong ${input.expiresInMinutes} phút.</p>
          <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error('Resend email error:', response.status);
    throw new Error('Không thể gửi email xác minh');
  }
}
