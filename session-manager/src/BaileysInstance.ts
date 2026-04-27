import { EventEmitter } from 'events';
import { Logger } from 'pino';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  WASocket,
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

    this.socket = makeWASocket({
      auth: authState,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
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

        if (statusCode === DisconnectReason.loggedOut) {
          this.setState('DISCONNECTED');
          return;
        }

        if (statusCode === 405 || statusCode === 403) {
          this.setState('TOS_BLOCK');
          return;
        }

        // Exponential backoff reconnect
        this.reconnectAttempts++;
        if (this.reconnectAttempts > this.MAX_RECONNECT) {
          this.logger.warn({ sessionId: this.sessionId }, 'Circuit breaker opened — too many failures');
          this.setState('DISCONNECTED');
          setTimeout(() => this.connect(), this.CIRCUIT_OPEN_MS);
          return;
        }

        const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 60000);
        this.logger.info({ sessionId: this.sessionId, delay, attempt: this.reconnectAttempts }, 'Reconnecting...');
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
