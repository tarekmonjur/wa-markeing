import { mkdirSync, existsSync } from 'fs';
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
}
