import { Logger } from 'pino';
import { BaileysInstance, SessionState } from './BaileysInstance';
import { SessionStore } from './SessionStore';

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
  ) {
    this.store = new SessionStore(sessionsPath);
  }

  async connect(sessionId: string): Promise<BaileysInstance> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }

    const credPath = this.store.getCredPath(sessionId);
    const instance = new BaileysInstance(sessionId, credPath, this.logger);

    instance.on('state', (state: SessionState) => {
      this.logger.info({ sessionId, state }, 'Session state changed');
    });

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
