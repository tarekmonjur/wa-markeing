import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app.helper';
import { registerAndLogin } from './helpers/auth.helper';
import { createTestContact } from './helpers/seed.helper';

describe('Conversation Inbox (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    const auth = await registerAndLogin(app);
    accessToken = auth.accessToken;
    userId = auth.userId;
  });

  afterAll(async () => {
    await ds?.destroy();
    await app?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });
  let contactId: string;

  it('setup: create contact and seed message logs', async () => {
    const contact = await createTestContact(app, userId, {
      phone: '+8801712345001',
      name: 'Inbox Test Contact',
    });
    contactId = contact.id;

    // Seed some messages
    for (let i = 0; i < 5; i++) {
      await ds.query(
        `INSERT INTO message_logs (direction, body, status, "userId", "contactId", "sentAt", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW() - interval '${5 - i} minutes', NOW() - interval '${5 - i} minutes')`,
        [
          i % 2 === 0 ? 'OUTBOUND' : 'INBOUND',
          `Message ${i + 1}`,
          'DELIVERED',
          userId,
          contactId,
        ],
      );
    }
  });

  it('GET /api/v1/inbox — lists conversations', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inbox')
      .set(auth())
      .expect(200);

    const body = res.body.data ?? res.body;
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const conv = body.data.find((c: any) => c.contactId === contactId);
    expect(conv).toBeTruthy();
    expect(conv.contactPhone).toBe('+8801712345001');
    expect(conv.lastMessage).toBeTruthy();
  });

  it('GET /api/v1/inbox/:contactId — returns conversation thread', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/inbox/${contactId}`)
      .set(auth())
      .expect(200);

    const body = res.body.data ?? res.body;
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBe(5);
    // Should be sorted newest first
    const dates = body.data.map((m: any) => new Date(m.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  it('GET /api/v1/inbox/:contactId with cursor — paginates correctly', async () => {
    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/inbox/${contactId}?limit=3`)
      .set(auth())
      .expect(200);

    const body = firstPage.body.data ?? firstPage.body;
    expect(body.data.length).toBe(3);

    if (body.hasMore) {
      const cursor = body.data[body.data.length - 1].id;
      const secondPage = await request(app.getHttpServer())
        .get(`/api/v1/inbox/${contactId}?cursor=${cursor}&limit=3`)
        .set(auth())
        .expect(200);

      const page2 = secondPage.body.data ?? secondPage.body;
      expect(page2.data.length).toBe(2);
    }
  });

  it('GET /api/v1/inbox — without token returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inbox')
      .expect(401);
  });
});
