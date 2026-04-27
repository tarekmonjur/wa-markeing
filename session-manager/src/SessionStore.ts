import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * Manages filesystem paths for Baileys session credential storage.
 * One folder per session under the configured sessions root.
 */
export class SessionStore {
  constructor(private readonly rootPath: string) {
    if (!existsSync(rootPath)) {
      mkdirSync(rootPath, { recursive: true });
    }
  }

  getCredPath(sessionId: string): string {
    const path = join(this.rootPath, sessionId);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
    return path;
  }

  /**
   * Clear stale credentials for a session so Baileys starts fresh.
   */
  clearCreds(sessionId: string): void {
    const path = join(this.rootPath, sessionId);
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
    mkdirSync(path, { recursive: true });
  }
}
