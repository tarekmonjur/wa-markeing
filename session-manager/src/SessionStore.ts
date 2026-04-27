import { mkdirSync, existsSync, rmSync, readdirSync } from 'fs';
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
   * Check if saved credentials exist for a session.
   */
  hasCreds(sessionId: string): boolean {
    const path = join(this.rootPath, sessionId, 'creds.json');
    return existsSync(path);
  }

  /**
   * List all session IDs that have saved credentials on disk.
   */
  listSavedSessions(): string[] {
    if (!existsSync(this.rootPath)) return [];
    return readdirSync(this.rootPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(this.rootPath, d.name, 'creds.json')))
      .map((d) => d.name);
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
