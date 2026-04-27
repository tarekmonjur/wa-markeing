// Enums shared across backend, frontend, and session-manager

export enum Plan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  AGENCY = 'AGENCY',
}

export enum SessionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  QR_READY = 'QR_READY',
  CONNECTED = 'CONNECTED',
  TOS_BLOCK = 'TOS_BLOCK',
  BANNED = 'BANNED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

export enum Direction {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

// DTOs shared between backend and frontend

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CampaignProgressEvent {
  campaignId: string;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  status: CampaignStatus;
}

export interface SessionStatusEvent {
  sessionId: string;
  status: SessionStatus;
  qrCode?: string;
}

export interface ContactImportProgress {
  progress: number;
  total: number;
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}
