import { Router, Request, Response } from 'express';
import { SessionPool } from './SessionPool';

/**
 * Health check endpoint for the session-manager service.
 */
export class HealthServer {
  public readonly router: Router;

  constructor(private readonly pool: SessionPool) {
    this.router = Router();
    this.router.get('/health', this.check.bind(this));
  }

  private check(_req: Request, res: Response): void {
    const sessions = Array.from(this.pool.getAll().entries());
    const connected = sessions.filter(([, inst]) => inst.getState() === 'CONNECTED').length;

    res.json({
      ok: true,
      uptime: process.uptime(),
      sessions: { total: sessions.length, connected },
    });
  }
}
