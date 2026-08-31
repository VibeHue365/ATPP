import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = Number(this.configService.get<string>('MAIL_PORT', '587'));
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');
    const secure = this.configService.get<string>('MAIL_SECURE') === 'true';

    this.from =
      this.configService.get<string>('MAIL_FROM') ||
      (user ? `VibeHue <${user}>` : 'VibeHue <no-reply@localhost>');

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: this.timeout('MAIL_CONNECTION_TIMEOUT_MS', 10000),
          greetingTimeout: this.timeout('MAIL_GREETING_TIMEOUT_MS', 10000),
          socketTimeout: this.timeout('MAIL_SOCKET_TIMEOUT_MS', 20000),
        })
        : null;
  }

  async sendEmailVerificationOtp(email: string, otp: string): Promise<void> {
    const subject = 'Verify your VibeHue email';
    const text = `Your VibeHue verification OTP is ${otp}. This OTP expires in 10 minutes.`;
    const html = `
      <p>Your VibeHue verification OTP is:</p>
      <h2>${otp}</h2>
      <p>This OTP expires in 10 minutes.</p>
    `;

    await this.send(email, subject, text, html);
  }

  async sendPasswordResetLink(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reset your VibeHue password';
    const text = `Reset your password here: ${resetUrl}. This link expires in 15 minutes.`;
    const html = `
      <p>Reset your VibeHue password using this link:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 15 minutes.</p>
    `;

    await this.send(email, subject, text, html);
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<void> {
    await this.send(to, subject, text || html.replace(/<[^>]*>/g, ''), html);
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `[MAIL NOT CONFIGURED] ${subject} -> ${this.maskRecipient(to)}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }

  private timeout(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private maskRecipient(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    return `${localPart.slice(0, 2)}***@${domain}`;
  }
}
