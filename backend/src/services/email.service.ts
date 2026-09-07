import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const { host, port, secure, user, pass } = config.email;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    } else {
      console.warn('[EmailService] SMTP credentials not configured. OTP codes will be logged to the console.');
    }
  }

  public async sendPasswordResetOTP(toEmail: string, otp: string): Promise<boolean> {
    const subject = 'Your Password Reset OTP - AI Interviewer';
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0c16; color: #f3f4f6; padding: 40px 20px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background: #131526; border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 16px; padding: 36px 28px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          
          <div style="display: inline-block; padding: 12px 20px; background: rgba(99, 102, 241, 0.15); border-radius: 12px; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              AI Interviewer
            </span>
          </div>

          <h2 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">Reset Your Password</h2>
          <p style="font-size: 14px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset your password. Use the verification code below to complete the reset. This code is valid for <strong>10 minutes</strong>.
          </p>

          <div style="background: rgba(99, 102, 241, 0.1); border: 2px dashed #6366f1; border-radius: 12px; padding: 18px 24px; margin-bottom: 24px;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #818cf8; font-family: monospace;">
              ${otp}
            </span>
          </div>

          <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 24px;">
            If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized access.
          </p>

          <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;" />

          <p style="font-size: 11px; color: #4b5563;">
            &copy; ${new Date().getFullYear()} AI Interviewer. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // Always log to console in dev mode so the code is readily available for quick testing
    console.log(`\n==========================================`);
    console.log(`[PASSWORD RESET OTP]`);
    console.log(`Recipient: ${toEmail}`);
    console.log(`OTP Code:  ${otp}`);
    console.log(`Expires in: 10 minutes`);
    console.log(`==========================================\n`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: config.email.from,
          to: toEmail,
          subject,
          html: htmlContent,
        });
        console.log(`[EmailService] Password reset email sent successfully to ${toEmail}`);
        return true;
      } catch (error) {
        console.error('[EmailService] Failed to send email via SMTP:', error);
        // We still return true if logged to console in dev mode to avoid locking out the user
        return false;
      }
    }

    return true;
  }
}

export const emailService = new EmailService();
