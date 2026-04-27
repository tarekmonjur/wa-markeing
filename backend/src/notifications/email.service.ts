import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailPayload, EmailType } from './interfaces/email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    } else {
      this.logger.warn('SMTP_HOST not configured — emails will be logged only');
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    const html = this.renderTemplate(payload.type, payload.context);

    if (!this.transporter) {
      this.logger.log(
        { to: payload.to, type: payload.type },
        'Email (no SMTP): %s',
        payload.subject,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'noreply@wa-marketing.local'),
        to: payload.to,
        subject: payload.subject,
        html,
      });
      this.logger.log({ to: payload.to, type: payload.type }, 'Email sent');
    } catch (error) {
      this.logger.error(
        { to: payload.to, type: payload.type, error: error.message },
        'Failed to send email',
      );
    }
  }

  async sendCampaignCompleted(
    email: string,
    campaignName: string,
    stats: { sent: number; failed: number },
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `Campaign "${campaignName}" completed`,
      type: EmailType.CAMPAIGN_COMPLETED,
      context: { campaignName, ...stats },
    });
  }

  async sendSessionDisconnected(
    email: string,
    sessionName: string,
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `WhatsApp session "${sessionName}" disconnected`,
      type: EmailType.SESSION_DISCONNECTED,
      context: { sessionName },
    });
  }

  async sendTosBlockAlert(
    email: string,
    sessionName: string,
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `⚠️ WhatsApp session "${sessionName}" blocked (TOS violation)`,
      type: EmailType.TOS_BLOCK_ALERT,
      context: { sessionName },
    });
  }

  async sendWebhookAbandoned(
    email: string,
    webhookUrl: string,
    event: string,
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `Webhook delivery failed permanently: ${event}`,
      type: EmailType.WEBHOOK_ABANDONED,
      context: { webhookUrl, event },
    });
  }

  private renderTemplate(type: EmailType, context: Record<string, any>): string {
    // Simple HTML templates — replace with MJML or React Email for production
    const templates: Record<EmailType, (ctx: Record<string, any>) => string> = {
      [EmailType.EMAIL_VERIFICATION]: (ctx) =>
        `<h2>Verify your email</h2><p>Click <a href="${ctx.verifyUrl}">here</a> to verify your email.</p>`,
      [EmailType.PASSWORD_RESET]: (ctx) =>
        `<h2>Password Reset</h2><p>Click <a href="${ctx.resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      [EmailType.CAMPAIGN_COMPLETED]: (ctx) =>
        `<h2>Campaign Completed</h2><p>Your campaign "<strong>${ctx.campaignName}</strong>" has finished.</p><p>Sent: ${ctx.sent} | Failed: ${ctx.failed}</p>`,
      [EmailType.SESSION_DISCONNECTED]: (ctx) =>
        `<h2>Session Disconnected</h2><p>Your WhatsApp session "<strong>${ctx.sessionName}</strong>" has been disconnected. Please reconnect.</p>`,
      [EmailType.TOS_BLOCK_ALERT]: (ctx) =>
        `<h2>⚠️ Session Blocked</h2><p>Your WhatsApp session "<strong>${ctx.sessionName}</strong>" was blocked due to Terms of Service violation. Please review your messaging practices.</p>`,
      [EmailType.WEBHOOK_ABANDONED]: (ctx) =>
        `<h2>Webhook Delivery Failed</h2><p>Webhook to <code>${ctx.webhookUrl}</code> for event <strong>${ctx.event}</strong> has failed after all retries.</p>`,
      [EmailType.DAILY_SUMMARY]: (ctx) =>
        `<h2>Daily Summary</h2><p>Messages sent: ${ctx.messagesSent} | Campaigns: ${ctx.campaigns} | New contacts: ${ctx.newContacts}</p>`,
    };

    return templates[type]?.(context) ?? '<p>Notification from WA Marketing</p>';
  }
}
