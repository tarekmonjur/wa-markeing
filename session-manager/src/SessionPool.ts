import { Logger } from 'pino';
import { BaileysInstance, SessionState } from './BaileysInstance';
import { SessionStore } from './SessionStore';
import { InboundHandler } from './InboundHandler';

/**
 * Manages a pool of Baileys instances, one per session.
 * Maps sessionId → BaileysInstance.
 */
export class SessionPool {
  private readonly instances = new Map<string, BaileysInstance>();
  private readonly store: SessionStore;

  constructor(
    sessionsPath: string,
    private readonly logger: Logger,
    private readonly inboundHandler?: InboundHandler,
  ) {
    this.store = new SessionStore(sessionsPath);
  }

  /**
   * Fresh connect — clears saved creds and starts a new QR pairing flow.
   * Use this only when the user explicitly wants to re-pair.
   */
  async connect(sessionId: string): Promise<BaileysInstance> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }

    // Clear creds for a fresh QR pairing
    this.store.clearCreds(sessionId);

    return this.createAndConnect(sessionId);
  }

  /**
   * Restore a session using saved credentials (no QR needed).
   * Returns null if no saved creds exist.
   */
  async restore(sessionId: string): Promise<BaileysInstance | undefined> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }

    if (!this.store.hasCreds(sessionId)) {
      return undefined;
    }

    this.logger.info({ sessionId }, 'Restoring session from saved credentials');
    return this.createAndConnect(sessionId);
  }

  /**
   * Restore all sessions that have saved credentials on disk.
   * Called once on startup.
   */
  async restoreAll(): Promise<void> {
    const savedIds = this.store.listSavedSessions();
    if (savedIds.length === 0) {
      this.logger.info('No saved sessions to restore');
      return;
    }

    this.logger.info({ count: savedIds.length }, 'Restoring saved sessions');
    for (const sessionId of savedIds) {
      try {
        await this.restore(sessionId);
      } catch (err: any) {
        this.logger.error(
          { sessionId, error: err.message },
          'Failed to restore session, skipping',
        );
      }
    }
  }

  private async createAndConnect(sessionId: string): Promise<BaileysInstance> {
    const credPath = this.store.getCredPath(sessionId);
    const instance = new BaileysInstance(sessionId, credPath, this.logger);

    instance.on('state', (state: SessionState) => {
      this.logger.info({ sessionId, state }, 'Session state changed');
    });

    // Forward inbound messages to the handler
    if (this.inboundHandler) {
      instance.on('messages', (m: any) => {
        const messages = m.messages ?? [];
        if (messages.length > 0) {
          this.inboundHandler!.handleMessages(sessionId, messages).catch(
            (err) =>
              this.logger.error(
                { sessionId, error: err.message },
                'Failed to handle inbound messages',
              ),
          );
        }
      });
    }

    this.instances.set(sessionId, instance);
    await instance.connect();
    return instance;
  }

  get(sessionId: string): BaileysInstance | undefined {
    return this.instances.get(sessionId);
  }

  async disconnect(sessionId: string): Promise<void> {
    const instance = this.instances.get(sessionId);
    if (instance) {
      await instance.disconnect();
      this.instances.delete(sessionId);
    }
  }

  getAll(): Map<string, BaileysInstance> {
    return this.instances;
  }

  isHealthy(): boolean {
    return true; // Service is alive; individual sessions may vary
  }
}
