import nodemailer from 'nodemailer';

export const sendPasswordResetOtp = async (email: string, otp: string): Promise<void> => {
  const password = process.env.SMTP_PASS;
  if (!password) {
    console.info(`[MAIL_FALLBACK_OTP] Email: ${email} | OTP: ${otp}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: password }
  });
  await transporter.sendMail({
    from: process.env.SMTP_USER, to: email,
    subject: '[RTMS] Mã xác nhận (OTP) khôi phục mật khẩu',
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1e293b"><h2 style="color:#2563eb">Khôi phục tài khoản RTMS</h2><p>Mã xác nhận OTP của bạn:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#eff6ff;text-align:center">${otp}</div><p>Mã chỉ có hiệu lực trong <b>3 phút</b>. Nếu bạn không yêu cầu khôi phục mật khẩu, hãy bỏ qua email này.</p></div>`
  });
};
