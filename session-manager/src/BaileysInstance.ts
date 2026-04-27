import { EventEmitter } from 'events';
import { Logger } from 'pino';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

export type SessionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_READY'
  | 'CONNECTED'
  | 'TOS_BLOCK'
  | 'BANNED';

/**
 * Wraps a single Baileys WASocket connection with:
 * - State machine management
 * - Auto-reconnect with exponential backoff + circuit breaker
 * - Anti-ban presence simulation
 */
export class BaileysInstance extends EventEmitter {
  private socket: WASocket | null = null;
  private state: SessionState = 'DISCONNECTED';
  private qrCode: string | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 5;
  private readonly CIRCUIT_OPEN_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    public readonly sessionId: string,
    private readonly credPath: string,
    private readonly logger: Logger,
  ) {
    super();
  }

  getState(): SessionState {
    return this.state;
  }

  getQR(): string | null {
    return this.qrCode;
  }

  async connect(): Promise<void> {
    this.setState('CONNECTING');

    const { state: authState, saveCreds } = await useMultiFileAuthState(this.credPath);

    // Fetch latest WA Web version to avoid version mismatch bans
    let version: [number, number, number] | undefined;
    try {
      const { version: v } = await fetchLatestBaileysVersion();
      version = v;
      this.logger.info({ sessionId: this.sessionId, version: v }, 'Using WA version');
    } catch {
      this.logger.warn({ sessionId: this.sessionId }, 'Could not fetch latest WA version, using default');
    }

    this.socket = makeWASocket({
      auth: authState,
      version,
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      retryRequestDelayMs: 2000,
      logger: this.logger.child({ sessionId: this.sessionId }) as any,
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        this.setState('QR_READY');
      }

      if (connection === 'open') {
        this.qrCode = null;
        this.reconnectAttempts = 0;
        this.setState('CONNECTED');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const errorMsg = lastDisconnect?.error?.message ?? 'unknown';

        this.logger.info(
          { sessionId: this.sessionId, statusCode, errorMsg },
          'Connection closed',
        );

        // Logged out — stop entirely
        if (statusCode === DisconnectReason.loggedOut) {
          this.setState('DISCONNECTED');
          return;
        }

        // Genuine TOS block — only on explicit 403 (forbidden) from WhatsApp
        // after the session was previously authenticated
        if (statusCode === DisconnectReason.forbidden) {
          this.setState('BANNED');
          return;
        }

        // For ALL other cases (connection failure, timeout, restart required, etc.)
        // retry with exponential backoff — don't give up immediately
        this.reconnectAttempts++;
        if (this.reconnectAttempts > this.MAX_RECONNECT) {
          this.logger.warn(
            { sessionId: this.sessionId, attempts: this.reconnectAttempts },
            'Max reconnect attempts reached',
          );
          this.setState('DISCONNECTED');
          setTimeout(() => {
            this.reconnectAttempts = 0;
            this.connect();
          }, this.CIRCUIT_OPEN_MS);
          return;
        }

        const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
        this.logger.info(
          { sessionId: this.sessionId, delay, attempt: this.reconnectAttempts, statusCode },
          'Reconnecting...',
        );
        setTimeout(() => this.connect(), delay);
      }
    });

    this.socket.ev.on('messages.upsert', (m) => {
      this.emit('messages', m);
    });
  }

  async disconnect(): Promise<void> {
    this.socket?.end(undefined);
    this.socket = null;
    this.qrCode = null;
    this.reconnectAttempts = 0;
    this.setState('DISCONNECTED');
  }

  /**
   * Send a text message with anti-ban presence simulation.
   */
  async sendText(jid: string, text: string): Promise<{ id: string }> {
    if (!this.socket || this.state !== 'CONNECTED') {
      throw new Error(`Session ${this.sessionId} is not connected`);
    }

    // Anti-ban: simulate composing
    await this.socket.sendPresenceUpdate('composing', jid);
    await this.delay(1000 + Math.random() * 2000);
    await this.socket.sendPresenceUpdate('paused', jid);

    const sent = await this.socket.sendMessage(jid, { text });
    return { id: sent?.key?.id ?? '' };
  }

  /**
   * Send a media message (image, video, document).
   */
  async sendMedia(
    jid: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
  ): Promise<{ id: string }> {
    if (!this.socket || this.state !== 'CONNECTED') {
      throw new Error(`Session ${this.sessionId} is not connected`);
    }

    await this.socket.sendPresenceUpdate('composing', jid);
    await this.delay(1000 + Math.random() * 2000);
    await this.socket.sendPresenceUpdate('paused', jid);

    const messageContent: Record<string, unknown> = { caption };
    messageContent[mediaType] = { url: mediaUrl };

    const sent = await this.socket.sendMessage(jid, messageContent as any);
    return { id: sent?.key?.id ?? '' };
  }

  private setState(newState: SessionState): void {
    this.state = newState;
    this.emit('state', newState);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
