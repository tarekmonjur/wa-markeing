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

  async connect(sessionId: string): Promise<BaileysInstance> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }

    // Clear stale creds from any previous failed attempt
    this.store.clearCreds(sessionId);

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
