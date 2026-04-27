import { Router, Request, Response } from 'express';
import { Logger } from 'pino';
import QRCode from 'qrcode';
import { SessionPool } from './SessionPool';

/**
 * Express router providing session management + QR code streaming endpoints.
 */
export class QRServer {
  public readonly router: Router;

  constructor(
    private readonly pool: SessionPool,
    private readonly logger: Logger,
  ) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post('/sessions/:id/connect', this.connect.bind(this));
    this.router.get('/sessions/:id/qr', this.streamQR.bind(this));
    this.router.get('/sessions/:id/status', this.getStatus.bind(this));
    this.router.post('/sessions/:id/send', this.send.bind(this));
    this.router.get('/sessions', this.listSessions.bind(this));
    this.router.delete('/sessions/:id', this.disconnect.bind(this));
  }

  private async connect(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const instance = await this.pool.connect(id);
      res.json({ sessionId: id, state: instance.getState() });
    } catch (err: any) {
      this.logger.error({ sessionId: id, error: err.message }, 'Connect failed');
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * SSE endpoint that streams QR code updates to the client.
   */
  private async streamQR(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const instance = this.pool.get(id);

    if (!instance) {
      res.status(404).json({ error: 'Session not found, POST /sessions/:id/connect first' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendState = async (): Promise<void> => {
      const state = instance.getState();
      const qr = instance.getQR();
      let qrDataUrl: string | null = null;
      if (qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
        } catch {
          // ignore QR encoding errors
        }
      }
      const payload = JSON.stringify({ state, qrDataUrl });
      res.write(`data: ${payload}\n\n`);
    };

    // Send current state immediately
    sendState();

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      const state = instance.getState();
      await sendState();
      if (state === 'CONNECTED' || state === 'BANNED') {
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    req.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * Simple JSON polling endpoint — returns current state + QR data URL.
   * Works reliably through Next.js rewrites (unlike SSE).
   */
  private async getStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const instance = this.pool.get(id);

    if (!instance) {
      res.status(404).json({ error: 'Session not found, POST /sessions/:id/connect first' });
      return;
    }

    const state = instance.getState();
    const qr = instance.getQR();
    let qrDataUrl: string | null = null;
    if (qr) {
      try {
        qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
      } catch {
        // ignore QR encoding errors
      }
    }
    res.json({ state, qrDataUrl });
  }

  private async send(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { phone, body, mediaUrl, mediaType } = req.body;

    const instance = this.pool.get(id);
    if (!instance) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (instance.getState() !== 'CONNECTED') {
      res.status(400).json({ error: `Session ${id} is not connected (state: ${instance.getState()})` });
      return;
    }

    try {
      const jid = phone.replace('+', '') + '@s.whatsapp.net';
      let waMessageId: string;

      if (mediaUrl && mediaType) {
        const result = await instance.sendMedia(
          jid,
          mediaUrl,
          mediaType.toLowerCase() as 'image' | 'video' | 'audio' | 'document',
          body,
        );
        waMessageId = result.id;
      } else {
        const result = await instance.sendText(jid, body);
        waMessageId = result.id;
      }

      this.logger.info({ sessionId: id, phone, waMessageId }, 'Message sent');
      res.json({ waMessageId });
    } catch (err: any) {
      this.logger.error({ sessionId: id, phone, error: err.message }, 'Send failed');
      res.status(500).json({ error: err.message });
    }
  }

  private listSessions(_req: Request, res: Response): void {
    const sessions = Array.from(this.pool.getAll().entries());
    res.json(
      sessions.map(([id, inst]) => ({
        sessionId: id,
        state: inst.getState(),
      })),
    );
  }

  private async disconnect(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      await this.pool.disconnect(id);
      res.json({ sessionId: id, state: 'DISCONNECTED' });
    } catch (err: any) {
      this.logger.error({ sessionId: id, error: err.message }, 'Disconnect failed');
      res.status(500).json({ error: err.message });
    }
  }
}
