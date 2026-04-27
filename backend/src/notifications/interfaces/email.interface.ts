export enum EmailType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  CAMPAIGN_COMPLETED = 'campaign_completed',
  SESSION_DISCONNECTED = 'session_disconnected',
  TOS_BLOCK_ALERT = 'tos_block_alert',
  WEBHOOK_ABANDONED = 'webhook_abandoned',
  DAILY_SUMMARY = 'daily_summary',
}

export interface EmailPayload {
  to: string;
  subject: string;
  type: EmailType;
  context: Record<string, any>;
}
